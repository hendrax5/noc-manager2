import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { withCustomerCode } from '@/lib/customers/identity';
import {recordActivity} from '@/lib/activity/recordActivity';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const customers = await prisma.customer.findMany({
      where: includeArchived ? {} : { active: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { services: true } },
        mergedAliases: { select: { id: true, name: true, archivedAt: true } },
        mergedInto: { select: { id: true, name: true } },
      }
    });

    return NextResponse.json(customers.map(withCustomerCode));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const contactEmail = typeof body?.contactEmail === 'string' ? body.contactEmail.trim() || null : null;
    const contactPhone = typeof body?.contactPhone === 'string' ? body.contactPhone.trim() || null : null;
    if (!name) return NextResponse.json({ error: 'Nama customer wajib diisi.' }, { status: 400 });

    const existing = await prisma.customer.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      include: { mergedInto: { select: { id: true, name: true } } },
    });
    if (existing) {
      if (existing.active === false && existing.mergedInto) {
        return NextResponse.json({
          error: `Nama customer "${existing.name}" sudah diarsipkan dan digabung ke ${existing.mergedInto.name}.`,
        }, { status: 409 });
      }
      return NextResponse.json({ error: 'Customer already exists' }, { status: 400 });
    }

    const customer = await prisma.$transaction(async tx=>{
      const created=await tx.customer.create({
        data:{name,contactEmail,contactPhone},
        include: {
          _count: { select: { services: true } },
          mergedAliases: { select: { id: true, name: true, archivedAt: true } },
        },
      });
      await recordActivity(tx,{actorId:Number(session.user.id),source:'human',type:'customer.created',entityType:'customer',entityId:created.id,after:created});
      return created;
    });

    return NextResponse.json(withCustomerCode(customer));
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Customer already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
