import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceWorkInput, serviceWorkResolveMessage, rfsActivationNote } from './serviceWorkView.js';

test('edit payload retains requested values and never submits application audit/snapshot', () => {
  const input = serviceWorkInput({before:{cid:'CID-1'},after:{templateId:2,bandwidthMbps:200,customData:{region:'A'}},effectiveDate:'2026-10-22',reason:'Upgrade',appliedAt:'2026-10-22',appliedBy:4,completion:{finishedAt:'2026-10-22'}});
  assert.deepEqual(input,{targetTemplateId:2,bandwidthMbps:200,effectiveDate:'2026-10-22',reason:'Upgrade',targetCustomData:{region:'A'}});
  assert.equal(input.appliedAt,undefined);
  assert.equal(input.completion,undefined);
  assert.deepEqual(serviceWorkInput(null),{});
});

test('resolve summary treats RFS as a target and demands completion evidence', () => {
  const ticket={serviceWorkTypeLabel:'Upgrade',serviceChange:{before:{cid:'ABC-001',templateName:'IPT',status:'Active',bandwidthMbps:100},after:{templateName:'IPT',status:'Active',bandwidthMbps:200},effectiveDate:'2026-10-22'}};
  const summary=serviceWorkResolveMessage(ticket);
  for(const text of ['ABC-001','100 → 200 Mbps','RFS (target): 2026-10-22','otomatis ke Inventory','konfirmasi pekerjaan','bukti penyelesaian']) assert.ok(summary.includes(text),text);
  ticket.serviceChange.appliedAt='2026-10-22T10:00:00Z';
  assert.equal(serviceWorkResolveMessage(ticket),'');
});

test('activation note separates the RFS sweep from Resolve', () => {
  assert.match(rfsActivationNote({operation:'Installation',effectiveDate:'2026-11-01'}),/diaktifkan otomatis saat RFS tiba/);
  assert.match(rfsActivationNote({operation:'DataCenter',registration:'new',effectiveDate:'2026-11-01'}),/pada RFS 2026-11-01/);
  assert.match(rfsActivationNote({operation:'Upgrade',effectiveDate:'2026-11-01'}),/RFS hanya tanggal target/);
  assert.equal(rfsActivationNote(null),'');
});
