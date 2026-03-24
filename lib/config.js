import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'app-config.json');

const DEFAULT_CONFIG = {
  appName: "NOC Manager",
  loginTitle: "Welcome to NOC Manager",
  loginSubtitle: "Sign in to access your dashboard",
  sidebarLogoText: "NOC",
  primaryColor: "#0f172a",
  companyNames: "ION, SDC, Sistercompany"
};

export function getAppConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Config Read Error:", error);
    return DEFAULT_CONFIG;
  }
}

export function updateAppConfig(newConfig) {
  try {
    const current = getAppConfig();
    const merged = { ...current, ...newConfig };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
    return merged;
  } catch (error) {
    console.error("Config Write Error:", error);
    throw error;
  }
}
