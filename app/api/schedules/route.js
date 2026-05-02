import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const locationId = searchParams.get("locationId");
    const departmentId = searchParams.get("departmentId");

    const whereClause = {};
    if (start && end) {
      whereClause.date = { gte: new Date(start), lte: new Date(end) };
    }
    
    if (locationId || departmentId) {
      whereClause.user = {};
      if (locationId) whereClause.user.locationId = parseInt(locationId);
      if (departmentId) whereClause.user.departmentId = parseInt(departmentId);
    }

    const schedules = await prisma.shiftSchedule.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, location: true, department: true } },
        shiftType: true
      },
      orderBy: { date: 'asc' }
    });
    
    return NextResponse.json(schedules);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('team.schedule')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId, date, shiftTypeId } = await req.json();

    if (!userId || !date) {
      return NextResponse.json({ error: "userId and date are required" }, { status: 400 });
    }

    // Upsert the specific schedule
    const updated = await prisma.shiftSchedule.upsert({
      where: {
        userId_date: {
          userId: parseInt(userId),
          date: new Date(date)
        }
      },
      update: {
        shiftTypeId: shiftTypeId ? parseInt(shiftTypeId) : null
      },
      create: {
        userId: parseInt(userId),
        date: new Date(date),
        shiftTypeId: shiftTypeId ? parseInt(shiftTypeId) : null
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('team.schedule')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const locationId = searchParams.get("locationId");
    const departmentId = searchParams.get("departmentId");

    if (!start || !end) {
      return NextResponse.json({ error: "start and end dates are required" }, { status: 400 });
    }

    const whereClause = {
      date: { gte: new Date(start), lte: new Date(end) }
    };
    
    if (locationId || departmentId) {
      whereClause.user = {};
      if (locationId) whereClause.user.locationId = parseInt(locationId);
      if (departmentId) whereClause.user.departmentId = parseInt(departmentId);
    }

    const deleted = await prisma.shiftSchedule.deleteMany({
      where: whereClause
    });

    return NextResponse.json({ success: true, count: deleted.count });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
