import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolveParams = await params;
    const body = await request.json();
    const id = parseInt(resolveParams.id);

    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { services: true } } }
    });

    return NextResponse.json(customer);
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Customer name already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolveParams = await params;
    const id = parseInt(resolveParams.id);
    
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === 'P2003') return NextResponse.json({ error: 'Cannot delete customer because they have active services attached.' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
