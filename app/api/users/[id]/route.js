import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const body = await req.json();

    const data = {
      name: body.name,
      email: body.email,
      roleId: parseInt(body.roleId),
      departmentId: parseInt(body.departmentId)
    };

    if (body.password) {
      data.password = body.password;
    }

    const user = await prisma.user.update({
      where: { id },
      data
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
