import { getAppConfig } from '../config.js';
import { companiesFromConfig, normalizeCompany as normalize } from './registry.js';

export async function getCompanies() {
  const config = await getAppConfig();
  return companiesFromConfig(config);
}

export async function normalizeCompanyAsync(value) {
  const companies = await getCompanies();
  return normalize(value, companies);
}
