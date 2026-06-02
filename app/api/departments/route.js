import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const hasPermission = session?.user?.permissions?.includes('manage_users') || session?.user?.permissions?.includes('manage_roles') || session?.user?.role === 'Admin';
    if (!session || !hasPermission) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name } = await req.json();
    const dept = await prisma.department.create({ data: { name } });
    return NextResponse.json(dept, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
