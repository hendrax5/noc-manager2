import test from 'node:test';import assert from 'node:assert/strict';
import {syncBodWindow,confirmBodAction,assertBodResolved} from './bod.js';
import {snapshotService} from './serviceWork.js';
function fixture(){
 let service={id:1,cid:'SAP-C-1-1',templateId:1,template:{name:'IPT'},status:'Active',customData:{bandwidthMbps:100,preserve:'x'},updatedAt:new Date('2026-10-01')};
 let window=null,logs=[];
 const tx={$queryRaw:async()=>[],service:{findUnique:async()=>service,updateMany:async({data})=>{service={...service,...data,updatedAt:new Date(service.updatedAt.getTime()+1)};return{count:1};}},ticket:{findUnique:async()=>({id:2,assigneeId:7,status:'Open',serviceChange:{operation:'BOD'}}),update:async x=>x},bodWindow:{findUnique:async()=>window,findFirst:async()=>null,create:async({data})=>window={id:1,...data},update:async({data})=>Object.assign(window,data)},ticketHistory:{create:async({data})=>logs.push(data)}};
 return {tx,get service(){return service;},get window(){return window;},logs};
}
test('BOD schedule captures normal once, activation/restoration atomic idempotent and blocks Resolve before return',async()=>{
 const f=fixture(),normal=snapshotService(f.service);
 await syncBodWindow(f.tx,{id:2,serviceChange:{operation:'BOD',before:normal,after:{...normal,bandwidthMbps:200},bod:{startsAt:'2026-10-23T02:00:00Z',endsAt:'2026-10-24T02:00:00Z'}}});
 await assert.rejects(assertBodResolved(f.tx,2),/pengembalian/i);
 const args={ticketId:2,actor:{id:7,role:'Staff'},action:'activate',confirmed:true,evidence:'Konfigurasi dan pengujian selesai',now:new Date('2026-10-23T02:00:00Z')};
 await confirmBodAction(f.tx,args);await confirmBodAction(f.tx,args);assert.equal(f.service.customData.bandwidthMbps,200);assert.equal(f.logs.length,1);
 await confirmBodAction(f.tx,{...args,action:'restore',now:new Date('2026-10-24T02:00:00Z')});await confirmBodAction(f.tx,{...args,action:'restore'});
 assert.equal(f.service.customData.bandwidthMbps,100);assert.equal(f.service.customData.preserve,'x');assert.equal(f.logs.length,2);await assertBodResolved(f.tx,2);
});
test('wrong actor, early activation, missing confirmation and changed Inventory are rejected',async()=>{
 const f=fixture(),before=snapshotService(f.service);
 await syncBodWindow(f.tx,{id:2,serviceChange:{operation:'BOD',before,after:{bandwidthMbps:200},bod:{startsAt:'2026-10-23T02:00:00Z',endsAt:'2026-10-24T02:00:00Z'}}});
 const args={ticketId:2,actor:{id:7},action:'activate',confirmed:true,evidence:'Test',now:new Date('2026-10-23T02:01Z')};
 await assert.rejects(confirmBodAction(f.tx,{...args,actor:{id:8}}),e=>e.status===403);
 await assert.rejects(confirmBodAction(f.tx,{...args,now:new Date('2026-10-22')}),/mulai/i);
 await assert.rejects(confirmBodAction(f.tx,{...args,confirmed:false}),/konfirmasi/i);
 f.service.customData.bandwidthMbps=300;
 await assert.rejects(confirmBodAction(f.tx,args),e=>e.status===409);
});
