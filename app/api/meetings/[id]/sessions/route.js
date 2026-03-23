import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const body = await req.json();
    const { title, scheduledFor, content } = body;

    const newSession = await prisma.meetingSession.create({
      data: {
        title,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        content: content || "",
        meetingId: parseInt(resolvedParams.id),
        authorId: parseInt(session.user.id)
      },
      include: { author: true, presentAttendees: true, actionItems: true }
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
