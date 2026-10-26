/**
 * Downtime editing is an operational action: the CS desk and the ticket PIC need it
 * without being granted the broad "edit ticket" permission (which would also allow
 * editing the subject, classification and affected services).
 */

import { getDowntimeDuration, MAX_DOWNTIME_DAYS, MAX_DOWNTIME_MINUTES } from "./downtime.js";

const DOWNTIME_PERMISSIONS = [
  "manage_sla",
  "manage_tickets",
  "modify_tickets",
  "edit_other_tickets",
];

export function canEditDowntime(user, { assigneeId, creatorId } = {}) {
  if (!user) return false;
  const role = user.role;
  if (role === "Admin" || role === "Manager") return true;
  const department = String(user.department || "");
  if (department.includes("CS") || department.toLowerCase().includes("customer")) return true;
  const permissions = user.permissions || [];
  if (permissions.some((permission) => DOWNTIME_PERMISSIONS.includes(permission))) return true;
  const userId = Number(user.id);
  if (!Number.isFinite(userId)) return false;
  const isOwner = Number(assigneeId) === userId || Number(creatorId) === userId;
  if (isOwner) return true;
  // `edit_own_tickets` never extends to tickets owned by someone else.
  return false;
}

/**
 * Merge downtime fields into customData. An empty start+end clears the outage.
 * Values keep the datetime-local shape already used by the forms, so existing
 * reporting helpers keep working unchanged.
 */
export function applyDowntimeEdit(customData, { start, end } = {}, now = new Date()) {
  const base =
    customData && typeof customData === "object" && !Array.isArray(customData) ? { ...customData } : {};
  const startValue = start === null || start === undefined ? "" : String(start).trim();
  const endValue = end === null || end === undefined ? "" : String(end).trim();

  if (!startValue && !endValue) {
    return {
      ok: true,
      customData: { ...base, hasDowntime: false, startDowntime: null, endDowntime: null, downtimeMinutes: 0 },
    };
  }
  if (!startValue) return { ok: false, error: "Waktu mulai downtime wajib diisi." };

  const duration = getDowntimeDuration(startValue, endValue || null, { live: !endValue, now });
  if (!duration || duration.error) return { ok: false, error: duration?.error || "Waktu downtime tidak valid." };
  if (duration.minutes > MAX_DOWNTIME_MINUTES) {
    return { ok: false, error: `Durasi downtime melebihi batas ${MAX_DOWNTIME_DAYS} hari. Periksa tanggal mulai/selesai.` };
  }

  return {
    ok: true,
    customData: {
      ...base,
      hasDowntime: true,
      startDowntime: startValue,
      endDowntime: endValue || null,
      downtimeMinutes: duration.minutes || 0,
    },
  };
}
