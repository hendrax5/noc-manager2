import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolveParams = await params;
    const body = await request.json();
    const id = parseInt(resolveParams.id);

    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.fields !== undefined) updateData.fields = body.fields;
    if (body.active !== undefined) updateData.active = body.active;

    const template = await prisma.serviceTemplate.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { services: true } } }
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Template name already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolveParams = await params;
    const id = parseInt(resolveParams.id);
    
    await prisma.serviceTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === 'P2003') return NextResponse.json({ error: 'Cannot delete template because there are active services built upon it.' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
