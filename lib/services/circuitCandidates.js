import { parseCircuitIdentifier } from './circuitIdentifier.js';
import { classifyCircuitSource } from './circuitSourcePolicy.js';
import { serviceCodes, unconfirmedServiceCodes } from './circuitRegistry.js';

export function circuitSourceNames(ticket) {
  const custom=typeof ticket.customData?.['Customer Name']==='string'?ticket.customData['Customer Name'].trim():'';
  const reporter=ticket.description?.match(/\[Original Reporter:\s*([\s\S]*?)\s+-\s*\](?:\s|$)/)?.[1]?.trim() || ticket.description?.match(/\[Original Reporter:\s*(.*?)\s+-/)?.[1]?.trim() || '';
  return {name:reporter||custom,custom,reporter};
}
const identity=name=>name.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

/** Search matches the CID, the source names on the ticket, or any source ticket's tracking id. */
export function matchesCircuitQuery(row,query){
  const q=String(query||'').trim().toLowerCase();
  if(!q)return true;
  const haystack=[row?.cid,...(row?.sourceNames||[]),...(row?.trackingIds||[])].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

export const SITE_NAME_CONFLICT_REASON='Kode yang sama muncul pada nama/site berbeda; periksa semua sumber.';

/**
 * True when the only problem is that one code appears with different site names and
 * none of its source tickets is linked yet. Ownership is then still unambiguous, so an
 * operator may map it after an explicit confirmation.
 */
export function isSiteNameConflictOnly(row,tickets){
  if(row?.status!=='conflict')return false;
  if(!Array.isArray(row.reasons)||row.reasons.length!==1||row.reasons[0]!==SITE_NAME_CONFLICT_REASON)return false;
  return (tickets||[]).every(ticket=>!(ticket.services&&ticket.services.length));
}
export function buildCircuitCandidates(tickets,services) {
  const byCode=new Map();
  for(const service of services)for(const code of serviceCodes(service))byCode.set(code,[...(byCode.get(code)||[]),service.id]);
  const unconfirmed=new Set(services.flatMap(unconfirmedServiceCodes));
  const groups=new Map();
  for(const ticket of [...tickets].sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0)||b.id-a.id)){
    const parsed=parseCircuitIdentifier(ticket.title),policy=classifyCircuitSource(ticket);
    if(!parsed||policy.eligibility==='excluded')continue;
    if(!groups.has(parsed.code))groups.set(parsed.code,{cid:parsed.code,family:parsed.family,formatStatus:parsed.formatStatus,sourceName:'',sourceNames:[],ticketIds:[],trackingIds:[],tickets:[],ticketCount:0,linkedCount:0,status:'needs_mapping',serviceId:null,needsConfirmation:false,reasons:[],identities:new Set()});
    const row=groups.get(parsed.code),names=circuitSourceNames(ticket),matches=[...new Set(byCode.get(parsed.code)||[])];
    if(names.name){if(!row.sourceName)row.sourceName=names.name;if(!row.sourceNames.includes(names.name))row.sourceNames.push(names.name);row.identities.add(identity(names.name));}
    row.ticketCount++;row.ticketIds.push(ticket.id);
    if(ticket.trackingId&&!row.trackingIds.includes(ticket.trackingId))row.trackingIds.push(ticket.trackingId);
    if(row.tickets.length<5)row.tickets.push({id:ticket.id,trackingId:ticket.trackingId||String(ticket.id),category:ticket.jobCategory?.name||'',eligibility:policy.eligibility,sourceName:names.name});
    if(policy.eligibility==='review'||parsed.formatStatus==='review'){row.needsConfirmation=true;if(!row.reasons.includes(policy.reason))row.reasons.push(policy.reason);}
    if(parsed.formatStatus==='review'&&!row.reasons.includes('Format kode lama perlu dikonfirmasi.'))row.reasons.push('Format kode lama perlu dikonfirmasi.');
    if(matches.length===1){row.serviceId=matches[0];if(ticket.services?.some(s=>s.id===row.serviceId))row.linkedCount++;}
    if(unconfirmed.has(parsed.code)){row.status='conflict';if(!row.reasons.includes('Field CID lama belum dikonfirmasi sebagai alias.'))row.reasons.push('Field CID lama belum dikonfirmasi sebagai alias.');}
    if(matches.length>1||(ticket.services?.length&&!ticket.services.some(s=>s.id===row.serviceId)))row.status='conflict';
  }
  return [...groups.values()].map(({identities,...row})=>{
    if(identities.size>1){row.status='conflict';row.reasons.push('Kode yang sama muncul pada nama/site berbeda; periksa semua sumber.');}
    if(row.status!=='conflict'&&row.serviceId)row.status=row.linkedCount===row.ticketCount?'linked':'ready_to_link';
    return row;
  });
}
