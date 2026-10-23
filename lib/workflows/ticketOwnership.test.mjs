import test from 'node:test';import assert from 'node:assert/strict';
import {takeTicket,assertTicketDeletionAllowed} from './ticketOwnership.js';
test('monthly archive cannot be stolen/deleted; terminal cannot be reopened by take',async()=>{
 const tx={$queryRaw:async()=>[],ticket:{findUnique:async()=>({id:1,purpose:'PersonalMonthlyReport',assigneeId:2})}};
 await assert.rejects(takeTicket(tx,{ticketId:1,actor:{id:3},enabled:false}),/arsip/i);
 await assert.rejects(assertTicketDeletionAllowed(tx,{id:1,purpose:'PersonalMonthlyReport'}),/arsip/i);
 await assert.rejects(takeTicket({...tx,ticket:{findUnique:async()=>({id:1,purpose:'Work',status:'Resolved'})}},{ticketId:1,actor:{id:3},enabled:false}),/reopen/i);
});
test('phase tickets cannot be partially deleted; take updates pending actor without points',async()=>{
 let updated,history;
 const tx={$queryRaw:async()=>[],ticket:{findUnique:async()=>({id:1,purpose:'Work',status:'New'}),update:async({data})=>({id:1,...data})},ticketPhaseExecution:{count:async()=>1,updateMany:async x=>updated=x},ticketHistory:{create:async x=>history=x}};
 await assert.rejects(assertTicketDeletionAllowed(tx,{id:1,purpose:'Work'}),/fase/i);
 await takeTicket(tx,{ticketId:1,actor:{id:3},enabled:true});assert.equal(updated.data.assigneeId,3);assert.equal(history.data.awardedScore,undefined);
});
