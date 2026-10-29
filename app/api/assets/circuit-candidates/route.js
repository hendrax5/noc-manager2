import { NextResponse } from 'next/server';
import { getMasterUser } from '../../trouble-masters/user';
import { prisma } from '@/lib/prisma';
import { canManageCircuitAssets, loadCircuitCandidates, mapCircuitCandidate, CircuitAssetError } from '@/lib/services/circuitAssets';
import { matchesCircuitQuery } from '@/lib/services/circuitCandidates';
import { suggestCustomer, suggestServiceCompany } from '@/lib/services/customerSuggestion';
import { getCompanies } from '@/lib/companies/server';

const PAGE_SIZE = 25;
function errorResult(error) {
  const status=error instanceof CircuitAssetError ? error.status : error instanceof SyntaxError ? 400 : error?.code==='P2002' ? 409 : 500;
  return NextResponse.json({error:status===500?'Data CID gagal diproses. Coba lagi.':error?.code==='P2002'?'CID sudah terdaftar. Muat ulang daftar.':error.message},{status});
}
/** Owner hints for the visible page only: one customer/ticket query per page, never per row scan. */
async function ownerSuggestions(pageRows) {
  if (!pageRows.length) return new Map();
  const [customers, companies] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, aliases: true } }),
    getCompanies(),
  ]);
  const ticketIds = [...new Set(pageRows.flatMap(row => row.ticketIds || []))];
  const tickets = ticketIds.length ? await prisma.ticket.findMany({ where: { id: { in: ticketIds } }, select: { id: true, customData: true } }) : [];
  const companyByTicket = new Map(tickets.map(ticket => {
    const data = ticket.customData && typeof ticket.customData === 'object' ? ticket.customData : {};
    return [ticket.id, suggestServiceCompany(data.company || data['Order Origin'], companies)];
  }));
  const suggestions = new Map();
  for (const row of pageRows) {
    const company = (row.ticketIds || []).map(id => companyByTicket.get(id)).find(Boolean) || null;
    suggestions.set(row.cid, { customerSuggestion: suggestCustomer(row.sourceName, customers), companySuggestion: company });
  }
  return suggestions;
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
    const pageRows=visible.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    const suggestions=await ownerSuggestions(pageRows);
    const items=pageRows.map(({ticketIds,trackingIds,...item})=>({...item,...(suggestions.get(item.cid)||{customerSuggestion:{status:'unknown',proposedName:'',customerId:null,customerName:'',score:0},companySuggestion:null})}));
    return NextResponse.json({items,total:visible.length,page,pageSize:PAGE_SIZE,summary},{headers:{'Cache-Control':'no-store'}});
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
