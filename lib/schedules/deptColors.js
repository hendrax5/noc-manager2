/**
 * Stable pastel palette for department grouping in schedule grid.
 * Same departmentId always maps to the same color.
 */
const DEPT_PALETTE = [
  { bg: "#ecfeff", header: "#a5f3fc", accent: "#0e7490", cell: "#cffafe", off: "#f0fdfa", text: "#155e75" },
  { bg: "#fef3c7", header: "#fde68a", accent: "#b45309", cell: "#fef9c3", off: "#fffbeb", text: "#92400e" },
  { bg: "#f3e8ff", header: "#e9d5ff", accent: "#7e22ce", cell: "#f5f3ff", off: "#faf5ff", text: "#6b21a8" },
  { bg: "#dcfce7", header: "#bbf7d0", accent: "#15803d", cell: "#ecfdf5", off: "#f0fdf4", text: "#166534" },
  { bg: "#ffe4e6", header: "#fecdd3", accent: "#be123c", cell: "#fff1f2", off: "#fff5f5", text: "#9f1239" },
  { bg: "#e0e7ff", header: "#c7d2fe", accent: "#4338ca", cell: "#eef2ff", off: "#f5f3ff", text: "#3730a3" },
  { bg: "#ffedd5", header: "#fed7aa", accent: "#c2410c", cell: "#fff7ed", off: "#fffaf5", text: "#9a3412" },
  { bg: "#ccfbf1", header: "#99f6e4", accent: "#0f766e", cell: "#f0fdfa", off: "#f0fdfa", text: "#115e59" },
];

export function departmentColor(departmentId) {
  const id = Number(departmentId) || 0;
  return DEPT_PALETTE[Math.abs(id) % DEPT_PALETTE.length];
}
