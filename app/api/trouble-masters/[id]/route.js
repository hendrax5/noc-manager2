import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMasterUser } from '../user';
import { canManageTroubleMasters, validateTroubleMaster, troubleMasterError } from '@/lib/tickets/troubleMasters';

function parseMasterId(rawId) {
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

export async function DELETE(req, context) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageTroubleMasters(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = parseMasterId((await context.params).id);
    if (id === null) return NextResponse.json({ error: 'ID master tidak valid.' }, { status: 400 });
    const [symptomUsage, causeUsage] = await Promise.all([
      prisma.ticket.count({ where: { symptomId: id } }),
      prisma.ticket.count({ where: { causeId: id } }),
    ]);
    const usageCount = symptomUsage + causeUsage;
    if (usageCount > 0) return NextResponse.json({ error: `Master ini dipakai ${usageCount} tiket dan tidak dapat dihapus. Nonaktifkan agar tidak muncul pada tiket baru; riwayat tiket tetap utuh.`, usageCount }, { status: 409 });
    await prisma.troubleMasterEntry.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    const result = troubleMasterError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function PATCH(req, context) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageTroubleMasters(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = parseMasterId((await context.params).id);
    if (id === null) return NextResponse.json({ error: 'ID master tidak valid.' }, { status: 400 });
    let data;
    try { data = validateTroubleMaster(await req.json(), true); } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? 'JSON tidak valid.' : error.message }, { status: 400 }); }
    if (data.kind !== undefined) {
      const existing = await prisma.troubleMasterEntry.findUnique({ where: { id }, select: { kind: true } });
      if (!existing) return NextResponse.json({ error: 'Master tidak ditemukan.' }, { status: 404 });
      if (data.kind !== existing.kind) return NextResponse.json({ error: 'Jenis master tidak dapat diubah. Buat master baru untuk jenis berbeda.' }, { status: 400 });
      delete data.kind;
    }
    return NextResponse.json(await prisma.troubleMasterEntry.update({ where: { id }, data }));
  } catch (error) {
    const result = troubleMasterError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
