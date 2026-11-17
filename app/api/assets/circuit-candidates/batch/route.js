import { NextResponse } from 'next/server';
import { getMasterUser } from '../../../trouble-masters/user';
import { prisma } from '@/lib/prisma';
import { canManageCircuitAssets, mapCircuitCandidatesBatch, CircuitAssetError } from '@/lib/services/circuitAssets';

function errorResult(error) {
  const status = error instanceof CircuitAssetError
    ? error.status
    : error instanceof SyntaxError
      ? 400
      : error?.code === 'P2002'
        ? 409
        : 500;
  const message = status === 500
    ? 'Data CID batch gagal diproses. Coba lagi.'
    : error?.code === 'P2002'
      ? 'Salah satu CID sudah terdaftar. Muat ulang daftar.'
      : error.message;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req) {
  try {
    const user = await getMasterUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageCircuitAssets(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const result = await mapCircuitCandidatesBatch(prisma, await req.json(), user.id);
    return NextResponse.json(result, { status: result.createdCount > 0 ? 201 : 200 });
  } catch (error) {
    return errorResult(error);
  }
}
