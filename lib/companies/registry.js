export const COMPANY_GROUPS = ['ION', 'SDC', 'Sistercompany'];

export const DEFAULT_COMPANIES = [
  { code: 'ION', name: 'ION', group: 'ION', aliases: [], active: true, serviceSelectable: true },
  { code: 'SDC', name: 'SDC', group: 'SDC', aliases: ['PRODC', 'NOC DATACENTER'], active: true, serviceSelectable: true },
  { code: 'INDOTEL', name: 'PT Indo Telemedia Solusi', group: 'ION', aliases: ['INDO TELEMEDIA'], active: true, serviceSelectable: true },
  { code: 'ALCEN', name: 'Alcen', group: 'Sistercompany', aliases: ['ALCEN'], active: true, serviceSelectable: true },
  { code: 'CMD', name: 'CMD', group: 'Sistercompany', aliases: ['CMD'], active: true, serviceSelectable: true },
  { code: 'SISTER', name: 'Sistercompany', group: 'Sistercompany', aliases: ['SISTER COMPANY', 'SYSTERCOMPANY'], active: true, serviceSelectable: false },
];

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,19}$/;

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase().replace(/\s+/g, '_');
}

function normalizeGroup(value, code) {
  const wanted = normalizeText(value).toLowerCase();
  const found = COMPANY_GROUPS.find(group => group.toLowerCase() === wanted);
  if (found) return found;
  if (code === 'ION' || code === 'SDC') return code;
  return 'ION';
}

function normalizeAliases(value, code) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const alias = normalizeText(item).toUpperCase().replace(/\s+/g, ' ');
    if (!alias || alias === code || seen.has(alias)) continue;
    seen.add(alias);
    result.push(alias);
  }
  return result;
}

export function sanitizeCompanies(input) {
  if (!Array.isArray(input)) return null;
  const byCode = new Map();
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const code = normalizeCode(item.code);
    if (!CODE_PATTERN.test(code)) continue;
    const entry = {
      code,
      name: normalizeText(item.name) || code,
      group: normalizeGroup(item.group, code),
      aliases: normalizeAliases(item.aliases, code),
      active: item.active !== false,
      serviceSelectable: item.serviceSelectable !== false,
    };
    byCode.set(code, { ...(byCode.get(code) || {}), ...entry });
  }
  if (!byCode.size) return null;
  const list = [...byCode.values()];
  const codes = new Set(list.map(item => item.code));
  const aliasOwner = new Map();
  for (const item of list) {
    for (const alias of item.aliases) {
      if (codes.has(alias)) throw new Error(`Alias "${alias}" bentrok dengan kode perusahaan lain.`);
      if (aliasOwner.has(alias) && aliasOwner.get(alias) !== item.code) {
        throw new Error(`Alias "${alias}" dipakai lebih dari satu perusahaan.`);
      }
      aliasOwner.set(alias, item.code);
    }
  }
  return list;
}

export function parseCompanyNames(text) {
  const names = String(text || '').split(',').map(item => item.trim()).filter(Boolean);
  if (!names.length) return null;
  const result = [];
  for (const name of names) {
    const upper = name.toUpperCase();
    const known = DEFAULT_COMPANIES.find(item =>
      item.code === normalizeCode(name) || item.name.toUpperCase() === upper || item.aliases.includes(upper));
    if (known) {
      if (!result.some(item => item.code === known.code)) result.push({ ...known });
      continue;
    }
    const code = normalizeCode(name).slice(0, 20) || `COMPANY_${result.length + 1}`;
    if (result.some(item => item.code === code)) continue;
    result.push({ code, name, group: normalizeGroup('', code), aliases: [], active: true, serviceSelectable: true });
  }
  return result.length ? result : null;
}

export function companiesFromConfig(config = {}) {
  const stored = sanitizeCompanies(config.companies);
  if (stored) return stored;
  const parsed = parseCompanyNames(config.companyNames);
  return parsed || DEFAULT_COMPANIES.map(item => ({ ...item }));
}

export function normalizeCompany(value, companies = DEFAULT_COMPANIES) {
  const raw = normalizeText(value);
  if (!raw) return 'ION';
  const upper = raw.toUpperCase();
  const code = normalizeCode(raw);
  const found = companies.find(item =>
    item.code === code || item.name.toUpperCase() === upper || item.aliases.includes(upper));
  if (found) return found.code;
  const allowed = companies.filter(item => item.active).map(item => item.code).join(', ');
  throw new Error(`Perusahaan layanan harus salah satu dari: ${allowed || 'ION, SDC'}.`);
}

export function companyOptions(companies, { serviceOnly = false } = {}) {
  return companies
    .filter(item => item.active && (!serviceOnly || item.serviceSelectable))
    .map(item => ({ value: item.code, label: item.name || item.code, group: item.group }));
}

export function companyNamesText(companies) {
  return companies.filter(item => item.active).map(item => item.name || item.code).join(', ');
}
