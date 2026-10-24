import {getServiceCid} from '../services/cid.js';
const text=value=>typeof value==='string'?value.trim():'';
const same=(a,b)=>a.normalize('NFKC').replace(/\s+/g,' ').toLowerCase()===b.normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
export function ticketPresentation(ticket){
 const subject=text(ticket.title),custom=ticket.customData||{};
 const reporter=ticket.description?.match(/\[Original Reporter: (.*?) -/)?.[1];
 const name=text(reporter)||text(custom['Customer Name'])||text(ticket.services?.[0]?.customer?.name);
 const cidSubject=/^(?:SAP-[A-Z0-9]+(?:-[A-Z0-9]+)+|[IC]-\d+(?:-\d+)+)$/i.test(subject);
 const title=cidSubject&&name?name:subject||name||'Tanpa subject';
 const subtitle=cidSubject&&name?subject:name&&!same(name,title)?name:'';
 const cids=[...new Set((ticket.services||[]).map(getServiceCid).filter(Boolean))].filter(cid=>!same(cid,title)&&!same(cid,subtitle));
 return {title,subtitle,cids,originalName:name,originalSubject:subject};
}
