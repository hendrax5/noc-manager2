import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceWorkInput, serviceWorkResolveMessage } from './serviceWorkView.js';

test('edit payload retains requested values and never submits application audit/snapshot', () => {
  const input = serviceWorkInput({before:{cid:'CID-1'},after:{templateId:2,bandwidthMbps:200,customData:{region:'A'}},effectiveDate:'2026-10-22',reason:'Upgrade',appliedAt:'2026-10-22',appliedBy:4});
  assert.deepEqual(input,{targetTemplateId:2,bandwidthMbps:200,effectiveDate:'2026-10-22',reason:'Upgrade',targetCustomData:{region:'A'}});
  assert.equal(input.appliedAt,undefined);
  assert.deepEqual(serviceWorkInput(null),{});
});

test('resolve summary identifies CID, product, capacity, date and automatic Inventory application', () => {
  const ticket={serviceWorkTypeLabel:'Upgrade',serviceChange:{before:{cid:'ABC-001',templateName:'IPT',status:'Active',bandwidthMbps:100},after:{templateName:'IPT',status:'Active',bandwidthMbps:200},effectiveDate:'2026-10-22'}};
  const summary=serviceWorkResolveMessage(ticket);
  for(const text of ['ABC-001','100 → 200 Mbps','2026-10-22','otomatis ke Inventory']) assert.ok(summary.includes(text));
  ticket.serviceChange.appliedAt='2026-10-22T10:00:00Z';
  assert.equal(serviceWorkResolveMessage(ticket),'');
});
