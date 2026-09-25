import { prisma } from "@/lib/prisma";
import { toDateOnlyString } from "@/lib/schedules/dates";

function parseDayBound(value, endOfDay = false) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const err = new Error("Invalid date; use YYYY-MM-DD or ISO-8601");
    err.status = 400;
    throw err;
  }
  if (endOfDay && String(value).length <= 10) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

export function publicScheduleDto(row) {
  return {
    id: row.id,
    date: toDateOnlyString(row.date) || row.date,
    shift: row.shiftType?.name || "OFF",
    shiftTypeId: row.shiftTypeId || null,
    isLembur: !!row.isLembur,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          departmentId: row.user.departmentId ?? row.user.department?.id ?? null,
          department: row.user.department?.name || null,
        }
      : null,
  };
}

/**
 * List shift schedules for Integration API.
 * Requires start + end (inclusive date range).
 */
export async function listSchedulesForIntegration(query = {}) {
  const start = parseDayBound(query.start, false);
  const end = parseDayBound(query.end, true);
  if (!start || !end) {
    const err = new Error("start and end are required (YYYY-MM-DD)");
    err.status = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error("start must be <= end");
    err.status = 400;
    throw err;
  }

  const where = {
    date: { gte: start, lte: end },
  };

  const userWhere = {};
  if (query.departmentId) {
    const id = parseInt(query.departmentId, 10);
    if (!Number.isFinite(id)) {
      const err = new Error("Invalid departmentId");
      err.status = 400;
      throw err;
    }
    userWhere.departmentId = id;
  }
  if (query.locationId) {
    const id = parseInt(query.locationId, 10);
    if (!Number.isFinite(id)) {
      const err = new Error("Invalid locationId");
      err.status = 400;
      throw err;
    }
    userWhere.locationId = id;
  }
  if (query.userId) {
    const id = parseInt(query.userId, 10);
    if (!Number.isFinite(id)) {
      const err = new Error("Invalid userId");
      err.status = 400;
      throw err;
    }
    userWhere.id = id;
  }
  if (Object.keys(userWhere).length) {
    where.user = userWhere;
  }

  const rows = await prisma.shiftSchedule.findMany({
    where,
    include: {
      shiftType: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { userId: "asc" }],
  });

  return {
    start: toDateOnlyString(start),
    end: toDateOnlyString(end),
    count: rows.length,
    schedules: rows.map(publicScheduleDto),
  };
}

export async function listShiftTypesForIntegration() {
  const types = await prisma.shiftType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, startTime: true, endTime: true, active: true },
  });
  return { types };
}
