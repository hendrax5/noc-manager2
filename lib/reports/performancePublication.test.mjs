import test from 'node:test';import assert from 'node:assert/strict';
import {publicationManifest} from './performancePublication.js';
const rules={calibrationKey:'v1',calibratedRoles:[1],minimumCoverage:1,reportDeadlineMinutes:1440,reworkWindowDays:7};
const rows=[1,2,3].map(userId=>({userId,departmentId:2,roleId:1,company:'ION',status:'ready',total:80,mode:'official',reviewState:'locked',lockedAt:new Date(),id:userId,revision:1,policy:{performanceRules:rules}}));
test('official publication requires whole ready locked cohort; manifest fixes revisions',()=>{
 assert.equal(publicationManifest(rows,{departmentId:2,company:'ION'}).members.length,3);
 for(const patch of [{lockedAt:null},{status:'insufficient_data'},{mode:'simulation'},{reviewState:'reviewed'}])assert.throws(()=>publicationManifest([rows[0],rows[1],{...rows[2],...patch}],{departmentId:2,company:'ION'}));
 assert.throws(()=>publicationManifest([...rows,{...rows[0],userId:9,assignmentStable:false,total:null}],{departmentId:2,company:'ION'}));
});
