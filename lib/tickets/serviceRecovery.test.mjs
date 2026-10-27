import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_RECOVERY_KEY,
  recoveryMap,
  markServiceRecovery,
  pendingRecoveryServices,
  recoveredServiceCount,
  assertServicesRecovered,
  shouldShowRecoveryChecklist,
} from './serviceRecovery.js';

const services = [{ id: 1, cid: 'CID-A' }, { id: 2, cid: 'CID-B' }];

test('marks and clears a circuit without touching other customData keys', () => {
  const base = { 'Customer Name': 'PT ABC', hasDowntime: false };
  const marked = markServiceRecovery(base, 2, { recovered: true, at: '2026-10-26T09:00:00.000Z', by: 7 });
  assert.equal(marked['Customer Name'], 'PT ABC');
  assert.deepEqual(marked[SERVICE_RECOVERY_KEY]['2'], { at: '2026-10-26T09:00:00.000Z', by: 7 });
  const cleared = markServiceRecovery(marked, 2, { recovered: false });
  assert.equal(cleared[SERVICE_RECOVERY_KEY]['2'], undefined);
  assert.equal(base[SERVICE_RECOVERY_KEY], undefined);
});

test('counts pending circuits and blocks closing while one is pending', () => {
  const half = markServiceRecovery({}, 1, { recovered: true });
  assert.deepEqual(pendingRecoveryServices(services, half).map((s) => s.id), [2]);
  assert.equal(recoveredServiceCount(services, half), 1);
  assert.equal(assertServicesRecovered(services, half).ok, false);
  const both = markServiceRecovery(half, 2, { recovered: true });
  assert.equal(assertServicesRecovered(services, both).ok, true);
});

test('single-CID and empty tickets are never blocked', () => {
  assert.equal(assertServicesRecovered([{ id: 1 }], {}).ok, true);
  assert.equal(assertServicesRecovered([], {}).ok, true);
  assert.equal(recoveredServiceCount([], {}), 0);
});

test('recovery checklist is for multi-CID tickets only', () => {
  assert.equal(shouldShowRecoveryChecklist([{ id: 1 }]), false);
  assert.equal(shouldShowRecoveryChecklist([]), false);
  assert.equal(shouldShowRecoveryChecklist(undefined), false);
  assert.equal(shouldShowRecoveryChecklist(services), true);
});

test('tolerates malformed customData', () => {
  for (const value of [null, undefined, 'text', 42, [], { serviceRecovery: 'bad' }, { serviceRecovery: [1] }]) {
    assert.deepEqual(recoveryMap(value), {});
  }
});
