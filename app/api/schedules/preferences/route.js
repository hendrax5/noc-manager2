import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const prefs = await prisma.userSchedulePreference.findMany({
      include: { user: { select: { id: true, name: true, email: true, location: true } }, fixedShift: true }
    });
    return NextResponse.json(prefs);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('settings.manage') && session?.user?.role !== 'Manager') return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { userId, scheduleMode, fixedShiftId, fixedOffDays } = body;
    
    const updated = await prisma.userSchedulePreference.upsert({
      where: { userId: parseInt(userId) },
      update: {
        scheduleMode,
        fixedShiftId: fixedShiftId ? parseInt(fixedShiftId) : null,
        fixedOffDays: JSON.stringify(fixedOffDays || [])
      },
      create: {
        userId: parseInt(userId),
        scheduleMode,
        fixedShiftId: fixedShiftId ? parseInt(fixedShiftId) : null,
        fixedOffDays: JSON.stringify(fixedOffDays || [])
      },
      include: { user: { select: { id: true, name: true, email: true, location: true } }, fixedShift: true }
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
