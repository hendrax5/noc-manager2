import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeTicketWorkflow, completeTicketPhase, assertWorkflowResolved } from './ticketWorkflow.js';
const category={id:7,name:'Investigasi',score:5,active:true};
function fixture(){
 const rows=[],logs=[];
 const db={workflowPolicyVersion:{findUnique:async()=>({id:1,phases:[{id:11,key:'investigate',label:'Investigasi',jobCategoryId:7,ordinal:0,category},{id:12,key:'verify',label:'Verifikasi',jobCategoryId:7,ordinal:1,category}]})},ticket:{findUnique:async()=>({id:2,assigneeId:3,departmentId:2,customData:{'Order Origin':'ION'}}),update:async x=>x},ticketPhaseExecution:{
 count:async()=>rows.length,createMany:async({data})=>{rows.push(...data.map((x,i)=>({...x,id:i+1})));},
 findUnique:async({where})=>rows.find(x=>x.id===where.id),
 findMany:async()=>rows,
 update:async({where,data})=>Object.assign(rows.find(x=>x.id===where.id),data),
 updateMany:async({where,data})=>{const row=rows.find(x=>x.ticketId===where.ticketId&&x.ordinal===where.ordinal);if(row)Object.assign(row,data);return {count:row?1:0};}
 },jobCategory:{findUnique:async()=>category},ticketHistory:{create:async x=>{logs.push(x.data);return x.data;}},$queryRaw:async()=>[]};
 return {db,rows,logs};
}
test('initialize phases once without assignment points; snapshots and active phase category',async()=>{
 const {db,rows,logs}=fixture();
 await initializeTicketWorkflow(db,{ticketId:2,policyVersionId:1,actorId:3});
 await initializeTicketWorkflow(db,{ticketId:2,policyVersionId:1,actorId:3});
 assert.equal(rows.length,2);assert.equal(rows[0].state,'Active');assert.equal(rows[0].routingSnapshot['Order Origin'],'ION');assert.equal(logs.length,0);
 await assert.rejects(assertWorkflowResolved(db,2),/fase/i);
});
test('complete once by assigned actor with evidence, then next phase; no duplicate credit',async()=>{
 const {db,rows,logs}=fixture();await initializeTicketWorkflow(db,{ticketId:2,policyVersionId:1,actorId:3});
 const args={executionId:1,actor:{id:3,role:'Staff'},idempotencyKey:'key-123456',evidence:'Investigated optical signal.'};
 await assert.rejects(completeTicketPhase(db,{...args,actor:{id:8}}),/pelaksana/i);
 await completeTicketPhase(db,args);await completeTicketPhase(db,args);
 assert.equal(rows[0].completedBy,3);assert.equal(rows[1].state,'Active');assert.equal(logs.length,1);assert.equal(logs[0].awardedScore,5);
 await assert.rejects(completeTicketPhase(db,{...args,idempotencyKey:'different-key'}),/selesai/i);
 await completeTicketPhase(db,{...args,executionId:2,idempotencyKey:'key-verify'});
 await assertWorkflowResolved(db,2);
});
test('cancelled or terminal tickets cannot complete phases and award credit',async()=>{
 const {db,logs}=fixture();await initializeTicketWorkflow(db,{ticketId:2,policyVersionId:1,actorId:3});db.ticket.findUnique=async()=>({id:2,status:'Closed'});
 await assert.rejects(completeTicketPhase(db,{executionId:1,actor:{id:3},idempotencyKey:'cancelled-phase-key',evidence:'No credit'}),/ditutup|dibatalkan/i);assert.equal(logs.length,0);
});
