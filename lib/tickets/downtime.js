/**
 * Outage / downtime helpers (Asia/Jakarta wall clock).
 * Stored values are typically datetime-local strings (YYYY-MM-DDTHH:mm) meaning WIB.
 */

export const DOWNTIME_TZ = "Asia/Jakarta";

/** Hard cap — catches year typos (e.g. 2025→2026 = 525600 menit). */
export const MAX_DOWNTIME_DAYS = 90;
export const MAX_DOWNTIME_MINUTES = MAX_DOWNTIME_DAYS * 24 * 60;

/** @returns {Date|null} */
export function parseDowntimeDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = String(value).trim();
  if (!s) return null;

  // Bare datetime-local → interpret as WIB (UTC+7)
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)
  ) {
    const withSec = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
    const d = new Date(`${withSec}+07:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format Date / stored value for <input type="datetime-local"> (WIB, no seconds). */
export function toDatetimeLocalValue(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const bare = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (bare && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) return bare[1];

  const d = parseDowntimeDate(value);
  if (!d) return "";

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: DOWNTIME_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  const hour = String(parseInt(parts.hour, 10) % 24).padStart(2, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Current instant as datetime-local in WIB. */
export function nowDatetimeLocal(now = new Date()) {
  return toDatetimeLocalValue(now);
}

/**
 * Duration between start and end (or `now` if end missing and live=true).
 * @returns {{ minutes: number, text: string, ongoing: boolean } | { error: string } | null}
 */
export function getDowntimeDuration(startRaw, endRaw, { live = false, now = new Date() } = {}) {
  const start = parseDowntimeDate(startRaw);
  if (!start) return null;

  let end = parseDowntimeDate(endRaw);
  let ongoing = false;
  if (!end) {
    if (!live) return null;
    end = now instanceof Date ? now : new Date(now);
    ongoing = true;
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    return { error: "Waktu selesai tidak boleh sebelum waktu mulai!" };
  }

  const minutes = Math.floor(diffMs / 60000);
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const text = `${hrs > 0 ? `${hrs} jam ` : ""}${mins} menit (${minutes} menit)${
    ongoing ? " — masih berjalan" : ""
  }`;
  return { minutes, text, ongoing };
}

/**
 * Effective downtime minutes for reports.
 * Uses stored end, else live now (ongoing), else 0.
 */
export function effectiveDowntimeMinutes(customData, { now = new Date() } = {}) {
  const cd = customData && typeof customData === "object" ? customData : {};
  if (!cd.hasDowntime && !cd.startDowntime) return 0;
  if (!cd.startDowntime) return 0;

  const duration = getDowntimeDuration(cd.startDowntime, cd.endDowntime, {
    live: true,
    now,
  });
  if (!duration || duration.error) {
    const stored = parseInt(cd.downtimeMinutes, 10);
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }
  return duration.minutes;
}

/**
 * Normalize / validate downtime fields inside customData.
 * @returns {{ ok: true, customData: object } | { ok: false, error: string }}
 */
export function normalizeDowntimeCustomData(customData, { now = new Date() } = {}) {
  const base =
    customData && typeof customData === "object" && !Array.isArray(customData)
      ? { ...customData }
      : {};

  const hasDowntime = !!base.hasDowntime;
  if (!hasDowntime) {
    base.hasDowntime = false;
    base.startDowntime = null;
    base.endDowntime = null;
    base.downtimeMinutes = 0;
    return { ok: true, customData: base };
  }

  const startRaw = base.startDowntime;
  if (!startRaw || !String(startRaw).trim()) {
    return { ok: false, error: "Mulai Downtime wajib diisi jika Catat Outage aktif." };
  }

  const start = parseDowntimeDate(startRaw);
  if (!start) {
    return { ok: false, error: "Format Mulai Downtime tidak valid." };
  }

  const startLocal = toDatetimeLocalValue(startRaw);
  let endLocal = base.endDowntime ? toDatetimeLocalValue(base.endDowntime) : null;

  if (endLocal) {
    const end = parseDowntimeDate(endLocal);
    if (!end) {
      return { ok: false, error: "Format Selesai Downtime tidak valid." };
    }
    if (end.getTime() < start.getTime()) {
      return { ok: false, error: "Waktu selesai tidak boleh sebelum waktu mulai!" };
    }
  } else {
    endLocal = null;
  }

  const duration = getDowntimeDuration(startLocal, endLocal, { live: false });
  const minutes =
    endLocal && duration && !duration.error
      ? duration.minutes
      : 0;

  if (endLocal && minutes > MAX_DOWNTIME_MINUTES) {
    return {
      ok: false,
      error: `Durasi downtime ${minutes} menit (>${MAX_DOWNTIME_DAYS} hari). Periksa tahun/tanggal Mulai & Selesai — sering typo tahun (mis. 2025 vs 2026).`,
    };
  }

  base.hasDowntime = true;
  base.startDowntime = startLocal;
  base.endDowntime = endLocal;
  base.downtimeMinutes = minutes;
  return { ok: true, customData: base };
}

/**
 * Minutes of outage overlapping [rangeStart, rangeEnd] (Date objects).
 * Ongoing outages use `now` (capped to rangeEnd).
 */
export function downtimeMinutesInRange(customData, rangeStart, rangeEnd, { now = new Date() } = {}) {
  const cd = customData && typeof customData === "object" ? customData : {};
  if (!cd.hasDowntime || !cd.startDowntime) return 0;
  const start = parseDowntimeDate(cd.startDowntime);
  if (!start) return 0;
  let end = parseDowntimeDate(cd.endDowntime);
  if (!end) end = now;
  const rs = rangeStart instanceof Date ? rangeStart : new Date(rangeStart);
  const re = rangeEnd instanceof Date ? rangeEnd : new Date(rangeEnd);
  const cappedStart = start < rs ? rs : start;
  const cappedEnd = end > re ? re : end;
  const ms = cappedEnd - cappedStart;
  if (ms <= 0) return 0;
  return Math.floor(ms / 60000);
}

/**
 * If ticket is resolving and outage has start but no end, close outage at `now` (WIB).
 */
export function closeOpenDowntimeOnResolve(customData, { now = new Date() } = {}) {
  const base =
    customData && typeof customData === "object" && !Array.isArray(customData)
      ? { ...customData }
      : {};
  if (!base.hasDowntime || !base.startDowntime || base.endDowntime) {
    return { changed: false, customData: base };
  }
  const endLocal = nowDatetimeLocal(now);
  const normalized = normalizeDowntimeCustomData(
    { ...base, endDowntime: endLocal },
    { now }
  );
  if (!normalized.ok) {
    return { changed: false, customData: base };
  }
  return { changed: true, customData: normalized.customData };
}
