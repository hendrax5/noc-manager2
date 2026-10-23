import test from 'node:test';import assert from 'node:assert/strict';
import {resolveEvaluationPolicy,isEvaluationExcluded} from './evaluationPolicy.js';
test('excluded stable department IDs, role policy must be configured and version effective',()=>{
 const eligibility=[{departmentId:2,enabled:false}];
 assert.equal(isEvaluationExcluded(2,eligibility),true);
 assert.equal(isEvaluationExcluded(3,eligibility),false);
 assert.equal(resolveEvaluationPolicy({departmentId:2,roleId:1,company:'ION',monthKey:'2026-10',eligibility,policies:[]}).status,'excluded');
 assert.equal(resolveEvaluationPolicy({departmentId:3,roleId:1,company:'ION',monthKey:'2026-10',eligibility,policies:[]}).status,'insufficient_data');
 const policy={id:1,departmentId:3,roleId:1,company:'ION',effectiveMonth:'2026-10',publishedAt:new Date(),weights:{outcome:40,quality:30,timeliness:20,reporting:10},targetUnits:100};
 assert.equal(resolveEvaluationPolicy({departmentId:3,roleId:1,company:'ION',monthKey:'2026-10',eligibility,policies:[policy]}).policy.id,1);
 assert.equal(resolveEvaluationPolicy({departmentId:3,roleId:1,company:'SDC',monthKey:'2026-10',eligibility,policies:[policy]}).status,'insufficient_data');
});
