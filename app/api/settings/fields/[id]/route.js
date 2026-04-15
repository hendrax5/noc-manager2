import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    await prisma.customField.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const body = await req.json();
    
    const field = await prisma.customField.update({ 
      where: { id }, 
      data: { 
        name: body.name, 
        type: body.type, 
        options: body.options, 
        required: body.required,
        active: body.active,
        position: body.position
      } 
    });
    return NextResponse.json(field);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
