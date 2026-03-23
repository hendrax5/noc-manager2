import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch distinct historical locations
    const locationsRaw = await prisma.circuitHop.findMany({ select: { location: true }, distinct: ['location'] });
    // Fetch distinct historical device names
    const devicesRaw = await prisma.circuitHop.findMany({ select: { deviceName: true }, distinct: ['deviceName'] });
    // Fetch distinct historical port names
    const portsRaw = await prisma.circuitHop.findMany({ select: { portName: true }, distinct: ['portName'] });

    const locations = locationsRaw.map(r => r.location).filter(Boolean);
    const devices = devicesRaw.map(r => r.deviceName).filter(Boolean);
    const ports = portsRaw.map(r => r.portName).filter(Boolean);

    return NextResponse.json({ locations, devices, ports });
  } catch (error) {
    console.error('Topology Hints Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
