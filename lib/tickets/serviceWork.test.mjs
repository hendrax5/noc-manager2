import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareServiceWork,applyServiceWork} from './serviceWork.js';
import {readServiceBandwidthMbps} from '../services/capacity.js';
const template={id:1,name:'IPT',active:true,fields:[]};
const service={id:1,cid:'CID-1',templateId:1,template,status:'Active',customData:{bandwidthMbps:100,old:'preserve'},updatedAt:new Date('2026-10-01')};
function fixture(operation='Upgrade') { let row=structuredClone(service);return {$queryRaw:async()=>[],serviceWorkType:{findUnique:async()=>({id:1,name:operation,operation,active:true})},serviceTemplate:{findUnique:async()=>template},service:{findUnique:async()=>row,updateMany:async({data})=>{row={...row,...data,updatedAt:new Date('2026-10-22')};return {count:1};}}}; }
const body={workType:'ServiceWork',serviceWorkTypeId:1,serviceIds:[1],serviceChange:{bandwidthMbps:200,effectiveDate:'2026-10-21'}};
test('server snapshots and preserves custom fields',async()=>{const {data}=await prepareServiceWork(fixture(),body);assert.equal(data.serviceChange.before.bandwidthMbps,100);assert.equal(data.serviceChange.after.bandwidthMbps,200);assert.equal(data.serviceChange.after.customData.old,'preserve');assert.equal(data.serviceChange.appliedAt,null);});
test('reject client-owned snapshots, multi CID, numeric garbage, invalid date and direction',async()=>{for(const patch of [{serviceIds:[1,2]},{serviceChange:{...body.serviceChange,before:{}}},{serviceChange:{...body.serviceChange,bandwidthMbps:'100Mbps'}},{serviceChange:{...body.serviceChange,effectiveDate:'2026-02-30'}},{serviceChange:{...body.serviceChange,bandwidthMbps:50}}])await assert.rejects(()=>prepareServiceWork(fixture(),{...body,...patch}));});
test('inactive master and template requirements rejected',async()=>{let db=fixture();db.serviceWorkType.findUnique=async()=>({active:false});await assert.rejects(()=>prepareServiceWork(db,body));db=fixture();db.serviceTemplate.findUnique=async()=>({...template,fields:[{name:'Region',required:true}]});await assert.rejects(()=>prepareServiceWork(db,body));});
test('applies once and immutable after application',async()=>{const db=fixture();const {data}=await prepareServiceWork(db,body);const ticket={...data,services:[{id:1}]};const applied=await applyServiceWork(db,ticket,7,new Date('2026-10-22'));assert.equal(applied.applied,true);assert.equal(applied.serviceChange.appliedBy,7);assert.equal((await applyServiceWork(db,{...ticket,serviceChange:applied.serviceChange},7)).applied,false);await assert.rejects(()=>prepareServiceWork(db,body,{...ticket,serviceChange:applied.serviceChange}));});
test('future dates and changed Inventory conflict without update',async()=>{const db=fixture();const {data}=await prepareServiceWork(db,body);await assert.rejects(()=>applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-20')));db.service.findUnique=async()=>({...service,status:'Inactive'});await assert.rejects(()=>applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22')),e=>e.status===409);});
test('optimistic update race and storage failure propagate',async()=>{for(const updateMany of [async()=>({count:0}),async()=>{throw new Error('storage');}]){const db=fixture();const {data}=await prepareServiceWork(db,body);db.service.updateMany=updateMany;await assert.rejects(()=>applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22')));}});
test('legacy capacities require explicit units and reject ambiguity',()=>{assert.equal(readServiceBandwidthMbps({customData:{Bandwidth:100}}),null);assert.equal(readServiceBandwidthMbps({customData:{'Bandwidth (Mbps)':100}}),100);assert.equal(readServiceBandwidthMbps({customData:{'Bandwidth (Mbps)':100,'Bandwidth Mbps':200}}),null);});

test('canonical capacity remains readable after updating a legacy capacity',()=>{
 assert.equal(readServiceBandwidthMbps({customData:{bandwidthMbps:200,'Bandwidth (Mbps)':100}}),200);
 assert.equal(readServiceBandwidthMbps({customData:{bandwidthMbps:true}}),null);
 assert.equal(readServiceBandwidthMbps({customData:{bandwidthMbps:[100]}}),null);
 assert.equal(readServiceBandwidthMbps({customData:{'Bandwidth (Mbps)':true}}),null);
});

test('CID aliases cannot be changed even if configured in template fields',async()=>{
 const db=fixture();db.serviceTemplate.findUnique=async()=>({...template,fields:[{name:'CID'}]});
 await assert.rejects(()=>prepareServiceWork(db,{...body,serviceChange:{...body.serviceChange,targetCustomData:{CID:'OTHER-CID'}}}));
});

test('string template definitions enforce required and select fields',async()=>{
 const db=fixture();db.serviceTemplate.findUnique=async()=>({...template,fields:JSON.stringify([{name:'Region',required:true,type:'select',options:['A','B']}])});
 await assert.rejects(()=>prepareServiceWork(db,body));
 await assert.rejects(()=>prepareServiceWork(db,{...body,serviceChange:{...body.serviceChange,targetCustomData:{Region:'OTHER'}}}));
});

test('unchanged form metadata never rebases an existing snapshot or renames its master',async()=>{
 const db=fixture();const {data}=await prepareServiceWork(db,body);
 db.service.findUnique=async()=>({...service,customData:{bandwidthMbps:300}});
 const result=await prepareServiceWork(db,{workType:'ServiceWork',serviceIds:[1]}, {...data,workType:'ServiceWork',services:[{id:1}]});
 assert.deepEqual(result.data,{});
});

test('deactivated work type blocks new jobs but does not strand an existing job',async()=>{
 const db=fixture();const {data}=await prepareServiceWork(db,body);
 db.serviceWorkType.findUnique=async()=>({id:1,name:'Disabled upgrade',operation:'Upgrade',active:false});
 await assert.rejects(()=>prepareServiceWork(db,body));
 const prepared=await prepareServiceWork(db,{...body,serviceChange:{...body.serviceChange,reason:'Reviewed'}},{...data,workType:'ServiceWork',services:[{id:1}]});
 assert.equal(prepared.data.serviceWorkTypeLabel,'Upgrade');
 assert.equal((await applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22'))).applied,true);
});

test('termination preserves legacy fields without requiring newly added product fields',async()=>{
 const db=fixture('Terminate');db.serviceTemplate.findUnique=async()=>({...template,fields:[{name:'New mandatory field',required:true}]});
 const {data}=await prepareServiceWork(db,{...body,serviceChange:{effectiveDate:'2026-10-21',reason:'Contract ended'}});
 assert.equal(data.serviceChange.after.status,'Terminated');assert.deepEqual(data.serviceChange.before.customData,data.serviceChange.after.customData);
 assert.equal((await applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22'))).applied,true);
});
test('capacity jobs retain product; only Change permits a different product',async()=>{
 for(const operation of ['Upgrade','Downgrade','Change']){
  const db=fixture(operation);db.serviceTemplate.findUnique=async({where})=>({...template,id:where.id,name:where.id===2?'METRO-E':'IPT'});
  const request={...body,serviceChange:{...body.serviceChange,targetTemplateId:2,bandwidthMbps:operation==='Downgrade'?50:200}};
  if(operation==='Change'){const{data}=await prepareServiceWork(db,request);assert.equal(data.serviceChange.after.templateId,2);}
  else await assert.rejects(()=>prepareServiceWork(db,request),/produk yang sama/);
 }
});
test('Resolve rejects old cross-product Upgrade and Downgrade snapshots before any write',async()=>{
 for(const operation of ['Upgrade','Downgrade']){
  const db=fixture(operation);const{data}=await prepareServiceWork(db,{...body,serviceChange:{...body.serviceChange,bandwidthMbps:operation==='Downgrade'?50:200}});
  data.serviceChange.after.templateId=2;
  db.service.updateMany=async()=>assert.fail('Invalid product change must not write Inventory');
  await assert.rejects(()=>applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22')),error=>error.status===409&&/mengganti produk/.test(error.message));
 }
});
