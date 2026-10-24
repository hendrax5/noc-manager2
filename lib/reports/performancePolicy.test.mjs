import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePerformancePolicy} from './performancePolicy.js';
test('old policy is readable but cannot rank; configured rules validate',()=>{
 assert.equal(validatePerformancePolicy(null).rankable,false);
 const r=validatePerformancePolicy({calibrationKey:'noc-v1',calibratedRoles:[1,2],minimumCoverage:1,reportDeadlineMinutes:1440,reworkWindowDays:7});
 assert.equal(r.rankable,true);
 for(const change of [{minimumCoverage:2},{reportDeadlineMinutes:-1},{reworkWindowDays:0},{calibratedRoles:[]}])assert.throws(()=>validatePerformancePolicy({...r,...change}));
});
