import test from 'node:test';import assert from 'node:assert/strict';
import {buildWorkEvidence} from './workEvidence.js';
test('deduplicate sources, use real phase actor, require reviewed inputs and do not count duplicate history',()=>{
 const r=buildWorkEvidence({userId:1,phases:[{id:2,completedBy:1,categorySnapshot:{id:7},completedAt:new Date(),evidence:'ok'}],manualItems:[],reviews:[{source:'phase',sourceId:2,qualityPassed:true,onTime:true},{source:'phase',sourceId:2,qualityPassed:true,onTime:true}],policy:{categoryWeights:{7:2}},context:{scheduledMinutes:9600,eligibleMinutes:9000,requiredReportDates:['2026-10-01']},reports:[{reportDate:'2026-10-01',state:'Submitted',revision:1}]});
 assert.equal(r.activities.length,1);assert.equal(r.units,2);assert.equal(r.qualityPassed,1);assert.equal(r.reportedDays,1);assert.deepEqual(r.missingReasons,[]);
 assert.ok(buildWorkEvidence({userId:1}).missingReasons.length);
});
