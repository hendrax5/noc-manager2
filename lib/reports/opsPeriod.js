/**
 * Ops Report period helpers (week Mon–Sun, calendar month).
 * Uses local timezone of the server process; display labels are ISO dates.
 */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toDateOnly(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday 00:00 of the week containing `ref` */
export function weekRangeContaining(ref = new Date()) {
  const d = startOfDay(ref);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: startOfDay(start), end: endOfDay(end), label: "week" };
}

export function monthRangeContaining(ref = new Date()) {
  const d = new Date(ref);
  const start = startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { start, end, label: "month" };
}

/**
 * @param {"week"|"month"} period
 * @param {string|null} anchor — YYYY-MM-DD inside the desired period
 */
export function resolveOpsPeriod(period, anchor = null) {
  const ref = anchor ? new Date(`${anchor}T12:00:00`) : new Date();
  const range = period === "month" ? monthRangeContaining(ref) : weekRangeContaining(ref);
  return {
    period: period === "month" ? "month" : "week",
    start: range.start,
    end: range.end,
    startDate: toDateOnly(range.start),
    endDate: toDateOnly(range.end),
  };
}

export { toDateOnly };
