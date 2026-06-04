import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasPermission = session.user.permissions?.includes('manage_roles') || session.user.role === 'Admin';
    if (!hasPermission) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, permissions } = await req.json();
    const role = await prisma.role.create({ 
      data: { 
        name,
        permissions: permissions || []
      } 
    });
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
