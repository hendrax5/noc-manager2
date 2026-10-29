import {createHash} from 'node:crypto';

const allowed=new Set(['name','cid','status','company','templateId','customerId','isPublished','title','capacityMbps','capacityPairs','bandwidthMbps','pairCount','product','Bandwidth','Kapasitas (pair)','Bandwidth (Mbps)']);
const summarize=(value={})=>Object.fromEntries([...Object.entries({...value,...(value.customData||{})}).filter(([k,v])=>allowed.has(k)&&['string','number','boolean'].includes(typeof v)).map(([k,v])=>[k,typeof v==='string'?v.slice(0,180):v]),...(typeof value.content==='string'?[['contentHash',createHash('sha256').update(value.content).digest('hex')]]:[])]);

export async function recordActivity(tx,input) {
 if(!tx.appSetting)return null;
 const flags=await tx.appSetting.findUnique({where:{key:'workflow_reporting_flags'}});
 let enabled=false;try{enabled=JSON.parse(flags?.value||'{}').performance_activity_capture===true;}catch{}
 if(!enabled)return null;
 const before=summarize(input.before),after=summarize(input.after);
 const changes=Object.keys({...before,...after}).filter(k=>before[k]!==after[k]).map(field=>({field,before:before[field]??null,after:after[field]??null}));
 if(!changes.length)return null;
 const source=['human','system','import'].includes(input.source)?input.source:'system';
 const key=input.idempotencyKey||createHash('sha256').update(JSON.stringify([input.type,input.entityId,input.before?.updatedAt,input.after?.updatedAt,changes])).digest('hex');
 return tx.activityEvent.upsert({where:{idempotencyKey:key},update:{},create:{actorId:source==='human'?input.actorId:null,source,type:input.type,entityType:input.entityType,entityId:input.entityId,ticketId:input.ticketId||null,occurredAt:input.occurredAt||new Date(),idempotencyKey:key,changes}});
}
