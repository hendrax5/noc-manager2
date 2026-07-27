import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import {
  generateAllDepartmentsMonth,
  generateDepartmentMonth,
} from "@/lib/schedules/generatePola";
import { isValidPola } from "@/lib/schedules/pola";

/**
 * POST /api/schedules/generate
 * Body:
 *  - mode: "pola" | "legacy" (default pola)
 *  - year, month (1-12) — preferred for pola engine
 *  - departmentId (optional) — one dept; omit = all
 *  - pola (optional override)
 *  - startDate, endDate, locationId — legacy simple generator
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const hasPermission =
      session?.user?.permissions?.includes("manage_schedules") ||
      session?.user?.role === "Admin";
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "pola";

    if (mode === "legacy") {
      return legacyGenerate(body);
    }

    let year = body.year ? parseInt(body.year, 10) : null;
    let month = body.month ? parseInt(body.month, 10) : null;

    if ((!year || !month) && body.startDate) {
      const d = new Date(body.startDate);
      year = d.getFullYear();
      month = d.getMonth() + 1;
    }

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "year and month (1-12) are required for pola generate" },
        { status: 400 }
      );
    }

    if (body.pola && !isValidPola(String(body.pola).toUpperCase())) {
      return NextResponse.json({ error: "Invalid pola" }, { status: 400 });
    }

    const polaOverride = body.pola ? String(body.pola).toUpperCase() : null;

    if (body.departmentId) {
      const result = await generateDepartmentMonth({
        departmentId: parseInt(body.departmentId, 10),
        year,
        month,
        polaOverride,
      });
      return NextResponse.json({ success: true, results: [result] });
    }

    const results = await generateAllDepartmentsMonth({
      year,
      month,
      polaOverride,
    });
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

async function legacyGenerate({ startDate, endDate, locationId }) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const shiftTypes = await prisma.shiftType.findMany({
    where: { active: true },
    orderBy: { startTime: "asc" },
  });
  if (shiftTypes.length === 0) {
    return NextResponse.json(
      { error: "No active shift types defined." },
      { status: 400 }
    );
  }

  const whereClause = locationId ? { locationId: parseInt(locationId, 10) } : {};
  const users = await prisma.user.findMany({
    where: whereClause,
    include: { schedulePreference: true },
  });

  const generatedSchedules = [];
  const userRotationState = {};
  users.forEach((u) => (userRotationState[u.id] = 0));

  let currentDate = new Date(start);
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    for (const user of users) {
      const pref = user.schedulePreference || {
        scheduleMode: "RANDOM",
        fixedOffDays: "[]",
      };
      let offDays = [];
      try {
        offDays = JSON.parse(pref.fixedOffDays);
      } catch {
        /* ignore */
      }

      let shiftToAssign = null;
      if (offDays.includes(dayOfWeek)) {
        shiftToAssign = null;
      } else if (pref.scheduleMode === "FIXED" && pref.fixedShiftId) {
        shiftToAssign = pref.fixedShiftId;
      } else if (pref.scheduleMode === "ROTATING") {
        const rotIdx = userRotationState[user.id] % shiftTypes.length;
        shiftToAssign = shiftTypes[rotIdx].id;
        userRotationState[user.id]++;
      } else {
        const randomShift =
          shiftTypes[Math.floor(Math.random() * shiftTypes.length)];
        shiftToAssign = randomShift.id;
      }

      generatedSchedules.push({
        userId: user.id,
        date: new Date(currentDate),
        shiftTypeId: shiftToAssign,
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (const sched of generatedSchedules) {
    await prisma.shiftSchedule.upsert({
      where: { userId_date: { userId: sched.userId, date: sched.date } },
      update: { shiftTypeId: sched.shiftTypeId },
      create: sched,
    });
  }

  return NextResponse.json({
    success: true,
    mode: "legacy",
    count: generatedSchedules.length,
  });
}
