import test from 'node:test';
import assert from 'node:assert/strict';
import {getReportScope,canReadReport} from './reportScope.js';
const users=[{id:1,departmentId:2,company:'ION'},{id:2,departmentId:2,company:'ION'},{id:3,departmentId:2,company:'SDC'},{id:4,departmentId:3,company:'ION'}];
test('staff own only, Manager without explicit grant own only, Admin explicit all',()=>{
 assert.deepEqual(getReportScope({id:1,role:'Staff'},{users}).userIds,[1]);
 assert.deepEqual(getReportScope({id:1,role:'Manager'},{users}).userIds,[1]);
 assert.equal(getReportScope({id:1,role:'Admin'},{users}).all,true);
});
test('grant binds department AND company, expiry honored, self always allowed',()=>{
 const opts={users,period:new Date('2026-10-23'),grants:[{actorId:1,departmentId:2,company:'ION',effectiveFrom:'2026-01-01'}]};
 const scope=getReportScope({id:1,role:'Manager'},opts);
 assert.deepEqual(scope.userIds,[1,2]);assert.equal(canReadReport(scope,3),false);
 assert.deepEqual(getReportScope({id:1,role:'Manager'},{...opts,grants:[{...opts.grants[0],effectiveTo:'2026-10-01'}]}).userIds,[1]);
 assert.deepEqual(getReportScope({id:1,role:'Staff'},opts).userIds,[1]);
});
