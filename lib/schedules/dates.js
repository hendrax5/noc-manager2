/** Calendar helpers in Asia/Jakarta (WIB, UTC+7) — no external deps. */

export const SCHEDULE_TZ = "Asia/Jakarta";

export function nowInJakarta(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SCHEDULE_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10) % 24, // 24:00 edge → 0 in some engines
  };
}

/** YYYY-MM-DD from Prisma @db.Date / Date / string without local TZ shift. */
export function toDateOnlyString(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Store date-only as UTC midnight for Prisma @db.Date. */
export function dateOnlyToUtcDate(yyyyMmDd) {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

/** Next calendar month in Jakarta. month is 1–12. */
export function nextMonthPartsJakarta(from = new Date()) {
  const j = nowInJakarta(from);
  if (j.month === 12) return { year: j.year + 1, month: 1 };
  return { year: j.year, month: j.month + 1 };
}

/** Days in calendar month (month is 1–12). */
export function daysInCalendarMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Pure YYYY-MM-DD month bounds (month is 1–12), independent of client/server timezone. */
export function buildMonthDateRangeStrings(year, month) {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const lastDay = String(daysInCalendarMonth(year, month)).padStart(2, "0");
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const nextYm = `${next.year}-${String(next.month).padStart(2, "0")}`;
  return {
    monthKey: ym,
    startStr: `${ym}-01`,
    endStr: `${ym}-${lastDay}`,
    nextStartStr: `${nextYm}-01`,
  };
}

