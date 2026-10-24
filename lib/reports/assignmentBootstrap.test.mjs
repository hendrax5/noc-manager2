import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentCandidates} from './assignmentBootstrap.js';

test('maps NocDatacenter to SDC and other eligible departments to ION',()=>{
 const rows=assignmentCandidates({users:[{id:1,departmentId:10,roleId:2},{id:2,departmentId:11,roleId:3},{id:3,departmentId:12,roleId:3}],departments:[{id:10,name:'NocDatacenter'},{id:11,name:'NOC Regional Jakarta'},{id:12,name:'General'}],eligibility:[{departmentId:12,enabled:false}],existingUserIds:new Set([2])});
 assert.deepEqual(rows.create,[{userId:1,departmentId:10,roleId:2,company:'SDC'}]);
 assert.deepEqual(rows.skippedExisting,[2]);assert.deepEqual(rows.skippedExcluded,[3]);
});

test('skips incomplete user placement instead of guessing identifiers',()=>{
 const rows=assignmentCandidates({users:[{id:1,departmentId:null,roleId:2}],departments:[],eligibility:[],existingUserIds:new Set()});
 assert.deepEqual(rows.create,[]);assert.deepEqual(rows.skippedIncomplete,[1]);
});
