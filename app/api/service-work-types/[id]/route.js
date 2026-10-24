import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMasterUser, canManage, validate, errorResponse } from '../shared';

async function resolveId(context) {
  const id = Number((await context.params).id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req, context) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = await resolveId(context);
    if (id === null) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
    const existing = await prisma.serviceWorkType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Master tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(await prisma.serviceWorkType.update({ where: { id }, data: await validate(await req.json(), existing) }));
  } catch (error) {
    const result = errorResponse(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function DELETE(req, context) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = await resolveId(context);
    if (id === null) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
    const usageCount = await prisma.ticket.count({ where: { serviceWorkTypeId: id } });
    if (usageCount > 0) return NextResponse.json({ error: `Jenis pekerjaan ini dipakai ${usageCount} tiket dan tidak dapat dihapus. Nonaktifkan agar tidak muncul pada tiket baru; riwayat tiket tetap utuh.`, usageCount }, { status: 409 });
    await prisma.serviceWorkType.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    const result = errorResponse(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
