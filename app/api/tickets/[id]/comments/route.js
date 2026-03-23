import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { text, attachmentUrl, attachmentName } = body;
    const userId = parseInt(session.user.id);

    const commentData = {
      text,
      ticketId,
      authorId: userId,
    };

    if (attachmentUrl) {
      commentData.attachments = {
        create: { filename: attachmentName || "attached_file", url: attachmentUrl, uploadedBy: userId }
      };
    }

    const comment = await prisma.comment.create({ data: commentData });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { assigneeId: true, status: true, department: true } });
    
    let newStatus = ticket.status;
    let transitionReason = "Reply appended to thread";

    if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
      if (body.actionType === 'finish') {
        newStatus = 'Pending CS Confirmation';
        transitionReason = "Marked as Finished, awaiting CS validation";
      } else {
        const isStaffReply = (userId === ticket.assigneeId) || session.user.role === 'Admin' || session.user.role === 'Manager' || session.user.department?.includes('CS');
        if (isStaffReply) {
          newStatus = 'Pending';
          transitionReason = "Auto-shifted to Pending (Awaiting User)";
        } else {
          newStatus = 'Open';
          transitionReason = "Auto-shifted to Open (Awaiting Staff)";
        }
      }
    }

    if (newStatus !== ticket.status) {
      await prisma.ticket.update({ where: { id: ticketId }, data: { status: newStatus } });
    }

    await prisma.ticketHistory.create({
      data: { ticketId, action: transitionReason, actorId: userId }
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
