/** Shift fairness / ringkasan helpers (absen-compatible). */

export const WORKING_SHIFT_NAMES = Object.freeze(["S1", "S2", "S3", "S1+OC"]);

export function hoursPerShift(pola) {
  const p = String(pola || "POLA_1").toUpperCase();
  if (p === "POLA_2") return 8;
  if (p === "POLA_4" || p === "POLA_5" || p === "POLA_6") return 12;
  return 9; // POLA_1, POLA_3, unknown
}

export function summaryColumns(pola) {
  const p = String(pola || "POLA_1").toUpperCase();
  if (p === "POLA_2") {
    return [
      { key: "plainS1", label: "Plain S1" },
      { key: "oc", label: "OC" },
      { key: "s2", label: "S2" },
      { key: "off", label: "OFF" },
      { key: "lembur", label: "Lembur" },
      { key: "kerja", label: "Kerja" },
      { key: "totalHours", label: "Total Jam" },
    ];
  }
  if (p === "POLA_4" || p === "POLA_5" || p === "POLA_6") {
    return [
      { key: "s1", label: "S1" },
      { key: "s2", label: "S2" },
      { key: "off", label: "OFF" },
      { key: "lembur", label: "Lembur" },
      { key: "kerja", label: "Kerja" },
      { key: "totalHours", label: "Total Jam" },
    ];
  }
  return [
    { key: "s1", label: "S1" },
    { key: "s2", label: "S2" },
    { key: "s3", label: "S3" },
    { key: "off", label: "OFF" },
    { key: "lembur", label: "Lembur" },
    { key: "kerja", label: "Kerja" },
    { key: "totalHours", label: "Total Jam" },
  ];
}

export function isWorkingShiftName(name) {
  if (name == null || name === "" || name === "OFF") return false;
  return WORKING_SHIFT_NAMES.includes(String(name).toUpperCase());
}

/**
 * @param {{ shiftTypeId: number|null, generatedShiftTypeId: number|null, explicit?: boolean }} args
 * explicit undefined → auto; boolean → override
 */
export function computeIsLembur({ shiftTypeId, generatedShiftTypeId, explicit }) {
  if (explicit === true || explicit === false) return explicit;
  const working = shiftTypeId != null;
  const generatedOff = generatedShiftTypeId == null;
  if (!working) return false;
  return generatedOff;
}

/**
 * @param {{ pola: string, user: {id,name,email}, daysInMonth: number, cells: {shiftName:string|null, isLembur:boolean}[] }} args
 */
export function buildPersonSummary({ pola, user, daysInMonth, cells }) {
  let plainS1 = 0,
    oc = 0,
    s2 = 0,
    s3 = 0,
    off = 0,
    lembur = 0;

  for (const c of cells) {
    const name =
      c.shiftName == null || c.shiftName === ""
        ? "OFF"
        : String(c.shiftName).toUpperCase();
    if (c.isLembur) lembur++;
    if (name === "S1") plainS1++;
    else if (name === "S1+OC") oc++;
    else if (name === "S2") s2++;
    else if (name === "S3") s3++;
    else off++;
  }
  if (cells.length < daysInMonth) off += daysInMonth - cells.length;

  const kerja = plainS1 + oc + s2 + s3;
  const h = hoursPerShift(pola);
  return {
    userId: user.id,
    name: user.name || user.email || `#${user.id}`,
    plainS1,
    oc,
    s1: plainS1,
    s2,
    s3,
    off,
    lembur,
    kerja,
    totalHours: kerja * h,
  };
}

/**
 * schedules: [{ userId, user, shiftType?: { name }, shiftTypeId, isLembur }]
 */
export function buildDeptSummaries({ schedules, pola, year, month }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const byUser = new Map();
  for (const s of schedules) {
    if (!byUser.has(s.userId)) {
      byUser.set(s.userId, { user: s.user, cells: [] });
    }
    const name =
      s.shiftType?.name ?? (s.shiftTypeId == null ? "OFF" : null);
    byUser.get(s.userId).cells.push({
      shiftName: name,
      isLembur: !!s.isLembur,
    });
  }
  const rows = [...byUser.values()].map(({ user, cells }) =>
    buildPersonSummary({ pola, user, daysInMonth, cells })
  );
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name), "id"));
  return {
    pola,
    hoursPerShift: hoursPerShift(pola),
    columns: summaryColumns(pola),
    daysInMonth,
    rows,
  };
}
