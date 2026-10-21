import { NextResponse } from 'next/server';
import { getMasterUser } from './user';
import { prisma } from '@/lib/prisma';
import { canManageTroubleMasters, TROUBLE_MASTER_KINDS, validateTroubleMaster, troubleMasterError } from '@/lib/tickets/troubleMasters';

export async function GET(req) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(req.url).searchParams;
    const kind = params.get('kind');
    if (kind && !TROUBLE_MASTER_KINDS.includes(kind)) return NextResponse.json({ error: 'Jenis master tidak valid.' }, { status: 400 });
    const includeInactive = params.get('includeInactive') === 'true';
    if (includeInactive && !canManageTroubleMasters(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const entries = await prisma.troubleMasterEntry.findMany({ where: { ...(kind ? { kind } : {}), ...(includeInactive ? {} : { active: true }) }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }] });
    return NextResponse.json(entries);
  } catch (error) {
    const result = troubleMasterError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function POST(req) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageTroubleMasters(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    let data;
    try { data = validateTroubleMaster(await req.json()); } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? 'JSON tidak valid.' : error.message }, { status: 400 }); }
    return NextResponse.json(await prisma.troubleMasterEntry.create({ data }), { status: 201 });
  } catch (error) {
    const result = troubleMasterError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
