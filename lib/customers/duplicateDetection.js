/**
 * Pure helpers for suggesting potential duplicate customers and matching CID ticket sources
 * to canonical customers (including previously merged alias names).
 * Results are strictly read-only hints and must be explicitly confirmed by an operator.
 */

const LEGAL_ENTITY_TOKENS = new Set([
  'pt', 'cv', 'ud', 'fa', 'tbk', 'persero', 'ltd', 'inc', 'corp', 'llc', 'co', 'gmbh', 'sdn', 'bhd',
]);

export function normalizeCustomerName(name) {
  const raw = String(name || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  if (!raw) return '';
  const tokens = raw.split(/\s+/).filter((t) => t && !LEGAL_ENTITY_TOKENS.has(t));
  return (tokens.length ? tokens : raw.split(/\s+/)).join(' ');
}

function tokenizeNormalized(name) {
  const norm = normalizeCustomerName(name);
  return norm ? norm.split(' ').filter(Boolean) : [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function customerSimilarity(nameA, nameB) {
  const normA = normalizeCustomerName(nameA);
  const normB = normalizeCustomerName(nameB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const compactA = normA.replace(/\s+/g, '');
  const compactB = normB.replace(/\s+/g, '');
  if (compactA === compactB) return 0.98;

  const tokensA = tokenizeNormalized(nameA);
  const tokensB = tokenizeNormalized(nameB);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlap = 0;
  for (const t of setA) {
    if (setB.has(t)) overlap++;
  }
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union > 0 ? overlap / union : 0;

  const maxLen = Math.max(compactA.length, compactB.length);
  const editRatio = maxLen >= 4 ? 1 - levenshtein(compactA, compactB) / maxLen : 0;

  const minTokens = Math.min(setA.size, setB.size);
  const containment = minTokens > 0 && (normA.includes(normB) || normB.includes(normA))
    ? overlap / Math.max(setA.size, setB.size)
    : 0;

  return Math.max(jaccard, editRatio >= 0.84 ? editRatio : 0, containment >= 0.66 ? 0.85 : 0);
}

function serviceCountFor(customer, serviceCountMap) {
  if (serviceCountMap && typeof serviceCountMap.get === 'function') {
    return serviceCountMap.get(Number(customer.id)) || 0;
  }
  return Number(customer?._count?.services || 0);
}

function contactCompleteness(customer) {
  return (customer?.contactEmail ? 1 : 0) + (customer?.contactPhone ? 1 : 0);
}

/**
 * Finds groups/pairs of active customers with similar names.
 * Recommends the canonical customer with higher service count, fuller contact info, or lower ID.
 */
export function findCustomerDuplicateSuggestions(customers = [], { serviceCounts = null, minScore = 0.78 } = {}) {
  const active = customers.filter((c) => c && c.active !== false && !c.archivedAt && Number(c.id) > 0);
  const pairs = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const score = customerSimilarity(a.name, b.name);
      if (score < minScore) continue;

      const scoreA = serviceCountFor(a, serviceCounts) * 10 + contactCompleteness(a);
      const scoreB = serviceCountFor(b, serviceCounts) * 10 + contactCompleteness(b);
      const target = scoreB > scoreA || (scoreB === scoreA && Number(b.id) < Number(a.id)) ? b : a;
      const source = target.id === a.id ? b : a;

      pairs.push({
        sourceId: source.id,
        targetId: target.id,
        sourceName: source.name,
        targetName: target.name,
        sourceServiceCount: serviceCountFor(source, serviceCounts),
        targetServiceCount: serviceCountFor(target, serviceCounts),
        score: Number(score.toFixed(2)),
        reason: normalizeCustomerName(a.name) === normalizeCustomerName(b.name)
          ? 'Nama identik setelah normalisasi badan usaha/tanda baca'
          : 'Kemiripan nama tinggi',
      });
    }
  }
  return pairs.sort((x, y) => y.score - x.score || x.targetName.localeCompare(y.targetName));
}

/**
 * Suggests up to `limit` active customers matching a ticket candidate's sourceNames.
 * Uses canonical customer names plus previously merged alias names, without guessing IDs from numeric CIDs.
 */
export function suggestCustomerForCircuitSource(sourceNames = [], customers = [], { limit = 3, minScore = 0.5 } = {}) {
  const names = (Array.isArray(sourceNames) ? sourceNames : [sourceNames])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (!names.length) return [];

  // Ticket reporter prose often looks like "PT ABC - Site Jakarta" or "PT ABC / Link Backup"
  const prefixes = new Set();
  for (const raw of names) {
    prefixes.add(raw);
    const segment = raw.split(/\s*[-–|\/]\s*/)[0]?.trim();
    if (segment && segment.length >= 2) prefixes.add(segment);
  }

  const active = customers.filter((c) => c && c.active !== false && !c.archivedAt && Number(c.id) > 0);
  const scored = [];
  for (const customer of active) {
    const candidateNames = [
      { label: customer.name, isAlias: false },
      ...((customer.mergedAliases || []).map((a) => ({ label: a.name, isAlias: true }))),
    ];
    let bestScore = 0;
    let matchedLabel = customer.name;
    let matchedAlias = false;

    for (const source of prefixes) {
      const sourceNorm = normalizeCustomerName(source);
      if (!sourceNorm) continue;
      for (const entry of candidateNames) {
        const entryNorm = normalizeCustomerName(entry.label);
        if (!entryNorm) continue;
        let score = customerSimilarity(source, entry.label);
        if (entryNorm.length >= 3 && sourceNorm.includes(entryNorm)) {
          score = Math.max(score, 0.88);
        } else if (sourceNorm.length >= 3 && entryNorm.includes(sourceNorm)) {
          score = Math.max(score, 0.72);
        }
        if (score > bestScore) {
          bestScore = score;
          matchedLabel = entry.label;
          matchedAlias = entry.isAlias;
        }
      }
    }

    if (bestScore >= minScore) {
      scored.push({
        customerId: customer.id,
        name: customer.name,
        score: Number(bestScore.toFixed(2)),
        matchedViaAlias: matchedAlias ? matchedLabel : null,
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
