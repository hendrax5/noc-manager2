import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { checkServiceCid } from '@/lib/services/cidLookup';
import { CidValidationError } from '@/lib/services/cid';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolveParams = await params;

    const service = await prisma.service.findUnique({
      where: { id: parseInt(resolveParams.id) },
      include: {
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
    let serviceCid;
    if (body.cid !== undefined || body.customData !== undefined) {
      const existing = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true, cid: true, customData: true } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      try { serviceCid = await checkServiceCid(prisma, { cid: body.cid === undefined ? existing.cid : body.cid, customData: body.customData === undefined ? existing.customData : body.customData }, serviceId); }
      catch (error) { if (error instanceof CidValidationError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
    }
    
    // Update core fields if provided
    if (body.name || body.status || body.customData || body.cid !== undefined) {
      const updateData = {};
      if (serviceCid !== undefined) updateData.cid = serviceCid;
      if (body.name) updateData.name = body.name;
      if (body.status) updateData.status = body.status;
      if (body.customData) updateData.customData = body.customData;
      
      await prisma.service.update({
        where: { id: serviceId },
        data: updateData
      });
    }

    // Update hops if explicitly provided in body
    if (body.hops) {
      // Wipe existing hops & replace cleanly
      await prisma.circuitHop.deleteMany({ where: { serviceId } });

      if (body.hops.length > 0) {
        const hopData = body.hops.map((h, index) => ({
          serviceId,
          orderIndex: index,
          location: h.location,
          deviceName: h.deviceName,
          portName: h.portName,
          description: h.description
        }));
        await prisma.circuitHop.createMany({ data: hopData });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'CID sudah digunakan oleh layanan lain.' }, { status: 409 });
    console.error('PATCH Hop Error:', error);
    return NextResponse.json({ error: 'Failed to update topology' }, { status: 500 });
  }
}
