import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalEvidence,fullMonthAssignment,canReadPerformanceDetails,hasUnstableCohortAssignments} from './performanceEvidence.js';
test('same work in report and phase counted once; assignment changes do not guess identity',()=>{
 assert.equal(canonicalEvidence([{source:'phase',sourceId:3},{source:'phase',sourceId:3}]).length,1);
 const range={gte:new Date('2026-09-30T17:00:00Z'),lt:new Date('2026-10-31T17:00:00Z')};
 const a={effectiveFrom:new Date('2026-01-01'),effectiveTo:null};assert.equal(fullMonthAssignment([a],range),a);
 assert.equal(fullMonthAssignment([a,a],range),null);
 assert.equal(fullMonthAssignment([{...a,effectiveFrom:new Date('2026-10-03')}],range),null);
});
test('manager cannot read whole-month details after company transfer; self retains own view',()=>{
 assert.equal(canReadPerformanceDetails({id:1,role:'Manager'},2,false),false);
 assert.equal(canReadPerformanceDetails({id:2,role:'Staff'},2,false),true);
 assert.equal(canReadPerformanceDetails({id:1,role:'Admin'},2,false),true);
});
test('incoming and outgoing transfers block both cohorts',()=>{
 const range={gte:new Date('2026-09-30T17:00:00Z'),lt:new Date('2026-10-31T17:00:00Z')};
 assert.equal(hasUnstableCohortAssignments([{userId:1,effectiveFrom:new Date('2026-10-15'),effectiveTo:null}],range),true);
 assert.equal(hasUnstableCohortAssignments([{userId:1,effectiveFrom:new Date('2026-01-01'),effectiveTo:new Date('2026-10-15')}],range),true);
});
