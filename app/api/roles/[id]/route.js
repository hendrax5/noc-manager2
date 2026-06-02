import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasPermission = session.user.permissions?.includes('manage_roles') || session.user.permissions?.includes('manage_users') || session.user.role === 'Admin';
    if (!hasPermission) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    await prisma.role.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasPermission = session.user.permissions?.includes('manage_roles') || session.user.permissions?.includes('manage_users') || session.user.role === 'Admin';
    if (!hasPermission) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const { name, permissions } = await req.json();
    
    const data = {};
    if (name !== undefined) data.name = name;
    if (permissions !== undefined) data.permissions = permissions;

    const role = await prisma.role.update({ where: { id }, data });
    return NextResponse.json(role);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
