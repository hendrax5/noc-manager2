import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { buildOutageReport, parseOutageFilters } from '@/lib/reports/outageReport';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['Admin', 'Manager'].includes(session.user.role) && !session.user.permissions?.includes('view_reports')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const now = new Date();
  let filters;
  try {
    filters = parseOutageFilters(Object.fromEntries(new URL(req.url).searchParams), now);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  try {
    // Selection is based on the outage's start, not ticket creation/update timestamps.
    // Legacy JSON stores both WIB-local and ISO timestamps: filter dates using the shared parser.
    const tickets = await prisma.ticket.findMany({
      where: { customData: { path: ['hasDowntime'], equals: true } },
      select: {
        id: true, trackingId: true, title: true, description: true, status: true, customData: true,
        services: { select: { name: true, customer: { select: { id: true, name: true } } } },
        comments: { where: { isPublic: true }, orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, isPublic: true } },
      },
    });
    return NextResponse.json(buildOutageReport(tickets, filters, now), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error generating per-ticket outage report:', error);
    return NextResponse.json({ error: 'Gagal membuat laporan gangguan.' }, { status: 500 });
  }
}
