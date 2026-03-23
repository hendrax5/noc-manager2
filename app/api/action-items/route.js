import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

function generateTrackingId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nums = "0123456789";
  const p1 = Array.from({length:3}, () => letters[Math.floor(Math.random()*letters.length)]).join('');
  const p2 = Array.from({length:4}, () => nums[Math.floor(Math.random()*nums.length)]).join('');
  const p3 = Array.from({length:2}, () => letters[Math.floor(Math.random()*letters.length)]).join('');
  return `${p1}-${p2}-${p3}`;
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { task, meetingId, meetingSessionId, assigneeId, departmentId, dueDate, generateTicket } = body;
    
    let linkedTicketId = undefined;
    if (generateTicket) {
      let targetDeptId = departmentId ? parseInt(departmentId) : null;
      if (!targetDeptId && assigneeId) {
        const u = await prisma.user.findUnique({ where: { id: parseInt(assigneeId) } });
        if (u) targetDeptId = u.departmentId;
      }
      
      const meeting = await prisma.meeting.findUnique({ where: { id: parseInt(meetingId) } });

      const newTicket = await prisma.ticket.create({
        data: {
          trackingId: generateTrackingId(),
          title: `[Meeting Action] ${task.length > 50 ? task.substring(0, 50) + '...' : task}`,
          description: `This ticket was automatically generated from a meeting action item.\n\n**Origin Meeting:** ${meeting.title}\n**Task:** ${task}`,
          status: "New",
          priority: "Medium",
          departmentId: targetDeptId || 1, // Fallback if no department somehow
          assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
          historyLogs: {
            create: { action: 'Ticket systemically instantiated from Meeting Control Room' }
          }
        }
      });
      linkedTicketId = newTicket.id;
    }

    const actionItem = await prisma.actionItem.create({
      data: { 
        task, 
        meetingId: parseInt(meetingId),
        meetingSessionId: meetingSessionId ? parseInt(meetingSessionId) : undefined,
        assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        linkedTicketId
      },
      include: { assignee: true, department: true }
    });
    
    return NextResponse.json(actionItem, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const items = await prisma.actionItem.findMany({
      where: {
        OR: [
          { assigneeId: parseInt(session.user.id) },
          { departmentId: parseInt(session.user.departmentId) }
        ],
        status: "Pending"
      },
      include: { meeting: true, assignee: true, department: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
