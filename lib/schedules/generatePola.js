import { prisma } from "@/lib/prisma";
import { isValidPola } from "@/lib/schedules/pola";

const SHIFT_DEFS = [
  { name: "S1", startTime: "08:00", endTime: "17:00" },
  { name: "S2", startTime: "16:00", endTime: "01:00" },
  { name: "S3", startTime: "00:00", endTime: "09:00" },
  { name: "S1+OC", startTime: "08:00", endTime: "08:00" },
];

export async function ensureShiftTypes() {
  const existing = await prisma.shiftType.findMany();
  const byName = Object.fromEntries(existing.map((s) => [s.name, s]));
  for (const def of SHIFT_DEFS) {
    if (!byName[def.name]) {
      byName[def.name] = await prisma.shiftType.create({
        data: { ...def, active: true },
      });
    }
  }
  return byName;
}

function solverUrl() {
  return (process.env.SHIFT_SOLVER_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

/**
 * Generate one month of schedules for users in a department using OR-Tools pola engine.
 */
export async function generateDepartmentMonth({
  departmentId,
  year,
  month,
  polaOverride = null,
}) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) throw Object.assign(new Error("Department not found"), { status: 404 });

  const pola = (polaOverride || dept.schedulePola || "POLA_1").toUpperCase();
  if (!isValidPola(pola)) {
    throw Object.assign(new Error(`Invalid pola: ${pola}`), { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: { departmentId },
    select: { id: true, name: true, email: true, scheduleFlag: true },
    orderBy: { name: "asc" },
  });
  if (users.length === 0) {
    return { departmentId, pola, count: 0, skipped: true, reason: "no users" };
  }

  // Previous month history (continuity)
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const prevStart = new Date(Date.UTC(prev.year, prev.month - 1, 1));
  const prevEnd = new Date(Date.UTC(year, month - 1, 1)); // exclusive = first of target month

  const shiftTypes = await ensureShiftTypes();
  const idToName = Object.fromEntries(
    Object.values(shiftTypes).map((s) => [s.id, s.name])
  );

  const prevRows = await prisma.shiftSchedule.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      date: { gte: prevStart, lt: prevEnd },
    },
  });

  const history = prevRows.map((r) => ({
    employee_id: r.userId,
    date: r.date.toISOString().slice(0, 10),
    shift: r.shiftTypeId ? idToName[r.shiftTypeId] || "OFF" : "OFF",
  }));

  const payload = {
    year,
    month,
    pola,
    employees: users.map((u) => ({
      id: u.id,
      name: u.name || u.email || `user-${u.id}`,
      religion: u.scheduleFlag || "Umum",
    })),
    history,
  };

  const res = await fetch(`${solverUrl()}/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.parse(detail).detail || detail;
    } catch {
      /* keep text */
    }
    throw Object.assign(new Error(String(detail)), { status: 400 });
  }

  const data = await res.json();
  const nameToId = Object.fromEntries(
    Object.values(shiftTypes).map((s) => [s.name, s.id])
  );

  let written = 0;
  for (const row of data.schedules || []) {
    const shiftName = row.shift === "OFF" ? null : row.shift;
    const shiftTypeId = shiftName ? nameToId[shiftName] ?? null : null;
    const date = new Date(`${row.date}T00:00:00.000Z`);
    await prisma.shiftSchedule.upsert({
      where: { userId_date: { userId: row.userId, date } },
      update: { shiftTypeId },
      create: { userId: row.userId, date, shiftTypeId },
    });
    written++;
  }

  return { departmentId, department: dept.name, pola, count: written };
}

/**
 * Generate for all departments for a given year/month.
 */
export async function generateAllDepartmentsMonth({ year, month, polaOverride = null }) {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const results = [];
  for (const dept of departments) {
    try {
      const r = await generateDepartmentMonth({
        departmentId: dept.id,
        year,
        month,
        polaOverride,
      });
      results.push({ ok: true, ...r });
    } catch (err) {
      results.push({
        ok: false,
        departmentId: dept.id,
        department: dept.name,
        error: err.message,
      });
    }
  }
  return results;
}

/** Next calendar month from a Date (local). month is 1–12. */
export function nextMonthParts(from = new Date()) {
  const y = from.getFullYear();
  const m = from.getMonth(); // 0-based
  if (m === 11) return { year: y + 1, month: 1 };
  return { year: y, month: m + 2 };
}
