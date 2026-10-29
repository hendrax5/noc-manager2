import { NextResponse } from 'next/server';
import { getMasterUser } from '../../../trouble-masters/user';
import { prisma } from '@/lib/prisma';
import { canManageCircuitAssets, mapCircuitCandidatesBulk, CircuitAssetError } from '@/lib/services/circuitAssets';

function errorResult(error) {
  const status = error instanceof CircuitAssetError ? error.status : error instanceof SyntaxError ? 400 : error?.code === 'P2002' ? 409 : 500;
  return NextResponse.json({ error: status === 500 ? 'Data CID gagal diproses. Coba lagi.' : error.message }, { status });
}

export async function POST(req) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageCircuitAssets(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const result = await mapCircuitCandidatesBulk(prisma, await req.json(), user.id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResult(error);
  }
}
