import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const resolvedParams = await params;
    const body = await req.json();
    
    const data = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.score !== undefined) data.score = parseInt(body.score);
    if (body.active !== undefined) data.active = body.active;

    const field = await prisma.jobCategory.update({
      where: { id: parseInt(resolvedParams.id) },
      data
    });
    return NextResponse.json(field);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const resolvedParams = await params;
    await prisma.jobCategory.delete({ where: { id: parseInt(resolvedParams.id) } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
