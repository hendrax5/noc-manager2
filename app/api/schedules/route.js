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

    const whereClause = {};
    if (start && end) {
      whereClause.date = { gte: new Date(start), lte: new Date(end) };
    }
    if (locationId) {
      whereClause.user = { locationId: parseInt(locationId) };
    }

    const schedules = await prisma.shiftSchedule.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, location: true } },
        shiftType: true
      },
      orderBy: { date: 'asc' }
    });
    
    return NextResponse.json(schedules);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
