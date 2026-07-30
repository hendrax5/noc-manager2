import { prisma } from "@/lib/prisma";
import { isValidPola } from "@/lib/schedules/pola";
import {
  dateOnlyToUtcDate,
  nextMonthPartsJakarta,
  toDateOnlyString,
} from "@/lib/schedules/dates";

const SHIFT_DEFS = [
  { name: "S1", startTime: "08:00", endTime: "17:00" },
  { name: "S2", startTime: "16:00", endTime: "01:00" },
  { name: "S3", startTime: "00:00", endTime: "09:00" },
  // On-call overnight (absen POLA_2)
  { name: "S1+OC", startTime: "22:00", endTime: "08:00" },
];

/** Soft minimum headcount before calling OR-Tools (avoids opaque solver errors). */
export const POLA_MIN_STAFF = Object.freeze({
  POLA_1: 3,
  POLA_2: 3,
  POLA_3: 3,
  POLA_4: 4,
  POLA_5: 4,
  POLA_6: 3,
});

export async function ensureShiftTypes() {
  const existing = await prisma.shiftType.findMany();
  const byName = Object.fromEntries(existing.map((s) => [s.name, s]));
  for (const def of SHIFT_DEFS) {
    if (!byName[def.name]) {
      byName[def.name] = await prisma.shiftType.create({
        data: { ...def, active: true },
      });
    } else if (
      def.name === "S1+OC" &&
      (byName[def.name].startTime === "08:00" && byName[def.name].endTime === "08:00")
    ) {
      byName[def.name] = await prisma.shiftType.update({
        where: { id: byName[def.name].id },
        data: { startTime: def.startTime, endTime: def.endTime },
      });
    }
  }
  return byName;
}

export function solverUrl() {
  return (process.env.SHIFT_SOLVER_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function checkSolverHealth() {
  try {
    const res = await fetch(`${solverUrl()}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
    where: {
      departmentId,
      // Managers are office/S1-oriented — exclude from POLA pool (avoid night/OC).
      // Assign manually or FIXED→S1 preference if they must appear on roster.
      role: { name: { not: "Manager" } },
    },
    select: { id: true, name: true, email: true, scheduleFlag: true },
    orderBy: { name: "asc" },
  });
  if (users.length === 0) {
    return {
      departmentId,
      department: dept.name,
      pola,
      count: 0,
      skipped: true,
      reason: "no users (Manager role excluded from POLA)",
    };
  }

  const minStaff = POLA_MIN_STAFF[pola] ?? 3;
  if (users.length < minStaff) {
    throw Object.assign(
      new Error(
        `${dept.name}: butuh minimal ${minStaff} user untuk ${pola} (saat ini ${users.length}). Tambah anggota dept atau pilih pola lain.`
      ),
      { status: 400 }
    );
  }

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const prevStart = dateOnlyToUtcDate(
    `${prev.year}-${String(prev.month).padStart(2, "0")}-01`
  );
  const prevEnd = dateOnlyToUtcDate(`${year}-${String(month).padStart(2, "0")}-01`);

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
    date: toDateOnlyString(r.date),
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
      const parsed = JSON.parse(detail);
      detail = parsed.detail || detail;
      if (Array.isArray(detail)) detail = detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
    } catch {
      /* keep text */
    }
    let msg = String(detail);
    if (/tidak dapat menemukan jadwal/i.test(msg)) {
      msg = `${dept.name} (${pola}, ${users.length} user): solver tidak menemukan jadwal feasible. Coba pola lain (mis. POLA_1 / POLA_5) atau sesuaikan jumlah anggota roster.`;
    }
    throw Object.assign(new Error(msg), { status: 400 });
  }

  const data = await res.json();
  const nameToId = Object.fromEntries(
    Object.values(shiftTypes).map((s) => [s.name, s.id])
  );

  let written = 0;
  for (const row of data.schedules || []) {
    const shiftName = row.shift === "OFF" ? null : row.shift;
    const shiftTypeId = shiftName ? nameToId[shiftName] ?? null : null;
    const dateStr = toDateOnlyString(row.date);
    if (!dateStr) continue;
    const date = dateOnlyToUtcDate(dateStr);
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
 * Generate for all schedule-enabled departments for a given year/month.
 */
export async function generateAllDepartmentsMonth({ year, month, polaOverride = null }) {
  const departments = await prisma.department.findMany({
    where: { scheduleEnabled: true },
    orderBy: { name: "asc" },
  });
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

/** @deprecated use nextMonthPartsJakarta */
export function nextMonthParts(from = new Date()) {
  return nextMonthPartsJakarta(from);
}

export { nextMonthPartsJakarta };
