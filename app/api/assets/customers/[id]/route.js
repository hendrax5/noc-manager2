import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { withCustomerCode } from '@/lib/customers/identity';

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolveParams = await params;
    const body = await request.json();
    const id = parseInt(resolveParams.id);

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Customer tidak ditemukan.' }, { status: 404 });
    if (existing.active === false) {
      return NextResponse.json({ error: 'Customer berstatus arsip tidak dapat diedit.' }, { status: 409 });
    }

    const updateData = {};
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail ? String(body.contactEmail).trim() : null;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone ? String(body.contactPhone).trim() : null;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { services: true } },
        mergedAliases: { select: { id: true, name: true, archivedAt: true } },
      }
    });

    return NextResponse.json(withCustomerCode(customer));
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Customer name already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolveParams = await params;
    const id = parseInt(resolveParams.id);
    
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === 'P2003') return NextResponse.json({ error: 'Cannot delete customer because they have active services attached.' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
