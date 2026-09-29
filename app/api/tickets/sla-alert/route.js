import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { listSlaAlerts } from '@/lib/reports/dashboard';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = session;
    const isCS = user.department?.includes('CS') || user.department?.toLowerCase().includes('customer');
    const isAdminOrManager = user.role === 'Admin' || user.permissions?.includes('manage_sla') || user.permissions?.includes('manage_tickets') || user.permissions?.includes('view_reports');

    // Only allow CS or Admins to poll this endpoint to save DB load
    if (!isCS && !isAdminOrManager) {
      return NextResponse.json({ triggerAlarm: false, count: 0 });
    }

    return NextResponse.json(await listSlaAlerts({ withinMins: 2 }));
  } catch (error) {
    console.error('SLA Alert Poller Error:', error);
    return NextResponse.json({ error: 'Failed to verify SLA alerts' }, { status: 500 });
  }
}
