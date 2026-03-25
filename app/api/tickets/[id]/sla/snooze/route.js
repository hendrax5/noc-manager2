import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id);
    
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'Invalid Ticket ID' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { nextSlaDeadline: true, slaTimerMins: true, status: true }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
       return NextResponse.json({ error: 'Ticket is already resolved or closed' }, { status: 400 });
    }

    // Attempt to parse requested minutes, default to the ticket's global SLA timer or 15 mins
    const body = await req.json().catch(() => ({}));
    const snoozeMinutes = parseInt(body.minutes) || ticket.slaTimerMins || 15;

    const now = new Date();
    // If nextSlaDeadline is still in the future, we extend from that deadline
    // If it's in the past (already breached), we extend from 'now'
    const basisDate = (ticket.nextSlaDeadline && ticket.nextSlaDeadline > now) 
                      ? ticket.nextSlaDeadline 
                      : now;
                      
    const newDeadline = new Date(basisDate.getTime() + snoozeMinutes * 60000);

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        nextSlaDeadline: newDeadline
      }
    });

    // Write audit log
    await prisma.ticketHistory.create({
      data: {
        ticketId,
        action: `SLA Deadline manually snoozed/extended by ${snoozeMinutes} minutes`,
        actorId: parseInt(session.user.id)
      }
    });

    return NextResponse.json({ success: true, nextSlaDeadline: newDeadline });
  } catch (error) {
    console.error('SLA Snooze Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
