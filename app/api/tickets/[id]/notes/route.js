import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticketId = parseInt(id);

  const notes = await prisma.ticketNote.findMany({
    where: { ticketId },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(notes);
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticketId = parseInt(id);
  const body = await request.json();

  const { content, noteType } = body;

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const validTypes = ["internal", "follow_up", "escalation", "customer_update"];
  const finalType = validTypes.includes(noteType) ? noteType : "internal";

  const note = await prisma.ticketNote.create({
    data: {
      ticketId,
      authorId: parseInt(session.user.id),
      content: content.trim(),
      noteType: finalType
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } }
    }
  });

  return NextResponse.json(note, { status: 201 });
}
