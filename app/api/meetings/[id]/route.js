import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const meeting = await prisma.meeting.findUnique({
      where: { id: parseInt(resolvedParams.id) },
      include: {
        organizedBy: { select: { name: true, email: true } },
        attendees: true,
        sessions: { 
          include: { author: true, presentAttendees: true, actionItems: { include: { assignee: true, department: true } } }, 
          orderBy: { scheduledFor: 'asc' } 
        },
        actionItems: { include: { assignee: true, department: true } }
      }
    });
    if (!meeting) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    return NextResponse.json(meeting);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const resolvedParams = await params;
    const body = await req.json();
    
    const { title, status, agenda, problems, solutions, scheduledAt, attendees } = body;
    
    const dataObj = { title, status, agenda, problems, solutions };
    if (scheduledAt) dataObj.scheduledAt = new Date(scheduledAt);
    
    if (attendees) {
      dataObj.attendees = { set: attendees.map(id => ({ id: parseInt(id) })) };
    }

    const meeting = await prisma.meeting.update({
      where: { id: parseInt(resolvedParams.id) },
      data: dataObj,
      include: { attendees: true, actionItems: true }
    });
    return NextResponse.json(meeting);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes('settings.manage')) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const resolvedParams = await params;
    await prisma.meeting.delete({ where: { id: parseInt(resolvedParams.id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
