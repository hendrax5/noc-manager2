import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    
    let where = {};
    if (customerId) where.customerId = parseInt(customerId);

    const services = await prisma.service.findMany({
      where,
      include: {
        customer: true,
        template: true,
        hops: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { tickets: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(services);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Manager')) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { customerId, templateId, name, status, customData, monthlyCost, currency, contractEnd, hops } = await request.json();
    
    const service = await prisma.service.create({
      data: {
        customerId: parseInt(customerId),
        templateId: parseInt(templateId),
        name,
        status: status || 'Active',
        customData: customData || {},
        monthlyCost: monthlyCost ? parseFloat(monthlyCost) : null,
        currency: currency || 'IDR',
        contractEnd: contractEnd ? new Date(contractEnd) : null,
        hops: {
          create: (hops || []).map((h, i) => ({
            orderIndex: i,
            location: h.location,
            deviceName: h.deviceName,
            portName: h.portName,
            description: h.description
          }))
        }
      },
      include: { hops: true }
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
