import test from 'node:test';import assert from 'node:assert/strict';
import {calculatePerformanceMetrics} from './performanceMetrics.js';
import {buildPerformanceAnalysis} from './performanceAnalysis.js';
test('ticket timeline uses assignment and first response including internal replies',()=>{
 const m=calculatePerformanceMetrics({userId:1,resolvedTickets:[{id:9,createdAt:'2026-10-01T00:00:00Z',assignedAt:'2026-10-01T00:05:00Z',firstRespondedAt:'2026-10-01T00:15:00Z',resolvedAt:'2026-10-01T01:00:00Z',resolutionDueAt:'2026-10-01T02:00:00Z',responseDueAt:'2026-10-01T00:30:00Z',slaBreaches:0,comments:[{id:1,authorId:1,isPublic:false,createdAt:'2026-10-01T00:15:00Z'}]}],phases:[{id:1,completedBy:1,startedAt:'2026-10-01T00:00:00Z',completedAt:'2026-10-01T01:00:00Z'}],reports:[],events:[],reviews:[]},null);
 assert.equal(m.find(x=>x.key==='first_response').value,10);assert.equal(m.find(x=>x.key==='accountable_time').value,55);assert.equal(m.find(x=>x.key==='resolution_total').value,60);assert.equal(m.find(x=>x.key==='internal_responses').value,1);assert.equal(m.find(x=>x.key==='ticket_ontime').value,100);assert.equal(m.find(x=>x.key==='phase_elapsed').value,60);assert.equal(m.find(x=>x.key==='quality'),undefined);
 const a=buildPerformanceAnalysis({metrics:m});assert.equal(a.coverage.length>0,true);assert.equal(JSON.stringify(a).includes('kepribadian'),false);
});
test('report quality uses human review, deadline uses WIB and latest revision only',()=>{
 const m=calculatePerformanceMetrics({userId:1,context:{requiredReportDates:['2026-10-01']},reports:[{id:8,reportDate:'2026-10-01',revision:1,state:'Submitted',submittedAt:'2026-10-01T16:30:00Z',items:[{description:'Action',result:'Result'}]}],reviews:[{source:'report',sourceId:8,qualityPassed:true,onTime:true}]},{performanceRules:{reportDeadlineMinutes:0}});
 assert.equal(m.find(x=>x.key==='report_content').value,100);assert.equal(m.find(x=>x.key==='report_ontime').value,100);
});
test('RFS is observed team outcome and BOD restoration is measured separately',()=>{
 const m=calculatePerformanceMetrics({userId:1,serviceJobs:[{id:1,resolvedAt:'2026-10-01T16:59:00Z',serviceChange:{operation:'Upgrade',effectiveDate:'2026-10-01'}},{id:2,resolvedAt:'2026-10-02T01:00:00Z',serviceChange:{operation:'BOD',effectiveDate:'2026-10-01'}}]});
 assert.equal(m.find(x=>x.key==='rfs').value,100);assert.equal(m.find(x=>x.key==='rfs').denominator,1);
});
