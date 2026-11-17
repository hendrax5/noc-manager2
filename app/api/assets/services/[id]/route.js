import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { CidValidationError } from '@/lib/services/cid';
import { updateServiceRecord } from '@/lib/services/updateService';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolveParams = await params;

    const service = await prisma.service.findUnique({
      where: { id: parseInt(resolveParams.id) },
      include: {
        identifiers: {select:{code:true,family:true}},
        customer: true,
        template: true,
        hops: { orderBy: { orderIndex: 'asc' } },
        tickets: true
      }
    });

    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(service);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolveParams = await params;
    await prisma.service.delete({ where: { id: parseInt(resolveParams.id) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolveParams = await params;
    const body = await request.json();

    const serviceId = parseInt(resolveParams.id);
    const service = await prisma.$transaction(
      (tx) => updateServiceRecord(tx, serviceId, body, Number(session.user.id)),
      { timeout: 30000 },
    );

    return NextResponse.json({ success: true, service });
  } catch (error) {
    if (error instanceof CidValidationError) return NextResponse.json({error:error.message},{status:error.status});
    if (error.code === 'P2002') return NextResponse.json({ error: 'CID sudah digunakan oleh layanan lain.' }, { status: 409 });
    console.error('PATCH Hop Error:', error);
    return NextResponse.json({ error: 'Failed to update topology' }, { status: 500 });
  }
}
