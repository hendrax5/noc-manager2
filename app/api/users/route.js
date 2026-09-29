import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { hashPassword, omitPassword } from "@/lib/auth/password";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      include: { role: true }
    });

    const hasPermission = dbUser?.role?.permissions?.includes('manage_users') || dbUser?.role?.name === 'Admin';
    if (!dbUser || !hasPermission) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { email, name, password, roleId, departmentId } = await req.json();
    if (!password || !String(password).trim()) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    const user = await prisma.user.create({ 
      data: { 
        email, 
        name, 
        password: await hashPassword(password),
        roleId: parseInt(roleId), 
        departmentId: parseInt(departmentId) 
      } 
    });
    return NextResponse.json(omitPassword(user), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
