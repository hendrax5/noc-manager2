/**
 * Distinct cell colors per shift code so S1 / S2 / OFF are easy to scan.
 * Manager highlightColor (stabilo) still overrides when set.
 */
const SHIFT_COLORS = {
  S1: { bg: "#93c5fd", text: "#1e3a8a", label: "S1" }, // biru — pagi
  S2: { bg: "#fdba74", text: "#9a3412", label: "S2" }, // oranye — siang
  S3: { bg: "#c4b5fd", text: "#5b21b6", label: "S3" }, // ungu — malam
  "S1+OC": { bg: "#5eead4", text: "#115e59", label: "S1+OC" },
  OFF: { bg: "#e2e8f0", text: "#64748b", label: "Libur / OFF" },
};

export const SHIFT_COLOR_LEGEND = Object.freeze([
  SHIFT_COLORS.S1,
  SHIFT_COLORS.S2,
  SHIFT_COLORS.S3,
  SHIFT_COLORS["S1+OC"],
  SHIFT_COLORS.OFF,
]);

/**
 * @param {string|null|undefined} shiftName — e.g. "S1", "S2", or null for OFF
 * @returns {{ bg: string, text: string, label: string }}
 */
export function shiftCellColor(shiftName) {
  if (shiftName == null || shiftName === "" || String(shiftName).toUpperCase() === "OFF") {
    return SHIFT_COLORS.OFF;
  }
  const key = String(shiftName).trim().toUpperCase();
  // normalize s1+oc variants
  const normalized = key === "S1+OC" || key === "S1OC" ? "S1+OC" : key;
  return (
    SHIFT_COLORS[normalized] || {
      bg: "#f1f5f9",
      text: "#334155",
      label: shiftName,
    }
  );
}
