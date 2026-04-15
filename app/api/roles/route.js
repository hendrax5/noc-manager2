import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { name } = await req.json();
    const role = await prisma.role.create({ data: { name } });
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
