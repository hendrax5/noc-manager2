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
    summary: "1× S1+OC tiap hari, weekend WFH-style, cooldown OC",
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
    summary: "3 OFF per sliding 7 hari, larangan S2→S1",
  },
  {
    id: "POLA_6",
    label: "Pola 6 — 12 Jam siklus 8 hari",
    shifts: ["S1", "S2", "OFF"],
    hours: 12,
    summary: "Rotasi dinamis ~3 OFF/minggu",
  },
]);

export const SCHEDULE_FLAGS = Object.freeze(["Umum", "Kristen", "Kuliah"]);

export function isValidPola(pola) {
  return SCHEDULE_POLAS.some((p) => p.id === pola);
}
