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

    const body = await req.json();
    const email = body.email?.toLowerCase();
    const { name, password, roleId, departmentId } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check for existing user (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (existing) {
      return NextResponse.json({ error: `User with email ${email} already exists.` }, { status: 400 });
    }

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
