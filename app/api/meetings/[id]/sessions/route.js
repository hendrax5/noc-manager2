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

    // Validate date
    let scheduledForDate = undefined;
    if (scheduledFor) {
      scheduledForDate = new Date(scheduledFor);
      if (isNaN(scheduledForDate.getTime())) {
        return NextResponse.json({ error: "Invalid scheduledFor date provided" }, { status: 400 });
      }
    }

    // Validate authorId
    const authorId = parseInt(session.user.id);
    if (isNaN(authorId)) {
      return NextResponse.json({ error: "Invalid user session" }, { status: 401 });
    }

    const newSession = await prisma.meetingSession.create({
      data: {
        title,
        scheduledFor: scheduledForDate,
        content: content || "",
        meetingId: parseInt(resolvedParams.id),
        authorId
      },
      include: { author: true, presentAttendees: true, actionItems: true }
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    console.error("POST /sessions error:", error);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
}
