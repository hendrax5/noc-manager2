import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ticketId = parseInt((await params).id);
    const watchers = await prisma.ticketWatcher.findMany({
      where: { ticketId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(watchers);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ticketId = parseInt((await params).id);
    const body = await req.json();
    const userId = body.userId ? parseInt(body.userId) : parseInt(session.user.id);

    const watcher = await prisma.ticketWatcher.upsert({
      where: { ticketId_userId: { ticketId, userId } },
      create: { ticketId, userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(watcher, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ticketId = parseInt((await params).id);
    const { searchParams } = new URL(req.url);
    const userId = parseInt(searchParams.get("userId") || session.user.id);

    await prisma.ticketWatcher.deleteMany({ where: { ticketId, userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
