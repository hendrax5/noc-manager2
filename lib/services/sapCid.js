import { getServiceCid } from './cid.js';
import { circuitSourceNames } from './circuitCandidates.js';

export function extractSapCid(subject) {
  if (typeof subject !== 'string') return null;
  const value = subject.normalize('NFKC').trim().toUpperCase();
  return value.length <= 100 && /^SAP(?:-[A-Z0-9]+){2,}$/.test(value) ? value : null;
}

export function sapSourceName(ticket) {
  return circuitSourceNames(ticket).name;
}

export function buildSapCandidates(tickets, services) {
  const byCid = new Map();
  for (const service of services) {
    const legacy = service.customData && typeof service.customData === 'object' ? Object.entries(service.customData).filter(([key])=>/^(cid|sid|id layanan|service id|circuit\s*id)$/i.test(key.trim())).map(([,value])=>value) : [];
    const values=[...new Set([getServiceCid(service),service.cid,...legacy].filter(value=>typeof value==='string'&&value.trim()).map(value=>value.normalize('NFKC').trim().toUpperCase()))];
    for (const value of values) {
      const cid=extractSapCid(value);
      if (cid) byCid.set(cid,[...(byCid.get(cid)||[]),{...service,ambiguousCids:values.length>1}]);
    }
  }
  const groups = new Map();
  for (const ticket of [...tickets].sort((a,b) => new Date(b.updatedAt || 0)-new Date(a.updatedAt || 0) || b.id-a.id)) {
    const cid = extractSapCid(ticket.title);
    if (!cid) continue;
    if (!groups.has(cid)) groups.set(cid, { cid, sourceName:'', sourceNames:[], ticketIds:[], tickets:[], ticketCount:0, linkedCount:0, status:'needs_mapping', serviceId:null });
    const row = groups.get(cid);
    const name = sapSourceName(ticket);
    if (name && !row.sourceName) row.sourceName = name;
    if (name && row.sourceNames.length < 5 && !row.sourceNames.includes(name)) row.sourceNames.push(name);
    row.ticketIds.push(ticket.id); row.ticketCount++;
    if (row.tickets.length < 5) row.tickets.push({id:ticket.id,trackingId:ticket.trackingId || String(ticket.id)});
    const matches = byCid.get(cid) || [];
    const matched = matches.length === 1 ? matches[0] : null;
    if (matched) {
      row.serviceId = matched.id;
      if (ticket.services?.some(service => service.id === matched.id)) row.linkedCount++;
    }
    if (matches.length > 1 || matches[0]?.ambiguousCids || (ticket.services?.length && !ticket.services.some(service => service.id === matched?.id))) row.status = 'conflict';
  }
  for (const row of groups.values()) {
    if (row.status !== 'conflict' && row.serviceId) row.status = row.linkedCount === row.ticketCount ? 'linked' : 'ready_to_link';
  }
  return [...groups.values()];
}
