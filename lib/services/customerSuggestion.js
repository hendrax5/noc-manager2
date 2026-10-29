/**
 * Legacy ticket subjects carry a free-text customer/site name, not a Customer ID.
 * These helpers derive a readable company name and a *conservative* registry match so
 * the CID-linking dialog can prefill the owner without guessing quietly.
 */

const LEGAL = new Set(['PT','CV','UD','PD','TBK','PERSERO','LTD','INC','LLC','PMA']);
/** Words too common to prove two different customers are the same company. */
const GENERIC = new Set([
  'YAYASAN','DINAS','KANTOR','BADAN','KEMENTERIAN','UNIVERSITAS','POLITEKNIK','SEKOLAH','SMA','SMAN','SMK','SMKN','SMP','SMPN','MADRASAH','RUMAH','SAKIT','PEMERINTAH','NEGARA','REPUBLIK','LEMBAGA','BALAI','PUSAT',
  'INDONESIA','NUSANTARA','GROUP','GRUP','HOLDING',
  'JARINGAN','MEDIA','DATA','NETWORK','NETWORKS','NET','TEKNOLOGI','TECHNOLOGY','KOMUNIKASI','INTERNET','SOLUSI','SOLUTION','MULTI','GLOBAL','PRIMA','UTAMA','MANDIRI','ABADI','SEJAHTERA','SUKSES','MAKMUR','JAYA','KARYA','SARANA','INFRASTRUKTUR','DIGITAL','TELEKOMUNIKASI','TELEMATIKA','AKSES','KONEKSI','KONEKTIVITAS','INFORMATIKA','KOMPUTER','SISTEM','SYSTEM',
  'SITE','OFFICE','CABANG','POP','GEDUNG','LANTAI','RUANG','HUB','NODE','RACK','TO','SEWA','CORE','XCON','XC','MMR','IPT','METRO','LITE','COMIX','HSPIX','BOD','TRIAL','PEMASANGAN',
  'KOTA','KABUPATEN','PROVINSI','JAKARTA','BANDUNG','SURABAYA','SEMARANG','MEDAN','MAKASSAR','DENPASAR','TANGERANG','BEKASI','DEPOK','BOGOR','MALANG','KUDUS','CIREBON','KARAWANG',
]);
const TITLE_KEEP = new Set([...LEGAL, 'SMA','SMAN','SMK','SMKN','SMP','SMPN','SD','SDN','RPTRA','BPS','BUMN','KOMINFO','DISKOMINFO','BASARNAS','BMKG','KAI','PLN','RRI','TVRI','JMTO','MMD']);
const tokenize = value => String(value || '').normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const nameTokens = value => tokenize(value).filter(token => !LEGAL.has(token));
const withLegalPrefix = name => (/^(?:PT|CV|UD|PD)\b/.test(name) ? name : name);

