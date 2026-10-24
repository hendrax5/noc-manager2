/**
 * Canonical ticket domain constants (P0+).
 * Legacy Hesk-style labels are normalized via normalizeStatus().
 */

export const TICKET_STATUSES = Object.freeze([
  "New",
  "Open",
  "In Progress",
  "Pending",
  "On Hold",
  "Finish",
  "Resolved",
  "Closed",
]);

/** Statuses shown by default in list filters (active work). */
export const DEFAULT_FILTER_STATUSES = Object.freeze([
  "New",
  "Open",
  "In Progress",
  "Pending",
  "On Hold",
  "Finish",
]);

export const TERMINAL_STATUSES = Object.freeze(["Resolved", "Closed"]);

export const OPEN_STATUSES = Object.freeze(
  TICKET_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s))
);

/** Map legacy / Hesk labels → canonical. */
export const LEGACY_STATUS_MAP = Object.freeze({
  "Waiting Reply": "Pending",
  Replied: "Open",
  waiting_reply: "Pending",
  replied: "Open",
  "in progress": "In Progress",
  "on hold": "On Hold",
});

export const TICKET_PRIORITIES = Object.freeze(["Low", "Medium", "High", "Critical"]);

export const TICKET_TYPES = Object.freeze(["Incident", "Problem", "Change", "Request"]);

export const STATUS_COLORS = Object.freeze({
  New: { bg: "var(--ui-danger-bg)", color: "var(--ui-danger)", border: "var(--ui-danger)" },
  Open: { bg: "var(--ui-info-bg)", color: "var(--ui-info)", border: "var(--ui-info)" },
  "In Progress": { bg: "var(--ui-tint)", color: "var(--ui-accent)", border: "var(--ui-accent)" },
  Pending: { bg: "var(--ui-warning-bg)", color: "var(--ui-warning)", border: "var(--ui-warning)" },
  "On Hold": { bg: "var(--ui-subtle)", color: "var(--ui-text)", border: "var(--ui-control-line)" },
  Finish: { bg: "var(--ui-success-bg)", color: "var(--ui-success)", border: "var(--ui-success)" },
  Resolved: { bg: "var(--ui-success-bg)", color: "var(--ui-success)", border: "var(--ui-success)" },
  Closed: { bg: "var(--ui-subtle)", color: "var(--ui-text)", border: "var(--ui-control-line)" },
});

export function statusStyle(raw) {
 const tone=STATUS_COLORS[normalizeStatus(raw)]||{bg:'var(--ui-subtle)',color:'var(--ui-text)',border:'var(--ui-control-line)'};
 return {backgroundColor:tone.bg,color:tone.color,borderColor:tone.border};
}

export function normalizeStatus(raw) {
  if (!raw || typeof raw !== "string") return "New";
  const trimmed = raw.trim();
  if (TICKET_STATUSES.includes(trimmed)) return trimmed;
  if (LEGACY_STATUS_MAP[trimmed]) return LEGACY_STATUS_MAP[trimmed];
  const lower = trimmed.toLowerCase();
  const byLower = TICKET_STATUSES.find((s) => s.toLowerCase() === lower);
  if (byLower) return byLower;
  if (LEGACY_STATUS_MAP[trimmed]) return LEGACY_STATUS_MAP[trimmed];
  return trimmed;
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(normalizeStatus(status));
}

export function isOpenStatus(status) {
  return !isTerminalStatus(status);
}

/** Expand a filter list so legacy DB rows still match (until migrated). */
export function expandStatusesForQuery(statuses) {
  if (!statuses || statuses.length === 0) return statuses;
  const set = new Set();
  for (const s of statuses) {
    const n = normalizeStatus(s);
    set.add(n);
    set.add(s);
    // Reverse aliases so old rows still appear when filtering by canonical
    if (n === "Pending") set.add("Waiting Reply");
    if (n === "Open") set.add("Replied");
  }
  return [...set];
}

export function assertValidStatus(status) {
  const n = normalizeStatus(status);
  if (!TICKET_STATUSES.includes(n)) {
    throw new Error(`Invalid ticket status: ${status}`);
  }
  return n;
}
