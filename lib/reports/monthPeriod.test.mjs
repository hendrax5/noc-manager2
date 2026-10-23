import test from 'node:test';import assert from 'node:assert/strict';
import {jakartaMonthRange} from './monthPeriod.js';
test('month boundaries Jakarta half-open including leap year',()=>{
 const r=jakartaMonthRange('2026-02');assert.equal(r.gte.toISOString(),'2026-01-31T17:00:00.000Z');assert.equal(r.lt.toISOString(),'2026-02-28T17:00:00.000Z');
 assert.equal(jakartaMonthRange('2024-02').lt.toISOString(),'2024-02-29T17:00:00.000Z');assert.throws(()=>jakartaMonthRange('2026-13'));
});
