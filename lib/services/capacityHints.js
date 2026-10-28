/**
 * Capacity hints from ticket history.
 *
 * Field operators usually record the real bandwidth in ticket text: activation
 * config dumps (`description INDOTEL-SITE-300M-SAP-C-...`, `qos lr ... cir`),
 * client/device names that embed the bandwidth, EWO comments ("Upgrade ke 1G"),
 * or explicit `Kapasitas Existing : 300 Mbps` lines. This module extracts those
 * hints so the Service Work form and the server can suggest the current
 * capacity instead of asking operators to type it.
 *
 * Pure functions only: no database, no React, no Node built-ins.
 */
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };
const KIND_LABEL = {
  description: 'config perangkat',
  'client-name': 'nama client/perangkat',
  'rate-limit': 'rate-limit CIR',
  text: 'keterangan tiket',
  'upgrade-target': 'EWO upgrade',
};

export function candidateKindLabel(kind) {
  return KIND_LABEL[kind] || 'riwayat tiket';
}

/** Strip HTML (ticket bodies are stored as markup) while keeping line breaks. */
export function normalizeHintText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr)>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toMbps(raw, unit) {
  const value = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const normalized = String(unit || '').toLowerCase();
  const mbps = normalized === 'gbps' || normalized === 'g'
    ? value * 1000
    : normalized === 'kbps'
      ? value / 1000
      : value;
  if (!Number.isFinite(mbps) || mbps <= 0) return null;
  return Math.round(mbps * 100) / 100;
}

function excerpt(text, index, length = 160) {
  const start = Math.max(0, index - 70);
  return text.slice(start, start + length).replace(/\s+/g, ' ').trim();
}

function lineAt(text, index) {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? undefined : end);
}

function dateOf(candidate) {
  const value = Date.parse(candidate?.source?.createdAt || '');
  return Number.isFinite(value) ? value : 0;
}

const CID_TOKEN_RE = /\b(?:SAP-)?[A-Z][A-Z0-9]{0,3}-\d{2,6}(?:-\d{2,6}){1,2}\b/g;

function cidTokens(text) {
  return [...String(text || '').toUpperCase().matchAll(CID_TOKEN_RE)].map((match) => match[0]);
}

function lineTokens(line, cid, aliases) {
  const known = [String(cid || '').toUpperCase(), ...aliases.map((alias) => String(alias || '').toUpperCase())].filter(Boolean);
  return cidTokens(line).filter((token) => !known.some((code) => token === code || code.endsWith(`-${token}`) || token.endsWith(`-${code}`)));
}

/** Config blocks are one interface line plus its QoS lines; scope CIR next to the description. */
function blockAt(text, index) {
  const start = text.lastIndexOf('\n', index) + 1;
  const nextInterface = text.slice(start).search(/\n\s*interface\s/i);
  const end = nextInterface === -1 ? Math.min(text.length, start + 900) : Math.min(start + nextInterface, start + 900);
  return text.slice(start, Math.max(index + 1, end));
}

/** Router rate-limit CIR is stored in kbps and sits 1-3% above the sold capacity. */
function rateMatchesCapacity(cirValues, mbps) {
  if (!cirValues.length) return true;
  return cirValues.some((cir) => {
    if (!cir || !mbps) return false;
    const ratio = cir / mbps;
    return ratio >= 0.95 && ratio <= 1.15;
  });
}

function cirValuesIn(text) {
  return [...text.matchAll(/(?:rate-limit[^\n]{0,120}?\bcir|qos[ \t]+lr[^\n]{0,80}?\bcir|police[^\n]{0,80}?\bcir)[ \t]+(\d{3,9})\b/gi)]
    .map((match) => toMbps(match[1], 'kbps'))
    .filter((value) => value != null);
}

function rankOf(candidate) {
  if (candidate?.approximate) return 0;
  return CONFIDENCE_RANK[candidate?.confidence] || 0;
}

