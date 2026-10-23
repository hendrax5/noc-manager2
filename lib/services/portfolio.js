import {readServiceBandwidthMbps} from './capacity.js';import {getServiceCid,getServiceSearchText} from './cid.js';
const decimalGbps=n=>{const s=n.toString().padStart(10,'0');return (s.slice(0,-9)+'.'+s.slice(-9)).replace(/\.?0+$/,'')||'0';};
export function servicePortfolio(services,{status='Active',company='',query='',templateId='',companies=[]}={}){
 const groups=new Map(),customers=new Set(),seen=new Set(),details=[];let total=0n,missingCidCount=0,unknownBandwidthCount=0,duplicateCidCount=0;
 const owners=new Map(),flagged=new Set();for(const s of services){const cid=getServiceCid(s).normalize('NFKC').trim().toUpperCase();if(cid){if(!owners.has(cid))owners.set(cid,new Set());owners.get(cid).add(s.id);}}
 const q=String(query).trim().toLowerCase();
 for(const s of services){if(seen.has(s.id))continue;seen.add(s.id);const origin=companies.includes(s.customData?.['Order Origin'])?s.customData['Order Origin']:'unmapped';if(status&&s.status!==status||company&&origin!==company||templateId&&String(s.templateId)!==String(templateId)||q&&!getServiceSearchText(s).toLowerCase().includes(q)&&!String(s.template?.name||'').toLowerCase().includes(q))continue;
 const cid=getServiceCid(s);if(!cid){missingCidCount++;continue;}const code=cid.normalize('NFKC').trim().toUpperCase();if(owners.get(code)?.size>1){flagged.add(code);duplicateCidCount=flagged.size;continue;}
 const bod=(s.bodWindows||[]).filter(b=>b.activatedAt&&!b.restoredAt&&!b.cancelledAt);const normal=bod.length===1?Number(bod[0].normalBandwidthMbps):bod.length>1?null:readServiceBandwidthMbps(s);const scaled=Math.round(normal*1e6),bw=normal>0&&Number.isSafeInteger(scaled)&&scaled>0?BigInt(scaled):null;
 if(!groups.has(s.templateId))groups.set(s.templateId,{templateId:s.templateId,name:s.template?.name||'Produk belum dipetakan',circuitCount:0,customers:new Set(),total:0n,unknownBandwidthCount:0});const g=groups.get(s.templateId);g.circuitCount++;g.customers.add(s.customerId);customers.add(s.customerId);if(bw===null){g.unknownBandwidthCount++;unknownBandwidthCount++;}else{g.total+=bw;total+=bw;}
 details.push({id:s.id,cid,name:s.name,customerId:s.customerId,customerName:s.customer?.name||'—',templateId:s.templateId,productName:g.name,company:origin,status:s.status,bandwidthGbps:bw===null?null:decimalGbps(bw)});
 }
 return{circuitCount:details.length,customerCount:customers.size,knownBandwidthGbps:decimalGbps(total),unknownBandwidthCount,missingCidCount,duplicateCidCount,groups:[...groups.values()].map(g=>({templateId:g.templateId,name:g.name,circuitCount:g.circuitCount,customerCount:g.customers.size,knownBandwidthGbps:decimalGbps(g.total),unknownBandwidthCount:g.unknownBandwidthCount})).sort((a,b)=>a.name.localeCompare(b.name)),details};
}
