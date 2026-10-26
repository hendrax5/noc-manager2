import { NextResponse } from 'next/server';
import { getMasterUser } from '../../trouble-masters/user';
import { prisma } from '@/lib/prisma';
import { canManageCircuitAssets, loadCircuitCandidates, mapCircuitCandidate, CircuitAssetError } from '@/lib/services/circuitAssets';
import { matchesCircuitQuery } from '@/lib/services/circuitCandidates';

function errorResult(error) {
  const status=error instanceof CircuitAssetError ? error.status : error instanceof SyntaxError ? 400 : error?.code==='P2002' ? 409 : 500;
  return NextResponse.json({error:status===500?'Data CID gagal diproses. Coba lagi.':error?.code==='P2002'?'CID sudah terdaftar. Muat ulang daftar.':error.message},{status});
}
export async function GET(req) {
  try {
    const user=await getMasterUser();
    if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
    if (!canManageCircuitAssets(user)) return NextResponse.json({error:'Forbidden'},{status:403});
    const params=new URL(req.url).searchParams;
    const page=Math.max(1,Math.min(100000,Math.floor(Number(params.get('page')))||1));
    const q=(params.get('q')||'').trim().toLowerCase().slice(0,200),status=params.get('status')||'pending';
    const rows=await loadCircuitCandidates(prisma,{family:params.get('family')||'all'});
    const visible=rows.filter(row=>(status==='all'||(status==='pending'?row.status!=='linked':row.status===status))&&matchesCircuitQuery(row,q));
    const summary={circuits:rows.length,needsMapping:rows.filter(row=>row.status==='needs_mapping').length,ready:rows.filter(row=>row.status==='ready_to_link').length,linked:rows.filter(row=>row.status==='linked').length,conflicts:rows.filter(row=>row.status==='conflict').length};
    return NextResponse.json({items:visible.slice((page-1)*25,page*25).map(({ticketIds,trackingIds,...item})=>item),total:visible.length,page,pageSize:25,summary},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return errorResult(error);}
}
export async function POST(req) {
  try {
    const user=await getMasterUser();
    if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
    if (!canManageCircuitAssets(user)) return NextResponse.json({error:'Forbidden'},{status:403});
    const result=await mapCircuitCandidate(prisma,await req.json(),user.id);
    return NextResponse.json(result,{status:result.created?201:200});
  } catch(error) {return errorResult(error);}
}
