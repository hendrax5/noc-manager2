import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('team.schedule')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { startDate, endDate, locationId, departmentId } = await req.json();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      return NextResponse.json({ error: "Invalid start or end date." }, { status: 400 });
    }
    
    // Normalize to midnight UTC to prevent local timezone bleeding
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    const shiftTypes = await prisma.shiftType.findMany({ where: { active: true }, orderBy: { startTime: 'asc' }});
    if (shiftTypes.length === 0) return NextResponse.json({ error: "No active shift types defined." }, { status: 400 });

    const whereClause = {};
    if (locationId) whereClause.locationId = parseInt(locationId);
    if (departmentId) whereClause.departmentId = parseInt(departmentId);

    const users = await prisma.user.findMany({
      where: whereClause,
      include: { schedulePreference: true, department: true }
    });

    const generatedSchedules = [];
    const userRotationState = {};
    
    users.forEach(u => {
      let deptRules = {};
      try {
        if (u.department?.scheduleRules) {
          deptRules = typeof u.department.scheduleRules === 'string' ? JSON.parse(u.department.scheduleRules) : u.department.scheduleRules;
        }
      } catch (e) {}

      const workDaysBeforeOff = deptRules.workDays || 6;
      
      // Stagger the start states so not everyone gets a day off at the same time
      const allowedShiftIds = (deptRules.shiftIds && deptRules.shiftIds.length > 0) 
        ? deptRules.shiftIds 
        : shiftTypes.map(st => st.id);

      userRotationState[u.id] = {
        currentShiftIdx: u.id % allowedShiftIds.length,
        daysOnCurrentShift: u.id % workDaysBeforeOff,
        daysOffTaken: 0
      };
    });

    let currentDate = new Date(start);
    while (currentDate <= end) {
      // Use getUTCDay() since we are working with normalized UTC dates
      const dayOfWeek = currentDate.getUTCDay(); // 0 is Sunday

      for (const user of users) {
        let deptRules = {};
        try {
          if (user.department?.scheduleRules) {
            deptRules = typeof user.department.scheduleRules === 'string' ? JSON.parse(user.department.scheduleRules) : user.department.scheduleRules;
          }
        } catch (e) {}

        const deptMode = deptRules.mode || 'USER_PREF';
        const userPref = user.schedulePreference || { scheduleMode: 'RANDOM', fixedOffDays: '[]' };
        let offDays = [];
        try { offDays = JSON.parse(userPref.fixedOffDays); } catch (e) {}

        let shiftToAssign = null;

        if (deptMode === 'ROSTER_3_SHIFT') {
            const workDaysBeforeOff = deptRules.daysBeforeOff || 6;
            const offDaysCount = deptRules.offDaysCount || 2;
            const state = userRotationState[user.id];
            
            const allowedShiftIds = (deptRules.shiftIds && deptRules.shiftIds.length > 0) 
              ? deptRules.shiftIds 
              : shiftTypes.map(st => st.id);
            
            if (state.daysOnCurrentShift >= workDaysBeforeOff) {
                // Time for off days
                shiftToAssign = null;
                state.daysOffTaken = (state.daysOffTaken || 0) + 1;
                if (state.daysOffTaken >= offDaysCount) {
                    state.daysOnCurrentShift = 0;
                    state.daysOffTaken = 0;
                    state.currentShiftIdx = (state.currentShiftIdx + 1) % allowedShiftIds.length;
                }
            } else {
                shiftToAssign = allowedShiftIds[state.currentShiftIdx % allowedShiftIds.length];
                state.daysOnCurrentShift++;
            }
        } else if (deptMode === 'OFFICE_5_2' || deptMode === 'OFFICE_6_1') {
            let officeOffDays = deptMode === 'OFFICE_5_2' ? [0, 6] : [0]; 
            if (deptRules.fixedOffDays && Array.isArray(deptRules.fixedOffDays)) {
                officeOffDays = deptRules.fixedOffDays;
            }
            
            if (officeOffDays.includes(dayOfWeek) || offDays.includes(dayOfWeek)) {
                shiftToAssign = null;
            } else {
                shiftToAssign = userPref.fixedShiftId || shiftTypes[0]?.id;
            }
        } else {
            // Fallback to User_PREF
            if (offDays.includes(dayOfWeek)) {
              shiftToAssign = null;
            } else {
              if (userPref.scheduleMode === 'FIXED' && userPref.fixedShiftId) {
                shiftToAssign = userPref.fixedShiftId;
              } else if (userPref.scheduleMode === 'ROTATING') {
                const rotIdx = userRotationState[user.id].currentShiftIdx % shiftTypes.length;
                shiftToAssign = shiftTypes[rotIdx].id;
                userRotationState[user.id].currentShiftIdx++;
              } else {
                const randomShift = shiftTypes[Math.floor(Math.random() * shiftTypes.length)];
                shiftToAssign = randomShift.id;
              }
            }
        }

        generatedSchedules.push({
          userId: user.id,
          date: new Date(currentDate),
          shiftTypeId: shiftToAssign
        });
      }
      // Increment using UTC to avoid DST boundary hops
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Process parallel DB updates scaling mass schedules overriding bounds
    const BATCH_SIZE = 500;
    for (let i = 0; i < generatedSchedules.length; i += BATCH_SIZE) {
      const batch = generatedSchedules.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map(sched =>
          prisma.shiftSchedule.upsert({
            where: {
              userId_date: { userId: sched.userId, date: sched.date }
            },
            update: { shiftTypeId: sched.shiftTypeId },
            create: sched
          })
        )
      );
    }

    return NextResponse.json({ success: true, count: generatedSchedules.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
