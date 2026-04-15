import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('team.schedule')) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    
    const resolvedParams = await params;
    const body = await req.json();
    
    const target = await prisma.shiftType.update({
      where: { id: parseInt(resolvedParams.id) },
      data: body
    });
    return NextResponse.json(target);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('team.schedule')) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    
    const resolvedParams = await params;
    await prisma.shiftType.delete({ where: { id: parseInt(resolvedParams.id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
