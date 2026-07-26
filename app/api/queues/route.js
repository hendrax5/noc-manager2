import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const queues = await prisma.ticketQueue.findMany({
      where: { active: true },
      include: { department: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(queues);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "Admin" && session.user.role !== "Manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const queue = await prisma.ticketQueue.create({
      data: {
        name: body.name,
        departmentId: body.departmentId ? parseInt(body.departmentId) : null,
        skillTags: Array.isArray(body.skillTags)
          ? JSON.stringify(body.skillTags)
          : body.skillTags || "[]",
        active: body.active !== false,
      },
    });
    return NextResponse.json(queue, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
