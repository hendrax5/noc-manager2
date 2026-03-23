import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { wipeTransactional, wipeAssets, wipeUsers } = await req.json();

    // 1. Transactional Data (Tickets, History, Attachments, Comments, Meetings, ActionItems, Reports)
    if (wipeTransactional) {
      await prisma.attachment.deleteMany();
      await prisma.comment.deleteMany();
      await prisma.ticketHistory.deleteMany();
      await prisma.actionItem.deleteMany();
      await prisma.meetingSession.deleteMany();
      await prisma.meeting.deleteMany();
      await prisma.dailyReport.deleteMany();
      await prisma.shiftSchedule.deleteMany();
      await prisma.userSchedulePreference.deleteMany();
      // Services connect to tickets, so wipe them or disconnect them. Actually wiping tickets cascades.
      await prisma.ticket.deleteMany();
    }

    // 2. Asset Data (Customers, Templates, Services, CircuitHops)
    if (wipeAssets) {
      await prisma.circuitHop.deleteMany();
      await prisma.service.deleteMany();
      await prisma.customer.deleteMany();
      await prisma.serviceTemplate.deleteMany();
    }

    // 3. User Data (Delete all users EXCEPT the currently logged in Admin)
    if (wipeUsers) {
       // Only wipe users if they are not the active session user
       await prisma.user.deleteMany({
          where: {
             id: { not: parseInt(session.user.id) }
          }
       });
    }

    return NextResponse.json({ success: true, message: 'Wipe operation completed successfully' });

  } catch (error) {
    console.error('Database Wipe Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
