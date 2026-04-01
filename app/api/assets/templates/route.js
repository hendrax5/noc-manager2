import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const templates = await prisma.serviceTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { services: true } } }
    });

    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, fields } = await request.json();
    // fields: [{ name: 'BGP ASN', type: 'text' }, { name: 'Speed', type: 'number' }]
    
    const template = await prisma.serviceTemplate.create({
      data: { name, fields: fields || [] }
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Template exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
