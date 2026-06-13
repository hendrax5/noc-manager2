import { prisma } from './prisma';

const DEFAULT_CONFIG = {
  appName: "NOC Manager",
  loginTitle: "Welcome to NOC Manager",
  loginSubtitle: "Sign in to access your dashboard",
  sidebarLogoText: "NOC",
  primaryColor: "#0f172a",
  companyNames: "ION, SDC, Sistercompany",
  externalApiKey: "",
  geminiApiKey: "",
  geminiModel: "gemini-1.5-flash",
  deptCompanyMap: {},
  deptAutoRouteMap: {}
};

export async function getAppConfig() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'global_config' } });
    if (!setting) {
       await prisma.appSetting.create({ data: { key: 'global_config', value: JSON.stringify(DEFAULT_CONFIG) } });
       return DEFAULT_CONFIG;
    }
    return JSON.parse(setting.value);
  } catch (error) {
    console.error("Config Read Error (Prisma):", error);
    return DEFAULT_CONFIG;
  }
}

export async function updateAppConfig(newConfig) {
  try {
    const current = await getAppConfig();
    const merged = { ...current, ...newConfig };
    await prisma.appSetting.upsert({
      where: { key: 'global_config' },
      update: { value: JSON.stringify(merged) },
      create: { key: 'global_config', value: JSON.stringify(merged) }
    });
    return merged;
  } catch (error) {
    console.error("Config Write Error (Prisma):", error);
    throw error;
  }
}
