import test from 'node:test';import assert from 'node:assert/strict';
import {calculatePerformanceMetrics} from './performanceMetrics.js';
import {buildPerformanceAnalysis} from './performanceAnalysis.js';
test('response public humans, no assignment guesses; unknown quality remains unknown',()=>{
 const m=calculatePerformanceMetrics({userId:1,tickets:[{id:7,createdAt:'2026-10-01T00:00:00Z',comments:[{id:1,authorId:1,isPublic:false,createdAt:'2026-10-01T00:01:00Z'},{id:2,authorId:1,isPublic:true,createdAt:'2026-10-01T00:10:00Z'}]}],phases:[{id:1,completedBy:1,startedAt:'2026-10-01T00:00:00Z',completedAt:'2026-10-01T01:00:00Z'}],reports:[],events:[],reviews:[]},null);
 assert.equal(m.find(x=>x.key==='public_response').value,10);assert.equal(m.find(x=>x.key==='phase_elapsed').value,60);assert.equal(m.find(x=>x.key==='quality').value,null);
 const a=buildPerformanceAnalysis({metrics:m});assert.equal(a.coverage.length>0,true);assert.equal(JSON.stringify(a).includes('kepribadian'),false);
});
test('report quality uses human review, deadline uses WIB and latest revision only',()=>{
 const m=calculatePerformanceMetrics({userId:1,context:{requiredReportDates:['2026-10-01']},reports:[{id:8,reportDate:'2026-10-01',revision:1,state:'Submitted',submittedAt:'2026-10-01T16:30:00Z',items:[{description:'Action',result:'Result'}]}],reviews:[{source:'report',sourceId:8,qualityPassed:true,onTime:true}]},{performanceRules:{reportDeadlineMinutes:0}});
 assert.equal(m.find(x=>x.key==='report_content').value,100);assert.equal(m.find(x=>x.key==='report_ontime').value,100);
});
