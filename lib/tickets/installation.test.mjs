import test from 'node:test';import assert from 'node:assert/strict';
import {prepareInstallationTicket} from './installation.js';
test('customer based installation registers Pending service within caller transaction',async()=>{
 let serviceData;
 const db={$queryRaw:async()=>[],serviceWorkType:{findUnique:async()=>({operation:'Installation',active:true})},customer:{findUnique:async()=>({id:9,name:'PT A'})},serviceTemplate:{findUnique:async()=>({id:1,active:true})},service:{findMany:async()=>[],create:async({data})=>{serviceData=data;return{id:4,...data};}},serviceIdentifier:{findMany:async()=>[],create:async({data})=>data}};
 const body={workType:'ServiceWork',serviceWorkTypeId:1,installation:{customerId:9,cid:'SAP-C-1111-0001',name:'Site A',templateId:1,bandwidthGbps:'0.1',rfsDate:'2026-10-23'}};
 const next=await prepareInstallationTicket(db,body,7);assert.equal(serviceData.status,'Pending');assert.equal(serviceData.customerId,9);assert.equal(serviceData.customData.bandwidthMbps,100);assert.deepEqual(next.serviceIds,[4]);assert.equal(next.serviceChange.bandwidthMbps,100);
 await assert.rejects(prepareInstallationTicket(db,{...body,installation:{...body.installation,customerId:0}},7),/customer/i);
});
