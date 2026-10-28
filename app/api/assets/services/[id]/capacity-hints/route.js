import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { readServiceBandwidthMbps } from '@/lib/services/capacity';
import { adoptableCapacity } from '@/lib/services/capacityHints';
import { loadServiceCapacityHints } from '@/lib/services/capacityHistory';

/**
 * Read-only bandwidth hints for one service, parsed from its ticket history.
 * Used by the Service Work form to prefill the current/target capacity; nothing
 * is written here.
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const resolved = await params;
    const serviceId = parseInt(resolved?.id);
    if (!Number.isSafeInteger(serviceId) || serviceId < 1) return NextResponse.json({ error: 'ID layanan tidak valid.' }, { status: 400 });
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, cid: true, customData: true, status: true },
    });
    if (!service) return NextResponse.json({ error: 'Layanan tidak ditemukan.' }, { status: 404 });
    const hints = await loadServiceCapacityHints(prisma, service);
    const resolution = adoptableCapacity(hints.existing);
    const shape = (candidate) => ({
      mbps: candidate.mbps,
      kind: candidate.kind,
      confidence: candidate.confidence,
      approximate: !!candidate.approximate,
      evidence: candidate.evidence,
      source: candidate.source,
    });
    return NextResponse.json({
      serviceId: service.id,
      cid: service.cid || '',
      inventoryBandwidthMbps: readServiceBandwidthMbps(service),
      resolution: resolution.status,
      existing: hints.existing.slice(0, 8).map(shape),
      target: hints.target.slice(0, 5).map(shape),
    });
  } catch (error) {
    console.error('Capacity hints error:', error);
    return NextResponse.json({ error: 'Gagal memuat riwayat kapasitas.' }, { status: 500 });
  }
}
