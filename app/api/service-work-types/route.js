import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMasterUser, canManage, validate, errorResponse } from './shared';

export async function GET(req) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const inactive = new URL(req.url).searchParams.get('includeInactive') === 'true';
    if (inactive && !canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const entries = await prisma.serviceWorkType.findMany({ where: inactive ? {} : { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    const usage = entries.length
      ? await prisma.ticket.groupBy({ by: ['serviceWorkTypeId'], where: { serviceWorkTypeId: { in: entries.map(entry => entry.id) } }, _count: { _all: true } })
      : [];
    const counts = new Map(usage.map(row => [row.serviceWorkTypeId, row._count._all]));
    return NextResponse.json(entries.map(entry => ({ ...entry, usageCount: counts.get(entry.id) ?? 0 })));
  } catch (error) {
    const result = errorResponse(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function POST(req) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(await prisma.serviceWorkType.create({ data: await validate(await req.json()) }), { status: 201 });
  } catch (error) {
    const result = errorResponse(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
