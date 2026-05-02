import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, scheduleRules: true }
    });
    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('team.schedule') && !session?.user?.permissions?.includes('team.manage')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { departmentId, scheduleRules } = await req.json();

    const updated = await prisma.department.update({
      where: { id: parseInt(departmentId) },
      data: { scheduleRules: scheduleRules || null }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
