import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = session;
    const userDept = user.department || "";
    const isCS = userDept.includes('CS') || userDept.toLowerCase().includes('customer');
    const isAdminOrManager = user.role === 'Admin' || user.role === 'Manager';

    // Only allow CS or Admins to poll this endpoint to save DB load
    if (!isCS && !isAdminOrManager) {
      return NextResponse.json({ triggerAlarm: false, count: 0 });
    }

    // Look for SLA tickets where nextSlaDeadline is <= NOW + 2 minutes
    const twoMinutesFromNow = new Date(Date.now() + 2 * 60000);

    const expiringTickets = await prisma.ticket.findMany({
      where: {
        enableSla: true,
        status: { notIn: ['Resolved', 'Closed'] },
        nextSlaDeadline: {
          lte: twoMinutesFromNow
        }
      },
      select: {
        id: true,
        trackingId: true,
        title: true,
        nextSlaDeadline: true
      }
    });

    return NextResponse.json({
      triggerAlarm: expiringTickets.length > 0,
      count: expiringTickets.length,
      tickets: expiringTickets
    });

  } catch (error) {
    console.error('SLA Alert Poller Error:', error);
    return NextResponse.json({ error: 'Failed to verify SLA alerts' }, { status: 500 });
  }
}