/** Newest first, then strongest evidence. Operators usually need the latest state. */
export function sortCapacityCandidates(list) {
  return [...list].sort((a, b) => dateOf(b) - dateOf(a) || rankOf(b) - rankOf(a) || b.mbps - a.mbps);
}

function dedupe(list) {
  const byKey = new Map();
  for (const candidate of list) {
    const source = candidate.source || {};
    const key = [candidate.kind, candidate.mbps, source.ticketId ?? '', source.createdAt || ''].join('|');
    const previous = byKey.get(key);
    if (!previous || rankOf(candidate) > rankOf(previous)) byKey.set(key, candidate);
  }
  return [...byKey.values()];
}

function pushCandidate(bucket, candidate) {
  if (!candidate || candidate.mbps == null) return;
  bucket.push(candidate);
}

/**
 * @param {object} input
 * @param {string} input.cid canonical CID of the service being inspected
 * @param {string[]} [input.aliases] known legacy codes that belong to the same service
 * @param {Array<{text?:string,kind?:string,ticketId?:number,trackingId?:string,createdAt?:string|Date,singleService?:boolean}>} input.texts
 * @returns {{existing:Array<object>,target:Array<object>}}
 */
export function extractCapacityHints({ cid = '', aliases = [], texts = [] } = {}) {
  const normalizedCid = String(cid || '').trim().toUpperCase();
  const normalizedAliases = aliases.map((alias) => String(alias || '').trim().toUpperCase()).filter(Boolean);
  const cidPattern = normalizedCid ? escapeRegExp(normalizedCid) : null;
  const existing = [];
  const target = [];
  for (const item of texts) {
    const text = normalizeHintText(item?.text);
    if (!text.trim()) continue;
    const source = {
      ticketId: item?.ticketId ?? null,
      trackingId: item?.trackingId || '',
      createdAt: item?.createdAt instanceof Date ? item.createdAt.toISOString() : item?.createdAt || '',
    };
    const textHasCid = normalizedCid ? text.toUpperCase().includes(normalizedCid) : false;
    const singleService = item?.singleService === true;

    // 1) Device config `description ...-300M-<CID>` or `-1G_<CID>`.
    for (const match of text.matchAll(/\b(?:description|desc)\b[^\n]{0,200}?[-_ ](\d{1,5}(?:[.,]\d+)?)\s?([MG])(?:BPS|B)?(?=[-_ .,;:)\s]|$)/gi)) {
      const mbps = toMbps(match[1], match[2]);
      const line = lineAt(text, match.index);
      const lineHasCid = normalizedCid ? line.toUpperCase().includes(normalizedCid) : false;
      const foreignCid = !lineHasCid && lineTokens(line, normalizedCid, normalizedAliases).length > 0;
      // Softblock/terminated interfaces are rate-limited below the sold capacity,
      // so their CIR cannot corroborate the bandwidth stated in the name.
      const throttled = /softblock|terminate|shutdown/i.test(line);
      const consistent = throttled || rateMatchesCapacity(cirValuesIn(blockAt(text, match.index)), mbps);
      pushCandidate(existing, {
        mbps,
        kind: 'description',
        confidence: foreignCid || !consistent ? 'low' : lineHasCid ? 'high' : singleService ? 'medium' : 'low',
        approximate: false,
        evidence: excerpt(text, match.index),
        source,
      });
    }

    // 2) Client/device name that embeds the bandwidth right before the CID.
    if (cidPattern) {
      const namePattern = new RegExp(`[-_ ](\\d{1,5}(?:[.,]\\d+)?)\\s?([MG])(?:BPS|B)?[-_ ]${cidPattern}\\b`, 'gi');
      for (const match of text.matchAll(namePattern)) {
        const mbps = toMbps(match[1], match[2]);
        pushCandidate(existing, {
          mbps,
          kind: 'client-name',
          confidence: rateMatchesCapacity(cirValuesIn(blockAt(text, match.index)), mbps) ? 'medium' : 'low',
          approximate: false,
          evidence: excerpt(text, match.index),
          source,
        });
      }
    }

    // 3) Router rate-limit / QoS CIR in kbps (approximate, corroborating signal).
    for (const match of text.matchAll(/(?:rate-limit[^\n]{0,120}?\bcir|qos[ \t]+lr[^\n]{0,80}?\bcir|police[^\n]{0,80}?\bcir)[ \t]+(\d{3,9})\b/gi)) {
      pushCandidate(existing, {
        mbps: toMbps(match[1], 'kbps'),
        kind: 'rate-limit',
        confidence: 'low',
        approximate: true,
        evidence: excerpt(text, match.index),
        source,
      });
    }

    // 4) Explicit text: `Kapasitas Existing : 300 Mbps`, `Existing BW : INTERNET 250 MBPS`.
    for (const match of text.matchAll(/(?:kapasitas[ \t]+(?:existing|lama|saat[ \t]+ini)|bandwidth[ \t]+(?:existing|lama|saat[ \t]+ini)|existing[ \t]*(?:bw|bandwidth))[ \t]*[:=][ \t]*(?:[A-Za-z][A-Za-z/&. -]{0,20}[ \t]+)?(\d{1,6}(?:[.,]\d+)?)[ \t]*(mbps|gbps)\b/gi)) {
      pushCandidate(existing, {
        mbps: toMbps(match[1], match[2]),
        kind: 'text',
        confidence: textHasCid || singleService ? 'medium' : 'low',
        approximate: false,
        evidence: excerpt(text, match.index),
        source,
      });
    }

    // 5) Requested capacity: `Upgrade ke 1G`, `Upgrade ke 1,5G`, `menjadi 2.5Gbps`.
    for (const match of text.matchAll(/(?:upgrade|upgrading|naik)\b[^\n]{0,60}?(?:ke|menjadi|jadi)\s*(\d{1,6}(?:[.,]\d+)?)\s*(mbps|gbps|[MG])(?:BPS|B)?\b/gi)) {
      pushCandidate(target, {
        mbps: toMbps(match[1], match[2]),
        kind: 'upgrade-target',
        confidence: item?.kind === 'comment' ? 'medium' : 'low',
        approximate: false,
        evidence: excerpt(text, match.index),
        source,
      });
    }
  }
  return {
    existing: sortCapacityCandidates(dedupe(existing)),
    target: sortCapacityCandidates(dedupe(target)),
  };
}

