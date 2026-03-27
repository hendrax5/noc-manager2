import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const meetings = await prisma.meeting.findMany({
      include: {
        organizedBy: { select: { name: true, email: true } },
        attendees: { select: { id: true, name: true, email: true } }
      },
      orderBy: { scheduledAt: 'asc' }
    });
    return NextResponse.json(meetings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { title, agenda, problems, scheduledAt, attendees, visibility, permittedDepartmentIds } = body;
    
    let initialSessions = [];
    if (agenda || problems) {
      initialSessions.push({
        title: "Kickoff Sync",
        scheduledFor: new Date(scheduledAt),
        content: `${agenda ? `**Agenda Topics:**\n${agenda}\n\n` : ''}${problems ? `**Known Bottlenecks:**\n${problems}` : ''}`,
        authorId: parseInt(session.user.id)
      });
    }

    const meeting = await prisma.meeting.create({
      data: { 
        title, 
        agenda, 
        problems,
        scheduledAt: new Date(scheduledAt),
        organizedById: parseInt(session.user.id),
        visibility: visibility || "Public",
        attendees: attendees?.length > 0 ? {
          connect: attendees.map(id => ({ id: parseInt(id) }))
        } : undefined,
        permittedDepartments: visibility === 'Restricted' && permittedDepartmentIds?.length > 0 ? {
          connect: permittedDepartmentIds.map(id => ({ id: parseInt(id) }))
        } : undefined,
        sessions: initialSessions.length > 0 ? { create: initialSessions } : undefined
      }
    });
    
    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
