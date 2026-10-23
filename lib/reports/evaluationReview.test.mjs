import test from 'node:test';import assert from 'node:assert/strict';
import {reviewEvaluation,lockPeriod} from './evaluationReview.js';
test('scope, self review, expected revision and immutable locked snapshots',async()=>{
 const row={id:1,userId:2,revision:1,status:'ready',snapshot:{status:'ready'},monthKey:'2026-10',lockedAt:null};
 const events=[];const tx={$queryRaw:async()=>[],monthlyEvaluation:{findUnique:async()=>row,findFirst:async()=>row,findMany:async()=>[row],update:async({data})=>Object.assign(row,data)},evaluationReviewEvent:{create:async({data})=>events.push(data)}};
 const actor={id:3,role:'Manager'},scope={userIds:[2]};
 await assert.rejects(reviewEvaluation(tx,{evaluationId:1,actorId:2,actor:{id:2,role:'Manager'},scope,expectedRevision:1,decision:'approve',reason:'Evidence checked'}),/sendiri/i);
 await assert.rejects(reviewEvaluation(tx,{evaluationId:1,actor,scope:{userIds:[9]},expectedRevision:1,decision:'approve',reason:'Evidence checked'}),/akses/i);
 await assert.rejects(reviewEvaluation(tx,{evaluationId:1,actor,scope,expectedRevision:9,decision:'approve',reason:'Evidence checked'}),/revisi/i);
 await reviewEvaluation(tx,{evaluationId:1,actor,scope,expectedRevision:1,decision:'approve',reason:'Evidence checked'});assert.equal(row.status,'reviewed');
 await lockPeriod(tx,{monthKey:'2026-10',scope,actor:{id:3,role:'Admin'}});assert.ok(row.lockedAt);assert.equal(events.length,2);
 await assert.rejects(reviewEvaluation(tx,{evaluationId:1,actor,scope,expectedRevision:1,decision:'approve',reason:'again'}),/terkunci/i);
});

test('superseded evaluation cannot be approved or locked through an old tab',async()=>{
 const old={id:1,userId:2,revision:1,status:'ready',snapshot:{status:'ready'},monthKey:'2026-10'};
 const newer={...old,id:2,revision:2};
 const tx={$queryRaw:async()=>[],monthlyEvaluation:{findUnique:async()=>old,findFirst:async()=>newer,findMany:async()=>[newer,old]}};
 await assert.rejects(reviewEvaluation(tx,{evaluationId:1,actor:{id:3,role:'Manager'},scope:{userIds:[2]},expectedRevision:1,decision:'approve',reason:'Checked'}),/revisi/i);
 await assert.rejects(lockPeriod(tx,{monthKey:'2026-10',scope:{userIds:[2]},actor:{id:3,role:'Admin'},expectedEvaluationId:1,expectedRevision:1}),/revisi/i);
});
