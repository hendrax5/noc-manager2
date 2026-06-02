import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      include: { role: true }
    });

    if (!dbUser || dbUser.role.name !== 'Admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

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