/**
 * Decide whether the current capacity may be adopted automatically.
 *
 * Device descriptions and client names are snapshots over time: a newer
 * upgrade supersedes an older activation dump, so the newest usable evidence
 * wins. Only candidates recorded at that same moment may conflict; different
 * values with the same timestamp need a human decision.
 */
export function adoptableCapacity(existing = []) {
  const usable = existing.filter((candidate) => !candidate.approximate
    && (candidate.confidence === 'high' || candidate.confidence === 'medium'));
  if (!usable.length) return { status: 'missing', candidates: sortCapacityCandidates(existing.filter((candidate) => !candidate.approximate)) };
  const sorted = sortCapacityCandidates(usable);
  const newestAt = dateOf(sorted[0]);
  const atNewest = sorted.filter((candidate) => dateOf(candidate) === newestAt);
  const values = [...new Set(atNewest.map((candidate) => candidate.mbps))];
  if (values.length === 1) {
    return { status: 'ready', mbps: values[0], candidate: atNewest[0] };
  }
  const distinct = [];
  const seen = new Set();
  for (const candidate of atNewest) {
    if (seen.has(candidate.mbps)) continue;
    seen.add(candidate.mbps);
    distinct.push(candidate);
  }
  return { status: 'ambiguous', candidates: distinct };
}

/** Best target suggestion for the service-work capacity input. */
export function suggestedTargetCapacity(target = []) {
  const usable = target.filter((candidate) => candidate.mbps != null);
  if (!usable.length) return null;
  const strongest = sortCapacityCandidates(usable);
  return strongest.find((candidate) => candidate.confidence !== 'low') || strongest[0];
}
