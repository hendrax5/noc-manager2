import test from 'node:test';
import assert from 'node:assert/strict';
import { activateDueServices, clearPlannedActivation, jakartaDate, plannedActivationAt, syncPlannedActivation } from './rfsActivation.js';

function fixture(rows) {
  const services = rows.map(row => ({...row}));
  const activities = [];
  const db = {
    appSetting: {findUnique: async () => ({value: JSON.stringify({performance_activity_capture: true})})},
    activityEvent: {upsert: async ({create}) => { activities.push(create); return create; }},
    service: {
      findMany: async ({where}) => services.filter(service => where.status === service.status
        && typeof where.plannedActiveAt?.lte?.getTime === 'function'
        && service.plannedActiveAt && service.plannedActiveAt <= where.plannedActiveAt.lte
        && (!where.id?.in || where.id.in.includes(service.id))),
      updateMany: async ({where, data}) => {
        const target = services.find(service => (where.id?.in ? where.id.in.includes(service.id) : service.id === where.id) && (!where.status || service.status === where.status));
        if (!target) return {count: 0};
        Object.assign(target, data);
        return {count: 1};
      },
    },
  };
  return {db, services, activities};
}

test('RFS dates map to Jakarta midnight', () => {
  assert.equal(jakartaDate(new Date('2026-10-30T17:30:00Z')), '2026-10-31');
  assert.equal(plannedActivationAt('2026-11-01').toISOString(), '2026-10-31T17:00:00.000Z');
  assert.equal(plannedActivationAt('2026-02-30'), null);
  assert.equal(plannedActivationAt('1-1-2026'), null);
});

test('due Pending circuits activate once, audited, and never touch Active/Terminated rows', async () => {
  const now = new Date('2026-11-01T03:00:00Z');
  const {db, services, activities} = fixture([
    {id:1,cid:'CID-1',status:'Pending',plannedActiveAt:new Date('2026-10-31T17:00:00Z')},
    {id:2,cid:'CID-2',status:'Pending',plannedActiveAt:new Date('2026-11-02T17:00:00Z')},
    {id:3,cid:'CID-3',status:'Active',plannedActiveAt:new Date('2026-10-31T17:00:00Z')},
    {id:4,cid:'CID-4',status:'Pending',plannedActiveAt:null},
  ]);
  const summary = await activateDueServices(db, {now});
  assert.deepEqual(summary, {due:1, activated:1, serviceIds:[1]});
  assert.equal(services[0].status, 'Active');
  assert.equal(services[0].activatedAt, now);
  assert.equal(services[1].status, 'Pending');
  assert.equal(activities.length, 1);
  assert.equal(activities[0].type, 'service.activated_at_rfs');
  assert.equal(activities[0].source, 'system');
  assert.equal(activities[0].idempotencyKey, 'rfs-activation:1');
  assert.equal((await activateDueServices(db, {now})).activated, 0, 'sweep is idempotent');
  assert.equal(activities.length, 1, 'no duplicate audit');
});

test('a targeted sweep only activates the given services', async () => {
  const now = new Date('2026-11-01T03:00:00Z');
  const {db, services} = fixture([
    {id:10,status:'Pending',plannedActiveAt:new Date('2026-10-01T17:00:00Z')},
    {id:11,status:'Pending',plannedActiveAt:new Date('2026-10-01T17:00:00Z')},
  ]);
  const summary = await activateDueServices(db, {now, serviceIds:[11]});
  assert.deepEqual(summary.serviceIds, [11]);
  assert.equal(services[0].status, 'Pending');
  assert.equal(services[1].status, 'Active');
});

test('activation stays audited when performance capture is off', async () => {
  const now = new Date('2026-11-01T03:00:00Z');
  const {db, activities} = fixture([{id:30,status:'Pending',plannedActiveAt:new Date('2026-10-01T17:00:00Z')}]);
  db.appSetting.findUnique = async () => null;
  const summary = await activateDueServices(db, {now});
  assert.equal(summary.activated, 1);
  assert.equal(activities.length, 1, 'audit fallback writes the activation event');
  assert.equal(activities[0].type, 'service.activated_at_rfs');
  assert.equal(activities[0].idempotencyKey, 'rfs-activation:30');
});

test('RFS corrections and ticket deletion update the plan without activating', async () => {
  const {db, services} = fixture([{id:20,status:'Pending',plannedActiveAt:null}]);
  await syncPlannedActivation(db, {serviceId:20, rfsDate:'2026-11-05'});
  assert.equal(services[0].plannedActiveAt.toISOString(), '2026-11-04T17:00:00.000Z');
  await syncPlannedActivation(db, {serviceId:20, rfsDate:'not-a-date'});
  assert.equal(services[0].plannedActiveAt, null);
  await syncPlannedActivation(db, {serviceId:20, rfsDate:'2026-11-05'});
  await clearPlannedActivation(db, [20]);
  assert.equal(services[0].plannedActiveAt, null);
  assert.equal(services[0].status, 'Pending');
});
