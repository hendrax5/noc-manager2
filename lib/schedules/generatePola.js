import { prisma } from "@/lib/prisma";
import { POLA_MIN_STAFF, isValidPola } from "@/lib/schedules/pola";
import {
  dateOnlyToUtcDate,
  nextMonthPartsJakarta,
  toDateOnlyString,
} from "@/lib/schedules/dates";
import {
  STANDBY_HIGHLIGHT,
  STANDBY_NOTE,
  isManuallyProtectedCell,
  isRosterEligibleUser,
  partitionDepartmentMonthRows,
} from "@/lib/schedules/protection";

export { STANDBY_HIGHLIGHT, STANDBY_NOTE, POLA_MIN_STAFF };

const SHIFT_DEFS = [
  { name: "S1", startTime: "08:00", endTime: "17:00" },
  { name: "S2", startTime: "16:00", endTime: "01:00" },
  { name: "S3", startTime: "00:00", endTime: "09:00" },
  // On-call overnight (absen POLA_2)
  { name: "S1+OC", startTime: "22:00", endTime: "08:00" },
];

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
      byName[def.name].startTime === "08:00" &&
      byName[def.name].endTime === "08:00"
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

function monthBoundsUtc(year, month) {
  const monthStart = dateOnlyToUtcDate(
    `${year}-${String(month).padStart(2, "0")}-01`
  );
  const next =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const monthEnd = dateOnlyToUtcDate(
    `${next.year}-${String(next.month).padStart(2, "0")}-01`
  );
  return { monthStart, monthEnd };
}

/**
 * Preview department roster impact before generating or regenerating a month.
 */
export async function previewDepartmentMonth({ departmentId, year, month }) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) throw Object.assign(new Error("Department not found"), { status: 404 });

  const { monthStart, monthEnd } = monthBoundsUtc(year, month);
  const members = await prisma.user.findMany({
    where: { departmentId },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      scheduleEligible: true,
      role: { select: { name: true } },
    },
  });
  const memberIds = members.map((m) => m.id);
  const existingRows =
    memberIds.length === 0
      ? []
      : await prisma.shiftSchedule.findMany({
          where: {
            userId: { in: memberIds },
            date: { gte: monthStart, lt: monthEnd },
          },
          select: {
            id: true,
            userId: true,
            date: true,
            shiftTypeId: true,
            generatedShiftTypeId: true,
            isLembur: true,
            manualEdited: true,
            highlightColor: true,
            note: true,
            noteUpdatedBy: true,
          },
        });

  const manualProtectedCount = existingRows.filter(isManuallyProtectedCell).length;
  const eligibleUsers = members.filter(isRosterEligibleUser);
  const resignedCount = members.filter((m) => m.active === false).length;
  const nonShiftCount = members.filter(
    (m) => m.active !== false && !isRosterEligibleUser(m)
  ).length;

  return {
    departmentId: dept.id,
    department: dept.name,
    pola: (dept.schedulePola || "POLA_1").toUpperCase(),
    scheduleEnabled: dept.scheduleEnabled !== false,
    existingCount: existingRows.length,
    manualProtectedCount,
    eligibleUserCount: eligibleUsers.length,
    resignedCount,
    nonShiftCount,
  };
}

export async function previewAllDepartmentsMonth({ year, month, departmentId = null }) {
  const departments = await prisma.department.findMany({
    where: departmentId
      ? { id: parseInt(departmentId, 10) }
      : { scheduleEnabled: true },
    orderBy: { name: "asc" },
  });
  return Promise.all(
    departments.map((d) =>
      previewDepartmentMonth({ departmentId: d.id, year, month })
    )
  );
}

/**
 * Generate one month of schedules for eligible active users in a department using OR-Tools pola engine.
 * - `skipIfExists`: if true, skips any department that already has rows in the target month.
 * - `overwriteMode`:
 *    - `"preserve_manual"` (default): keeps manually edited/annotated/lembur cells intact, updates
 *      unedited rows, and cleans unedited rows of resigned/non-eligible users.
 *    - `"force_all"`: replaces all rows in the department month.
 */
