import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const types = await prisma.shiftType.findMany({ orderBy: { startTime: 'asc' } });
    return NextResponse.json(types);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('team.schedule')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, startTime, endTime } = await req.json();
    const st = await prisma.shiftType.create({ data: { name, startTime, endTime } });
    return NextResponse.json(st, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
