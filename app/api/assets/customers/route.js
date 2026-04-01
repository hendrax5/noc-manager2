import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { services: true } }
      }
    });

    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, contactEmail, contactPhone } = await request.json();
    const customer = await prisma.customer.create({
      data: { name, contactEmail, contactPhone }
    });

    return NextResponse.json(customer);
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Customer already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
