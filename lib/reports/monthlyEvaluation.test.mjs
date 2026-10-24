import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateMonthly,aggregateEvaluations} from './monthlyEvaluation.js';
const policy={weights:{outcome:40,quality:30,timeliness:20,reporting:10},targetUnits:100};
const evidence={units:80,scheduledMinutes:9600,eligibleMinutes:9600,qualityPassed:8,qualityCount:10,onTime:9,timedCount:10,reportedDays:20,requiredDays:20,missingReasons:[]};
test('weighted normalized score and caps are transparent, missing denominators not zero',()=>{
 const r=evaluateMonthly({policy,evidence});assert.equal(r.status,'ready');assert.equal(r.dimensions.outcome,80);assert.equal(r.total,84);
 assert.equal(evaluateMonthly({policy,evidence:{...evidence,units:120}}).dimensions.outcome,100);
 assert.equal(evaluateMonthly({policy,evidence:{...evidence,eligibleMinutes:0}}).status,'insufficient_data');
 assert.equal(evaluateMonthly({policy:null,evidence}).total,null);
 assert.equal(evaluateMonthly({policy,evidence:{...evidence,missingReasons:['No quality review']}}).total,null);
});
test('department mean ready only; excluded never enter numerator/denominator/ranking',()=>{
 const r=aggregateEvaluations([{status:'ready',total:80},{status:'ready',total:100},{status:'excluded',total:0},{status:'insufficient_data',total:null}]);
 assert.equal(r.mean,90);assert.equal(r.denominator,2);assert.equal(r.excluded,1);assert.equal(r.coverage,2/3);
});
test('incomplete evidence keeps available dimensions visible without inventing total',()=>{
 const r=evaluateMonthly({policy,evidence:{...evidence,qualityCount:0,missingReasons:['Quality review missing']}});
 assert.equal(r.total,null);assert.equal(r.dimensions.outcome,80);assert.equal(r.dimensions.quality,null);
});
