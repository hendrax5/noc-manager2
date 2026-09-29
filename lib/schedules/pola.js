/**
 * Pola catalog — mirrored from Documents/absen Shift Scheduler.
 */
export const SCHEDULE_POLAS = Object.freeze([
  {
    id: "POLA_1",
    label: "Pola 1 — Standar 3 Shift",
    shifts: ["S1", "S2", "S3", "OFF"],
    hours: 9,
    summary: "S1/S2/S3, 2 OFF / 7 hari, coverage tiap shift, fairness malam",
  },
  {
    id: "POLA_2",
    label: "Pola 2 — Core + On-Call",
    shifts: ["S1", "S2", "S1+OC", "OFF"],
    hours: 8,
    summary:
      "1 OFF weekday + 1 OFF Sabtu/Minggu per minggu, 1× S1+OC/hari; weekend 1 OC + 1 S2 (+1 S2 cadangan bergilir)",
  },
  {
    id: "POLA_3",
    label: "Pola 3 — Fleksibel S1/S2/S3",
    shifts: ["S1", "S2", "S3", "OFF"],
    hours: 9,
    summary: "Mirip Pola 1, demand S1/S2 lebih longgar",
  },
  {
    id: "POLA_4",
    label: "Pola 4 — 12 Jam (4 kerja / 3 OFF)",
    shifts: ["S1", "S2", "OFF"],
    hours: 12,
    summary: "08–20 / 20–08, 3 OFF per minggu kalender",
  },
  {
    id: "POLA_5",
    label: "Pola 5 — 12 Jam Longshift 4-3",
    shifts: ["S1", "S2", "OFF"],
    hours: 12,
    summary: "3 OFF Senin–Minggu (hard), larangan S2→S1; surplus ke S1 midweek",
  },
  {
    id: "POLA_6",
    label: "Pola 6 — 12 Jam siklus 8 hari",
    shifts: ["S1", "S2", "OFF"],
    hours: 12,
    summary: "Rotasi dinamis, 3 OFF Senin–Minggu (hard)",
  },
]);

/**
 * Shift clock times per pola. ShiftType rows (S1 08–17, S2 16–01) are shared by every
 * department, so 12-hour polas override them here.
 */
const TWELVE_HOUR_SHIFTS = Object.freeze({
  S1: { startTime: "08:00", endTime: "20:00" },
  S2: { startTime: "20:00", endTime: "08:00" },
});

export const POLA_SHIFT_TIMES = Object.freeze({
  POLA_4: TWELVE_HOUR_SHIFTS,
  POLA_5: TWELVE_HOUR_SHIFTS,
  POLA_6: TWELVE_HOUR_SHIFTS,
});

/** Clock window for `shiftName` under `pola`, or null to use the ShiftType row as-is. */
export function polaShiftWindow(pola, shiftName) {
  const byShift = POLA_SHIFT_TIMES[String(pola || "").toUpperCase()];
  return (byShift && byShift[shiftName]) || null;
}

/**
 * Shifts that add a night on-call to a day shift: working hours come from the base shift,
 * the on-call window from the combined ShiftType's own times (S1+OC 22:00–08:00).
 */
export const ON_CALL_BASE_SHIFT = Object.freeze({ "S1+OC": "S1" });

/** Polas whose Saturday/Sunday working days are WFH (Core: the non-OFF weekend day). */
const WEEKEND_WFH_POLAS = new Set(["POLA_2"]);

/** @param {string} dateStr YYYY-MM-DD */
export function isWeekendWfh(pola, dateStr) {
  if (!WEEKEND_WFH_POLAS.has(String(pola || "").toUpperCase())) return false;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

export const SCHEDULE_FLAGS = Object.freeze(["Umum", "Kristen", "Kuliah"]);

export function isValidPola(pola) {
  return SCHEDULE_POLAS.some((p) => p.id === pola);
}
