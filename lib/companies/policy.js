import { DEFAULT_COMPANIES, normalizeCompany as normalize } from './registry.js';

export const COMPANY_OPTIONS = DEFAULT_COMPANIES
  .filter(item => item.active && item.serviceSelectable)
  .map(item => item.code);

export function normalizeCompany(value = 'ION') {
  return normalize(value, DEFAULT_COMPANIES);
}

export function companyForDepartment(name) {
  const normalized = String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return normalized === 'nocdatacenter' ? 'SDC' : 'ION';
}
