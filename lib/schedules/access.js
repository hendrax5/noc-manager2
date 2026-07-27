/** Who can view / edit shift roster */

export function canViewSchedules(user) {
  return !!user;
}

/** Edit shifts, highlight, notes — Manager, Admin, or manage_schedules */
export function canEditSchedules(user) {
  if (!user) return false;
  if (user.role === "Admin" || user.role === "Manager") return true;
  return !!user.permissions?.includes("manage_schedules");
}

/** Generate pola, types, prefs, auto-gen settings */
export function canManageScheduleEngine(user) {
  if (!user) return false;
  if (user.role === "Admin") return true;
  return !!user.permissions?.includes("manage_schedules");
}

export const HIGHLIGHT_COLORS = Object.freeze([
  { id: "yellow", hex: "#fef08a", label: "Kuning" },
  { id: "green", hex: "#bbf7d0", label: "Hijau" },
  { id: "pink", hex: "#fbcfe8", label: "Pink" },
  { id: "orange", hex: "#fed7aa", label: "Oranye" },
  { id: "blue", hex: "#bfdbfe", label: "Biru" },
  { id: "purple", hex: "#e9d5ff", label: "Ungu" },
  { id: "red", hex: "#fecaca", label: "Merah" },
  { id: "clear", hex: null, label: "Hapus stabilo" },
]);
