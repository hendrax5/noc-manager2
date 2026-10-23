import test from 'node:test';import assert from 'node:assert/strict';
import {submitDailyReport} from './dailySubmission.js';
function fixture(){
 let stored=null;const comments=[];
 const tx={$queryRaw:async()=>[],monthlyReportContainer:{findUnique:async()=>({id:9,ticketId:99}),create:async()=>{}},dailyReport:{findUnique:async({where})=>stored?.idempotencyKey===where.idempotencyKey?stored:null,findFirst:async()=>stored,create:async({data})=>stored={id:1,...data}},comment:{create:async({data})=>{comments.push(data);return{id:8};}},ticketHistory:{findMany:async({where})=>[{id:3,actorId:1,createdAt:new Date('2026-10-23T01:00:00Z'),action:'Investigate'}].filter(x=>where.id.in.includes(x.id))},ticketPhaseExecution:{findMany:async()=>[]}};
 return {tx,comments,get report(){return stored;}};
}
const args={actorId:1,reportDate:'2026-10-23',manualItems:[{description:'Periksa monitoring',result:'Normal',blocker:''}],activityRefs:[{source:'history',id:3}],idempotencyKey:'daily-12345678',revision:0,now:new Date('2026-10-23T10:00:00Z')};
test('structured report and one internal reply atomically, replay idempotent, no points',async()=>{
 const f=fixture();const r=await submitDailyReport(f.tx,args);await submitDailyReport(f.tx,args);
 assert.equal(f.comments.length,1);assert.equal(f.comments[0].isPublic,false);assert.equal(r.state,'Submitted');assert.equal(f.report.items.create.length,2);assert.equal(f.report.snapshot.manualItems.length,1);
 await assert.rejects(submitDailyReport(f.tx,{...args,manualItems:[{description:'changed',result:'changed'}]}),/key/i);
});
test('bad/future dates, invalid references and stale revisions rejected before write',async()=>{
 const f=fixture();await assert.rejects(submitDailyReport(f.tx,{...args,reportDate:'2026-02-30'}),/tanggal/i);
 await assert.rejects(submitDailyReport(f.tx,{...args,reportDate:'2026-10-24'}),/tanggal/i);
 await assert.rejects(submitDailyReport(f.tx,{...args,activityRefs:[{source:'history',id:4}]}),/aktivitas/i);
 await submitDailyReport(f.tx,args);
 await assert.rejects(submitDailyReport(f.tx,{...args,idempotencyKey:'other-12345678'}),/revisi/i);
 assert.equal(f.comments.length,1);
});

