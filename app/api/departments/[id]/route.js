import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const hasPermission = session?.user?.permissions?.includes('manage_departments') || session?.user?.role === 'Admin';
    if (!session || !hasPermission) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const hasPermission = session?.user?.permissions?.includes('manage_departments') || session?.user?.role === 'Admin';
    if (!session || !hasPermission) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const { name } = await req.json();
    const dept = await prisma.department.update({ where: { id }, data: { name } });
    return NextResponse.json(dept);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
