import test from 'node:test';import assert from 'node:assert/strict';
import {parseWorkflowFlags} from './flagsPolicy.js';
test('privacy persists when operational flags are off or malformed',()=>{
 assert.equal(parseWorkflowFlags('{}',true).privacy_enforced,true);
 assert.equal(parseWorkflowFlags('{"structured_daily_enabled":false}',true).privacy_enforced,true);
 assert.equal(parseWorkflowFlags('bad',true).privacy_enforced,true);
 assert.equal(parseWorkflowFlags('{"privacy_enforced":false}',true).privacy_enforced,true);
 assert.equal(parseWorkflowFlags('{}',false).privacy_enforced,false);
});
