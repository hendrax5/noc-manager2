import test from 'node:test';
import assert from 'node:assert/strict';
import { planProductChange } from './productChange.js';

const openPort = { id: 7, name: 'OPEN PORT', active: true };
const internet = { id: 9, name: 'INTERNET', active: true };
const darkFiber = { id: 8, name: 'DARKFIBER', active: true };

test('switching to OPEN PORT seeds the 10 Gbps minimum', () => {
  const plan = planProductChange({ nextTemplate: openPort, currentTemplateId: 5, currentCustomData: { cidSource: 'Ticket Subject' } });
  assert.equal(plan.ok, true);
  assert.equal(plan.templateId, 7);
  assert.equal(plan.changed, true);
  assert.equal(plan.customData.bandwidthMbps, 10000);
  assert.equal(plan.customData.cidSource, 'Ticket Subject');
});

test('OPEN PORT refuses a bandwidth below 10 Gbps', () => {
  const plan = planProductChange({
    nextTemplate: openPort,
    currentTemplateId: 5,
    currentCustomData: { bandwidthMbps: 1000 },
    incomingCustomData: { bandwidthMbps: 1000 },
  });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /10 Gbps/);
});

test('switching away keeps existing customData and marks the change', () => {
  const plan = planProductChange({
    nextTemplate: internet,
    currentTemplateId: 7,
    currentCustomData: { cidSource: 'Ticket Subject', bandwidthMbps: 10000 },
    incomingCustomData: { bandwidthMbps: 10000 },
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.templateId, 9);
  assert.equal(plan.customData.bandwidthMbps, 10000);
});

test('DARKFIBER defaults a pair count', () => {
  const plan = planProductChange({ nextTemplate: darkFiber, currentTemplateId: 9, currentCustomData: {} });
  assert.equal(plan.ok, true);
  assert.equal(plan.customData.pairCount, 1);
});

test('inactive or missing products are rejected', () => {
  assert.equal(planProductChange({ nextTemplate: { id: 7, name: 'OPEN PORT', active: false }, currentTemplateId: 5, currentCustomData: {} }).ok, false);
  assert.equal(planProductChange({ nextTemplate: null, currentTemplateId: 5, currentCustomData: {} }).ok, false);
});
