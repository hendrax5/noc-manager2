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
const distinctive = tokens => tokens.filter(token => !GENERIC.has(token));
const withLegalPrefix = name => (/^(?:PT|CV|UD|PD)\b/.test(name) ? name : name);

/** "PT JARINGAN TIANG INDONESIA GROUP-OFFICE KALIGELAN" -> "PT Jaringan Tiang Indonesia Group". */
export function extractCustomerName(raw) {
  let name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  const toRack = name.match(/\bto\s+rack\s*[:\-]?\s*(.+)$/i);
  if (toRack) name = toRack[1];
  // Bracketed prefixes/suffixes are internal tags ("[HUB]", "(COMIX)"), not the company.
  name = name.replace(/^\s*\[[^\]]*\]\s*/, '').replace(/\s*\[[^\]]*\]\s*$/, '');
  name = name.replace(/\s*[-–—]?\s*\bsite\b[\s:.\-–—/]*(.*)$/i, '');
  name = name.replace(/\s*[-–—]\s*(?:office|cabang|pop|gedung|lantai|ruang|hub|node|rack)\b.*$/i, '');
  name = name.replace(/,\s*(?:PT|CV|UD|PD)\.?\b.*$/i, '');
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

const overlapScore = (customer, source) => {
  const customerDistinct = distinctive(nameTokens(customer.name));
  const sourceDistinct = distinctive(nameTokens(source));
  const normalizedCustomer = nameTokens(customer.name).join(' ');
  const normalizedSource = nameTokens(source).join(' ');
  if (!customerDistinct.length || !sourceDistinct.length) return null;
  if (normalizedCustomer && normalizedCustomer === normalizedSource) return 100;
  const common = customerDistinct.filter(token => sourceDistinct.includes(token));
  if (!common.length) return null;
  if (customerDistinct.length >= 2 && common.length === customerDistinct.length) return 80 + common.length;
  if (customerDistinct.length === 1 && sourceDistinct.length === 1 && common[0].length >= 4) return 60 + common[0].length;
  if (common.length >= 2 && common.length / customerDistinct.length >= 0.6) return Math.round(40 + (common.length / customerDistinct.length) * 20);
  return null;
};

/**
 * Conservative owner suggestion: only a matched registry Customer when enough distinctive
 * words line up; otherwise the extracted company name is proposed as a new customer.
 */
export function suggestCustomer(sourceName, customers = []) {
  const proposedName = extractCustomerName(sourceName);
  if (!proposedName) return { status: 'unknown', proposedName: '', customerId: null, customerName: '', score: 0 };
  let best = null;
  for (const customer of customers) {
    const score = overlapScore(customer, proposedName);
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
