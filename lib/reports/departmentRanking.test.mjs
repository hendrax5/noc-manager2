import test from 'node:test';import assert from 'node:assert/strict';
import {rankDepartment,personalRank} from './departmentRanking.js';
const rules={calibrationKey:'v1',calibratedRoles:[1],minimumCoverage:0.75,reportDeadlineMinutes:1440,reworkWindowDays:7};
const rows=[90,90,85].map((total,i)=>({userId:i+1,departmentId:2,company:'ION',roleId:1,total,status:'ready',policy:{performanceRules:rules}}));
test('ties competition rank, private payload, unknown and exclusions never zero',()=>{
 const r=rankDepartment([...rows,{...rows[0],userId:4,total:null,status:'insufficient_data'},{...rows[0],userId:5,status:'excluded'}],{departmentId:2,company:'ION'});
 assert.deepEqual(r.ranks.map(x=>x.rank),[1,1,3]);assert.equal(r.eligibleCount,4);
 const p=personalRank(r,3);assert.equal(p.rank,3);assert.equal(p.unratedCount,1);assert.equal('ranks' in p,false);assert.equal(JSON.stringify(p).includes('userId'),false);
});
test('small, mixed and uncalibrated cohorts do not rank',()=>{
 assert.equal(personalRank(rankDepartment(rows.slice(0,2),{departmentId:2,company:'ION'}),1).rank,null);
 assert.equal(rankDepartment(rows.map(x=>({...x,policy:{}})),{departmentId:2,company:'ION'}).reason,'Kebijakan peran belum dikalibrasi.');
 assert.equal(rankDepartment(rows,{departmentId:2,company:'SDC'}).rankedCount,0);
});
test('mid-month assignment changes block ranking instead of shrinking roster',()=>{
 const r=rankDepartment([...rows,{...rows[0],userId:9,total:null,status:'insufficient_data',assignmentStable:false}],{departmentId:2,company:'ION'});
 assert.equal(personalRank(r,1).rank,null);assert.match(r.reason,/Penempatan/);
});