export async function generateDepartmentMonth({
  departmentId,
  year,
  month,
  polaOverride = null,
  skipIfExists = false,
  overwriteMode = "preserve_manual",
}) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) throw Object.assign(new Error("Department not found"), { status: 404 });

  const pola = (polaOverride || dept.schedulePola || "POLA_1").toUpperCase();
  if (!isValidPola(pola)) {
    throw Object.assign(new Error(`Invalid pola: ${pola}`), { status: 400 });
  }

  const deptMembers = await prisma.user.findMany({
    where: { departmentId },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      scheduleEligible: true,
      scheduleFlag: true,
      role: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  const deptUserIds = deptMembers.map((u) => u.id);
  const { monthStart, monthEnd } = monthBoundsUtc(year, month);

  const existingRows =
    deptUserIds.length === 0
      ? []
      : await prisma.shiftSchedule.findMany({
          where: {
            userId: { in: deptUserIds },
            date: { gte: monthStart, lt: monthEnd },
          },
          select: {
            id: true,
            userId: true,
            date: true,
            shiftTypeId: true,
            generatedShiftTypeId: true,
            isLembur: true,
            manualEdited: true,
            highlightColor: true,
            note: true,
            noteUpdatedBy: true,
          },
        });

  if (skipIfExists && existingRows.length > 0) {
    return {
      departmentId,
      department: dept.name,
      pola,
      count: 0,
      existingCount: existingRows.length,
      preservedCount: existingRows.length,
      cleared: 0,
      skipped: true,
      reason: "already_exists",
    };
  }

  // Only active, shift-eligible, non-Manager users with valid email enter the roster pool.
  const users = deptMembers.filter(isRosterEligibleUser);

  if (users.length === 0) {
    const plan = partitionDepartmentMonthRows({
      existingRows,
      generatedRows: [],
      overwriteMode,
    });
    if (plan.deleteIds.length > 0) {
      await prisma.shiftSchedule.deleteMany({
        where: { id: { in: plan.deleteIds } },
      });
    }
    return {
      departmentId,
      department: dept.name,
      pola,
      count: 0,
      preservedCount: plan.preservedCount,
      cleared: plan.deletedCount,
      skipped: true,
      reason: "no_eligible_users",
    };
  }

  const minStaff = POLA_MIN_STAFF[pola] ?? 3;
  if (users.length < minStaff) {
    throw Object.assign(
      new Error(
        `${dept.name}: butuh minimal ${minStaff} user aktif shift untuk ${pola} (saat ini ${users.length}). Tambah anggota aktif atau pilih pola lain.`
      ),
      { status: 400 }
    );
  }

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const prevStart = dateOnlyToUtcDate(
    `${prev.year}-${String(prev.month).padStart(2, "0")}-01`
  );
  const prevEnd = monthStart;

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

  const toSolverRow = (r) => ({
    employee_id: r.userId,
    date: toDateOnlyString(r.date),
    shift: r.shiftTypeId ? idToName[r.shiftTypeId] || "OFF" : "OFF",
    standby: r.note === STANDBY_NOTE,
  });
  const history = prevRows.map(toSolverRow);

  // Already-generated start of next month, so the Mon–Sun week spanning month end keeps its OFF quota.
  const nextRows = await prisma.shiftSchedule.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      date: { gte: monthEnd, lt: new Date(monthEnd.getTime() + 6 * 24 * 60 * 60 * 1000) },
    },
  });
  const future = nextRows.map(toSolverRow);

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
    future,
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
      if (Array.isArray(detail)) {
        detail = detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
      }
    } catch {
      /* keep text */
    }
    let msg = String(detail);
    if (/tidak dapat menemukan jadwal/i.test(msg)) {
      msg = `${dept.name} (${pola}, ${users.length} user aktif): solver tidak menemukan jadwal feasible. Coba pola lain (mis. POLA_1 / POLA_5) atau sesuaikan jumlah anggota roster.`;
    }
    throw Object.assign(new Error(msg), { status: 400 });
  }

  const data = await res.json();
  const nameToId = Object.fromEntries(
    Object.values(shiftTypes).map((s) => [s.name, s.id])
  );

  const generatedRows = [];
  for (const row of data.schedules || []) {
    const shiftName = row.shift === "OFF" ? null : row.shift;
    const shiftTypeId = shiftName ? nameToId[shiftName] ?? null : null;
    const dateStr = toDateOnlyString(row.date);
    if (!dateStr) continue;
    generatedRows.push({
      userId: row.userId,
      date: dateOnlyToUtcDate(dateStr),
      shiftTypeId,
      generatedShiftTypeId: shiftTypeId,
      isLembur: false,
      manualEdited: false,
      ...(row.standby
        ? { highlightColor: STANDBY_HIGHLIGHT, note: STANDBY_NOTE }
        : {}),
    });
  }

  const plan = partitionDepartmentMonthRows({
    existingRows,
    generatedRows,
    overwriteMode,
  });

  await prisma.$transaction(async (tx) => {
    if (plan.deleteIds.length > 0) {
      await tx.shiftSchedule.deleteMany({
        where: { id: { in: plan.deleteIds } },
      });
    }
    if (plan.creates.length > 0) {
      await tx.shiftSchedule.createMany({ data: plan.creates });
    }
  });

  return {
    departmentId,
    department: dept.name,
    pola,
    count: plan.createdCount,
    preservedCount: plan.preservedCount,
    cleared: plan.deletedCount,
    overwriteMode: plan.overwriteMode,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}

/**
 * Generate for all schedule-enabled departments for a given year/month.
 */
export async function generateAllDepartmentsMonth({
  year,
  month,
  polaOverride = null,
  skipIfExists = false,
  overwriteMode = "preserve_manual",
}) {
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
        skipIfExists,
        overwriteMode,
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
