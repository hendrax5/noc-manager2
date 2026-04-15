import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

// GET /api/users?q=search — Search users
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    const where = q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    } : {};

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: { select: { name: true } }, department: { select: { name: true } } },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('team.manage')) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { email, name, password, roleId, departmentId } = await req.json();
    const user = await prisma.user.create({ 
      data: { 
        email, 
        name, 
        password,
        roleId: parseInt(roleId), 
        departmentId: parseInt(departmentId) 
      } 
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
