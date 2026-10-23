import test from 'node:test';import assert from 'node:assert/strict';
import {gbpsToMbps,mbpsToGbps,parseBodPeriod,bodReminderState} from './bandwidth.js';
test('canonical Mbps storage and Gbps UI conversion never confuse units',()=>{
 assert.equal(gbpsToMbps('0.1'),100);assert.equal(gbpsToMbps('1,5'),1500);assert.equal(mbpsToGbps(100),0.1);
 for(const value of [true,[],0,-1,'100Mbps',Infinity])assert.throws(()=>gbpsToMbps(value));
});
test('explicit timezone and valid BOD period, dashboard expiry priority',()=>{
 const p=parseBodPeriod('2026-10-23T09:00:00+07:00','2026-10-24T09:00:00+07:00');assert.equal(p.durationMinutes,1440);
 assert.throws(()=>parseBodPeriod('2026-10-23T09:00','2026-10-24T09:00'));
 assert.throws(()=>parseBodPeriod('2026-10-24T09:00:00+07:00','2026-10-23T09:00:00+07:00'));
 const b={startsAt:p.startsAt,endsAt:p.endsAt,activatedAt:new Date('2026-10-23T02:00Z')};
 assert.equal(bodReminderState(b,new Date('2026-10-24T02:01Z')),'overdue');
 assert.equal(bodReminderState(b,new Date('2026-10-24T01:30Z')),'urgent');
 assert.equal(bodReminderState({...b,restoredAt:new Date()},new Date()),'restored');
});
