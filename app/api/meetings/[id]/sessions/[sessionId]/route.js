import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const sessionObj = await getServerSession(authOptions);
    if (!sessionObj) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const resolvedParams = await params;
    
    const body = await req.json();
    const { content, title, scheduledFor } = body;

    const dataObj = {};
    if (content !== undefined) dataObj.content = content;
    if (title !== undefined) dataObj.title = title;
    if (scheduledFor !== undefined) dataObj.scheduledFor = new Date(scheduledFor);

    const updated = await prisma.meetingSession.update({
      where: { id: parseInt(resolvedParams.sessionId) },
      data: dataObj,
      include: { author: true, presentAttendees: true, actionItems: { include: { assignee: true, department: true } } }
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