/** "PT JARINGAN TIANG INDONESIA GROUP-OFFICE KALIGELAN" -> "PT Jaringan Tiang Indonesia Group". */
export function extractCustomerName(raw) {
  let name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  const toRack = name.match(/\bto\s+rack\s*[:\-]?\s*(.+)$/i);
  if (toRack) name = toRack[1];
  // Bracketed prefixes/suffixes are internal tags ("[HUB]", "(COMIX)"), not the company.
  name = name.replace(/^\s*\[[^\]]*\]\s*/, '').replace(/\s*\[[^\]]*\]\s*$/, '');
  // "PT (Velo Net)" means the brand inside the parentheses, not a suffix note.
  name = name.replace(/\b(PT|CV|UD|PD)\s*\(\s*([^)]*)\s*\)/gi, (_, form, brand) => `${form} ${brand.trim()}`);
  name = name.replace(/\s*[-–—]?\s*\bsite\b[\s:.\-–—/]*(.*)$/i, '');
  name = name.replace(/\s*[-–—]\s*(?:office|cabang|pop|gedung|lantai|ruang|hub|node|rack)\b.*$/i, '');
  name = name.replace(/,\s*(?:PT|CV|UD|PD)\.?\b.*$/i, '');
  // "PT INDOTEL-CV BUY COMP" is the brand plus a downstream customer note.
  name = name.replace(/\s*[-–—]\s*(?:PT|CV|UD|PD)\b.*$/i, '');
  name = name.replace(/[,\s]+(?:PT|CV|UD|PD|TBK)\.?$/i, '');
  for (let guard = 0; guard < 4; guard += 1) name = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  name = name.replace(/^[\s("'[\-–—,;:]+/, '').replace(/[\s)"'\]\-–—,;:/]+$/, '').trim();
  name = name.replace(/\s{2,}/g, ' ');
  if (/^(?:pt|cv|ud|pd)[\s(.]*/i.test(name)) {
    name = name.replace(/^(pt|cv|ud|pd)[\s(.]*/i, (_, form) => `${form.toUpperCase()} `);
  }
  name = titleCase(name);
  return name.length >= 3 && nameTokens(name).length ? name : '';
}

function titleCase(name) {
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (!letters || letters !== letters.toUpperCase()) return name;
  return name.split(' ').map(word => {
    const clean = word.replace(/[^A-Z0-9]/g, '');
    if (!clean) return word;
    if (TITLE_KEEP.has(clean)) return clean;
    if (/^\d+$/.test(clean)) return clean;
    return clean.charAt(0) + clean.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Only whole-name containment counts as the same company:
 * - identical tokens, or
 * - the ticket name mentions every token of the registered customer, or
 * - the registered customer adds only generic marketing words (NUSANTARA, SOLUSI, …).
 * Shared city/brand-ish words alone never match.
 */
const matchScore = (customer, source) => {
  const customerTokens = nameTokens(customer.name);
  const sourceTokens = nameTokens(source);
  if (!customerTokens.length || !sourceTokens.length) return null;
  if (customerTokens.join(' ') === sourceTokens.join(' ')) return 100;
  const contains = (a, b) => a.every(token => b.includes(token));
  if (contains(customerTokens, sourceTokens)) return 80 + customerTokens.length;
  const extra = customerTokens.filter(token => !sourceTokens.includes(token));
  if (contains(sourceTokens, customerTokens) && extra.length && extra.every(token => GENERIC.has(token))) return 70 + sourceTokens.length;
  return null;
};

const aliasTokenGroups = customer => {
  const raw = customer?.aliases;
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch { list = []; } }
  return list.filter(alias => typeof alias === 'string').map(alias => nameTokens(alias)).filter(tokens => tokens.length);
};
/** A registered alias (legacy brand) resolves to its customer before fuzzy name matching. */
const aliasScore = (customer, sourceTokens) => {
  for (const tokens of aliasTokenGroups(customer)) {
    if (tokens.every(token => sourceTokens.includes(token))) return 95;
  }
  return null;
};

/**
 * Conservative owner suggestion: only a matched registry Customer when the whole company
 * name lines up, or a registered legacy alias (e.g. INDOTEL → PT INDO TELEMEDIA SOLUSI);
 * otherwise the extracted company name is proposed as a new customer.
 */
export function suggestCustomer(sourceName, customers = []) {
  const proposedName = extractCustomerName(sourceName);
  if (!proposedName) return { status: 'unknown', proposedName: '', customerId: null, customerName: '', score: 0 };
  const sourceTokens = nameTokens(proposedName);
  let best = null;
  for (const customer of customers) {
    const score = aliasScore(customer, sourceTokens) ?? matchScore(customer, proposedName);
    if (!score) continue;
    if (!best || score > best.score) best = { score, customer };
  }
  if (best) return { status: 'matched', proposedName, customerId: best.customer.id, customerName: best.customer.name, score: best.score };
  return { status: 'new', proposedName, customerId: null, customerName: '', score: 0 };
}

/** Ticket `customData.company`/`Order Origin` is a usable service-company hint. */
export function suggestServiceCompany(raw, companies = []) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  const found = companies.find(company => company.code === upper || String(company.name || '').toUpperCase() === upper || (company.aliases || []).includes(upper));
  return found ? found.code : null;
}
