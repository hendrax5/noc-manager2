import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  try {
    const fields = await prisma.jobCategory.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json(fields);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasPermission = session.user.permissions?.includes('manage_settings') || session.user.role === 'Admin';
    if (!hasPermission) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const field = await prisma.jobCategory.create({
      data: {
        name: body.name,
        score: parseInt(body.score) || 0,
        active: body.active !== false
      }
    });
    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
