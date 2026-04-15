import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  try {
    const fields = await prisma.customField.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json(fields);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    const field = await prisma.customField.create({ 
      data: { 
        name: body.name, 
        type: body.type || 'text', 
        options: body.options || null, 
        required: body.required || false,
        position: body.position || 'bottom'
      } 
    });
    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
