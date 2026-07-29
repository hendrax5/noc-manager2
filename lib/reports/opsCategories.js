/**
 * Job Category name → Ops Report bucket.
 * Matching is case-insensitive substring / alias list.
 */

const UPGRADE = ["upgrade", "upgrades"];
const NEW_CUSTOMER = [
  "installation",
  "installasi",
  "new install",
  "new customer",
  "aktivasi",
  "activation",
  "provisioning",
];
const TERMINATE = [
  "termination",
  "terminate",
  "terminated",
  "dismantle",
  "dismantling",
  "churn",
  "deaktivasi",
  "deactivation",
];

function norm(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function matches(name, aliases) {
  const n = norm(name);
  if (!n) return false;
  return aliases.some((a) => n === a || n.includes(a));
}

/** @returns {"upgrade"|"new"|"terminate"|null} */
export function opsBucketFromCategory(categoryName) {
  if (matches(categoryName, UPGRADE)) return "upgrade";
  if (matches(categoryName, NEW_CUSTOMER)) return "new";
  if (matches(categoryName, TERMINATE)) return "terminate";
  return null;
}

export const DOWNTIME_THRESHOLD_MINUTES = 10 * 60; // 10 hours
