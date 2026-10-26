import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditDowntime, applyDowntimeEdit } from './downtimeEdit.js';

const now = new Date('2026-10-26T10:00:00+07:00');

test('admin, manager, CS desk, permission holders, PIC and creator may edit downtime', () => {
  assert.equal(canEditDowntime({ role: 'Admin' }, {}), true);
  assert.equal(canEditDowntime({ role: 'Manager' }, {}), true);
  assert.equal(canEditDowntime({ role: 'Staff', department: 'CS' }, {}), true);
  assert.equal(canEditDowntime({ role: 'Staff', department: 'Customer Service' }, {}), true);
  assert.equal(canEditDowntime({ role: 'Staff', department: 'NOC', permissions: ['manage_sla'] }, {}), true);
  assert.equal(canEditDowntime({ role: 'Staff', id: '7' }, { assigneeId: 7 }), true);
  assert.equal(canEditDowntime({ role: 'Staff', id: '9' }, { creatorId: 9 }), true);
});

test('unrelated staff without permission cannot edit downtime', () => {
  assert.equal(canEditDowntime({ role: 'Staff', id: '5', department: 'NOC', permissions: [] }, { assigneeId: 7, creatorId: 9 }), false);
  assert.equal(canEditDowntime({ role: 'Staff', id: '5', department: 'NOC', permissions: ['edit_own_tickets'] }, { assigneeId: 7, creatorId: 9 }), false);
  assert.equal(canEditDowntime({ role: 'Staff', id: '5', department: 'NOC', permissions: ['edit_own_tickets'] }, { assigneeId: 5 }), true);
  assert.equal(canEditDowntime({ role: 'Staff', id: '5', department: 'NOC', permissions: ['edit_other_tickets'] }, { assigneeId: 7 }), true);
  assert.equal(canEditDowntime(null, {}), false);
});

test('applies a fixed downtime and keeps other customData keys', () => {
  const base = { 'Customer Name': 'PT ABC', serviceRecovery: { 1: { at: 'x' } } };
  const result = applyDowntimeEdit(base, { start: '2026-10-26T16:40', end: '2026-10-26T16:56' }, now);
  assert.equal(result.ok, true);
  assert.equal(result.customData.hasDowntime, true);
  assert.equal(result.customData.startDowntime, '2026-10-26T16:40');
  assert.equal(result.customData.endDowntime, '2026-10-26T16:56');
  assert.equal(result.customData.downtimeMinutes, 16);
  assert.equal(result.customData['Customer Name'], 'PT ABC');
  assert.deepEqual(result.customData.serviceRecovery, { 1: { at: 'x' } });
  assert.equal(base.hasDowntime, undefined);
});

test('an open outage is stored live and cleared when both fields are empty', () => {
  const live = applyDowntimeEdit({}, { start: '2026-10-26T09:00', end: '' }, now);
  assert.equal(live.customData.hasDowntime, true);
  assert.equal(live.customData.endDowntime, null);
  assert.equal(live.customData.downtimeMinutes, 60);

  const cleared = applyDowntimeEdit({ hasDowntime: true, startDowntime: 'x', endDowntime: 'y', downtimeMinutes: 5 }, { start: '', end: '' }, now);
  assert.equal(cleared.ok, true);
  assert.equal(cleared.customData.hasDowntime, false);
  assert.equal(cleared.customData.startDowntime, null);
  assert.equal(cleared.customData.downtimeMinutes, 0);
});

test('rejects missing start, inverted range and absurd duration', () => {
  assert.equal(applyDowntimeEdit({}, { start: '', end: '2026-10-26T10:00' }, now).ok, false);
  assert.match(applyDowntimeEdit({}, { start: '2026-10-26T17:00', end: '2026-10-26T16:00' }, now).error, /sebelum/);
  assert.equal(applyDowntimeEdit({}, { start: 'not-a-date', end: '' }, now).ok, false);
  assert.match(applyDowntimeEdit({}, { start: '2020-01-01T00:00', end: '2026-01-01T00:00' }, now).error, /batas/);
});
