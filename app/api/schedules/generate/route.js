import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('settings.manage') && session?.user?.role !== 'Manager') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { startDate, endDate, locationId } = await req.json();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const shiftTypes = await prisma.shiftType.findMany({ where: { active: true }, orderBy: { startTime: 'asc' }});
    if (shiftTypes.length === 0) return NextResponse.json({ error: "No active shift types defined." }, { status: 400 });

    const whereClause = locationId ? { locationId: parseInt(locationId) } : {};
    const users = await prisma.user.findMany({
      where: whereClause,
      include: { schedulePreference: true }
    });

    const generatedSchedules = [];
    const userRotationState = {};
    users.forEach(u => userRotationState[u.id] = 0);

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay(); // 0 is Sunday

      for (const user of users) {
        const pref = user.schedulePreference || { scheduleMode: 'RANDOM', fixedOffDays: '[]' };
        let offDays = [];
        try { offDays = JSON.parse(pref.fixedOffDays); } catch (e) {}

        let shiftToAssign = null;

        // Constraint 1: Fixed Off Days overriding natively
        if (offDays.includes(dayOfWeek)) {
          shiftToAssign = null; // Explicit Libur
        } else {
          // Constraint 2: Modalities mapping
          if (pref.scheduleMode === 'FIXED' && pref.fixedShiftId) {
            shiftToAssign = pref.fixedShiftId;
          } else if (pref.scheduleMode === 'ROTATING') {
            const rotIdx = userRotationState[user.id] % shiftTypes.length;
            shiftToAssign = shiftTypes[rotIdx].id;
            userRotationState[user.id]++;
          } else {
            // RANDOM mode
            const randomShift = shiftTypes[Math.floor(Math.random() * shiftTypes.length)];
            shiftToAssign = randomShift.id;
          }
        }

        generatedSchedules.push({
          userId: user.id,
          date: new Date(currentDate),
          shiftTypeId: shiftToAssign
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process parallel DB updates scaling mass schedules overriding bounds
    for (const sched of generatedSchedules) {
      await prisma.shiftSchedule.upsert({
        where: {
          userId_date: { userId: sched.userId, date: sched.date }
        },
        update: { shiftTypeId: sched.shiftTypeId },
        create: sched
      });
    }

    return NextResponse.json({ success: true, count: generatedSchedules.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
