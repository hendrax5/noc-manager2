import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareServiceWork,applyServiceWork} from './serviceWork.js';
import {readServiceBandwidthMbps} from '../services/capacity.js';
const template={id:1,name:'IPT',active:true,fields:[]};
const service={id:1,cid:'CID-1',templateId:1,template,status:'Active',customData:{bandwidthMbps:100,old:'preserve'},updatedAt:new Date('2026-10-01')};
const completion={confirmed:true,finishedAt:'2026-10-22',evidence:'BA 2026-10-22 https://drive.example/ba'};
function fixture(operation='Upgrade') { let row=structuredClone(service);return {$queryRaw:async()=>[],serviceWorkType:{findUnique:async()=>({id:1,name:operation,operation,active:true})},serviceTemplate:{findUnique:async()=>template},service:{findUnique:async()=>row,updateMany:async({data})=>{row={...row,...data,updatedAt:new Date('2026-10-22')};return {count:1};}}}; }
const body={workType:'ServiceWork',serviceWorkTypeId:1,serviceIds:[1],serviceChange:{bandwidthMbps:200,effectiveDate:'2026-10-21'}};
test('server snapshots and preserves custom fields',async()=>{const {data}=await prepareServiceWork(fixture(),body);assert.equal(data.serviceChange.before.bandwidthMbps,100);assert.equal(data.serviceChange.after.bandwidthMbps,200);assert.equal(data.serviceChange.after.customData.old,'preserve');assert.equal(data.serviceChange.appliedAt,null);});
test('reject client-owned snapshots, multi CID, numeric garbage, invalid date and direction',async()=>{for(const patch of [{serviceIds:[1,2]},{serviceChange:{...body.serviceChange,before:{}}},{serviceChange:{...body.serviceChange,bandwidthMbps:'100Mbps'}},{serviceChange:{...body.serviceChange,effectiveDate:'2026-02-30'}},{serviceChange:{...body.serviceChange,bandwidthMbps:50}}])await assert.rejects(()=>prepareServiceWork(fixture(),{...body,...patch}));});
test('inactive master and template requirements rejected',async()=>{let db=fixture();db.serviceWorkType.findUnique=async()=>({active:false});await assert.rejects(()=>prepareServiceWork(db,body));db=fixture();db.serviceTemplate.findUnique=async()=>({...template,fields:[{name:'Region',required:true}]});await assert.rejects(()=>prepareServiceWork(db,body));});
test('applies once with completion evidence and stays immutable after application',async()=>{const db=fixture();const {data}=await prepareServiceWork(db,body);const ticket={...data,services:[{id:1}]};const applied=await applyServiceWork(db,ticket,7,new Date('2026-10-22'),completion);assert.equal(applied.applied,true);assert.equal(applied.serviceChange.appliedBy,7);assert.deepEqual(applied.serviceChange.completion,{...completion,confirmedAt:'2026-10-22T00:00:00.000Z',confirmedBy:7});assert.equal((await applyServiceWork(db,{...ticket,serviceChange:applied.serviceChange},7,new Date('2026-10-23'))).applied,false);await assert.rejects(()=>prepareServiceWork(db,body,{...ticket,serviceChange:applied.serviceChange}));});
test('Resolve needs an explicit completion, real finish date and evidence',async()=>{const db=fixture();const {data}=await prepareServiceWork(db,body);const ticket={...data,services:[{id:1}]};
 await assert.rejects(()=>applyServiceWork(db,ticket,7,new Date('2026-10-22')),/Konfirmasi pekerjaan/);
 for(const bad of [{...completion,confirmed:false},{...completion,finishedAt:''},{...completion,finishedAt:'2026-02-30'},{...completion,finishedAt:'2026-10-23'},{...completion,evidence:'   '},{...completion,evidence:'x'.repeat(4001)}]) await assert.rejects(()=>applyServiceWork(db,ticket,7,new Date('2026-10-22'),bad));
 assert.equal((await applyServiceWork(db,ticket,7,new Date('2026-10-22'),completion)).applied,true);
});
test('RFS is a target: a future RFS no longer blocks Resolve',async()=>{const db=fixture();const {data}=await prepareServiceWork(db,body);const ticket={...data,services:[{id:1}]};const applied=await applyServiceWork(db,ticket,7,new Date('2026-10-20'),{...completion,finishedAt:'2026-10-20'});assert.equal(applied.applied,true);assert.equal(applied.serviceChange.after.bandwidthMbps,200);});
test('changed Inventory conflicts without update',async()=>{const db=fixture();const {data}=await prepareServiceWork(db,body);db.service.findUnique=async()=>({...service,status:'Inactive'});await assert.rejects(()=>applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22'),completion),e=>e.status===409);});
test('optimistic update race and storage failure propagate',async()=>{for(const updateMany of [async()=>({count:0}),async()=>{throw new Error('storage');}]){const db=fixture();const {data}=await prepareServiceWork(db,body);db.service.updateMany=updateMany;await assert.rejects(()=>applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22'),completion));}});
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
 assert.equal((await applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22'),completion)).applied,true);
});

test('termination preserves legacy fields without requiring newly added product fields',async()=>{
 const db=fixture('Terminate');db.serviceTemplate.findUnique=async()=>({...template,fields:[{name:'New mandatory field',required:true}]});
 const {data}=await prepareServiceWork(db,{...body,serviceChange:{effectiveDate:'2026-10-21',reason:'Contract ended'}});
 assert.equal(data.serviceChange.after.status,'Terminated');assert.deepEqual(data.serviceChange.before.customData,data.serviceChange.after.customData);
 assert.equal((await applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22'),completion)).applied,true);
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
  await assert.rejects(()=>applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22'),completion),error=>error.status===409&&/mengganti produk/.test(error.message));
 }
});
test('Data Center work requires one CID and records completion without mutating Inventory',async()=>{
 const db=fixture('DataCenter');let writes=0,captured=null;db.service.updateMany=async()=>{writes++;return {count:1};};db.appSetting={findUnique:async()=>({value:JSON.stringify({performance_activity_capture:true})})};db.activityEvent={upsert:async input=>{captured=input;return input.create;}};
 const request={workType:'ServiceWork',serviceWorkTypeId:1,serviceIds:[1],serviceChange:{effectiveDate:'2026-10-21',workDetails:{location:'DC Cyber 1',description:'Instalasi kabel dari rack A ke rack B'}}};
 const {data}=await prepareServiceWork(db,request);
 assert.equal(data.serviceChange.operation,'DataCenter');
 assert.deepEqual(data.serviceChange.before,data.serviceChange.after,'snapshot no longer flips the circuit status');
 const result=await applyServiceWork(db,{id:77,...data,services:[{id:1}]},7,new Date('2026-10-22'),completion);
 assert.equal(result.applied,true);assert.equal(writes,0);assert.equal(result.serviceChange.appliedBy,7);assert.equal(result.serviceChange.completion.finishedAt,'2026-10-22');assert.equal(captured.create.type,'datacenter.work_completed');assert.equal(captured.create.idempotencyKey,'datacenter-completion:77');assert.equal(captured.create.changes[0].after,'Pekerjaan Data Center selesai');
 await assert.rejects(()=>applyServiceWork(db,{id:78,...data,services:[{id:1}]},7,new Date('2026-10-22')),/Konfirmasi pekerjaan/);
 await assert.rejects(()=>prepareServiceWork(db,{...request,serviceIds:[1,2]}),/tepat satu CID/);
 await assert.rejects(()=>prepareServiceWork(db,{...request,serviceChange:{effectiveDate:'2026-10-21',workDetails:{}}}),/lokasi/i);
});

test('Installation Resolve keeps a Pending circuit Pending and tolerates the RFS sweep activation',async()=>{
 let row={...service,cid:'CID-INSTALL',status:'Pending',customData:{bandwidthMbps:100},updatedAt:new Date('2026-10-20')};
 const db={$queryRaw:async()=>[],serviceWorkType:{findUnique:async()=>({id:2,name:'Instalasi Baru',operation:'Installation',active:true})},serviceTemplate:{findUnique:async()=>template},service:{findUnique:async()=>row,updateMany:async({data})=>{row={...row,...data,updatedAt:new Date('2026-10-22')};return {count:1};}}};
 const request={workType:'ServiceWork',serviceWorkTypeId:2,serviceIds:[1],serviceChange:{bandwidthMbps:100,effectiveDate:'2026-10-25'}};
 const {data}=await prepareServiceWork(db,request);
 assert.equal(data.serviceChange.after.status,'Pending','activation is deferred to the RFS sweep');
 const applied=await applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-22'),completion);
 assert.equal(applied.applied,true);assert.equal(row.status,'Pending','Resolve does not activate by itself');
 row={...row,status:'Active',activatedAt:new Date('2026-10-26'),updatedAt:new Date('2026-10-26')};
 const after=await applyServiceWork(db,{...data,services:[{id:1}]},7,new Date('2026-10-27'),{...completion,finishedAt:'2026-10-27'});
 assert.equal(after.applied,true);assert.equal(row.status,'Active','RFS activation is not an Inventory conflict');
});

test('a pre-plan Data Center registration still activates its Pending circuit at Resolve',async()=>{
 let row={id:5,cid:'CID-LEGACY',templateId:1,template,status:'Pending',customData:{bandwidthMbps:100},plannedActiveAt:null,updatedAt:new Date('2026-10-20')};
 const activities=[];
 const db={appSetting:{findUnique:async()=>({value:JSON.stringify({performance_activity_capture:true})})},activityEvent:{upsert:async({create})=>{activities.push(create);return create;}},service:{findUnique:async()=>row,updateMany:async({where,data})=>{if(where.status&&row.status!==where.status)return {count:0};row={...row,...data,updatedAt:new Date('2026-10-22')};return {count:1};}}};
 const change={operation:'DataCenter',registration:'new',before:{serviceId:5,cid:'CID-LEGACY',template:null,templateName:'IPT',status:'Pending',bandwidthMbps:100,customData:{},updatedAt:'2026-10-20T00:00:00.000Z'},after:{serviceId:5,cid:'CID-LEGACY',templateName:'IPT',status:'Pending',bandwidthMbps:100,customData:{}},effectiveDate:'2026-10-23',workDetails:{location:'DC',description:'Legacy cross connect'},appliedAt:null};
 const result=await applyServiceWork(db,{id:90,services:[{id:5}],serviceWorkTypeId:1,serviceChange:change},7,new Date('2026-10-22'),completion);
 assert.equal(result.applied,true);assert.equal(row.status,'Active','legacy registration without an RFS plan still activates at Resolve');assert.equal(result.serviceChange.after.status,'Active');
 assert.ok(activities.some(item=>item.type==='service.activated_from_datacenter'),'legacy activation keeps its audit');
});

test('zero capacity can start an Upgrade',async()=>{
 const db=fixture();
 db.service.findUnique=async()=>({...service,customData:{bandwidthMbps:0}});
 const {data}=await prepareServiceWork(db,body);
 assert.equal(data.serviceChange.before.bandwidthMbps,0);
 assert.equal(data.serviceChange.after.bandwidthMbps,200);
});
