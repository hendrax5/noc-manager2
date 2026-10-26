import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutageReport, parseOutageFilters, outageCsv } from './outageReport.js';

const now = new Date('2026-10-21T12:00:00+07:00');
const ticket = (id, start, end, extra = {}) => ({
  id, trackingId: `TT-${id}`, title: 'Link down', description: 'FO CUT',
  status: 'Resolved', customData: { hasDowntime: true, startDowntime: start, endDowntime: end },
  services: [{ name: 'Link A', customer: { id: 1, name: 'Customer A' } }], ...extra,
});
const filters = (extra = {}) => parseOutageFilters({ startDate: '2026-10-01', endDate: '2026-10-21', ...extra });

test('filters each ticket independently, strict > differs from >=, never sums customers', () => {
  const tickets = [ticket(1,'2026-10-01T00:00','2026-10-01T04:00'),ticket(2,'2026-10-02T00:00','2026-10-02T07:00'),ticket(3,'2026-10-03T00:00','2026-10-03T10:00'),ticket(4,'2026-10-04T00:00','2026-10-04T12:00')];
  assert.deepEqual(buildOutageReport(tickets,filters({durationOperator:'gt',durationHours:'10'}),now).rows.map(r=>r.dbId),[4]);
  assert.equal(buildOutageReport(tickets,filters({durationOperator:'gte',durationHours:'10'}),now).rows.length,2);
});
test('full ticket duration survives crossing report boundary; selection uses outage start in WIB', () => {
  const t = ticket(1,'2026-10-21T23:00','2026-10-22T12:00');
  const report = buildOutageReport([t,ticket(2,'2026-09-30T23:00','2026-10-02T12:00')],filters(),new Date('2026-10-23T00:00:00+07:00'));
  assert.equal(report.rows.length,1);
  assert.equal(report.rows[0].downtimeMinutes,780);
});
test('ongoing downtime uses single generation time, independent of ticket workflow status', () => {
  const report = buildOutageReport([ticket(1,'2026-10-20T22:00',null)],filters({outageStatus:'ongoing'}),now);
  assert.equal(report.rows[0].downtimeMinutes,840);
  assert.equal(report.summary.ongoing,1);
});
test('customer filter narrows a multi-CID ticket to that customer circuit only', () => {
  const tickets=[ticket(1,'2026-10-01T00:00','2026-10-01T12:00',{description:'FO-Cut closure',services:[{name:'Link A',customer:{id:1,name:'DNET'}},{name:'Link B',customer:{id:2,name:'Other'}}]}),ticket(2,'2026-10-01T00:00','2026-10-01T12:00',{title:'DNET',description:'Listrik',services:[]})];
  const report=buildOutageReport(tickets,filters({customer:'DNET'}),now);
  assert.equal(report.rows.length,1);
  assert.equal(report.rows[0].dbId,1);
  assert.equal(report.rows[0].services,'Link A');
  assert.equal(report.rows[0].customer,'DNET');
  assert.equal(report.summary.customers,1);
  // Another customer's circuit must never surface through a DNET report.
  assert.equal(buildOutageReport(tickets,filters({customer:'DNET',search:'Link B'}),now).rows.length,0);
});
test('CID filter reports one row for that circuit without the ticket\'s other CIDs', () => {
  const t=ticket(1,'2026-10-01T00:00','2026-10-01T12:00',{services:[{name:'Link A',cid:'CID-A',customer:{id:1,name:'A'}},{name:'Link B',cid:'CID-B',customer:{id:2,name:'B'}}]});
  const report=buildOutageReport([t],filters({cid:'CID-B'}),now);
  assert.equal(report.rows.length,1);
  assert.equal(report.rows[0].services,'Link B · CID-B');
  assert.equal(report.rows[0].customer,'B');
  assert.equal(report.summary.customers,1);
  const all=buildOutageReport([t],filters(),now);
  assert.equal(all.rows.length,1);
  assert.match(all.rows[0].services,/CID-A/);
  assert.match(all.rows[0].services,/CID-B/);
});
test('structured cause takes priority over legacy prose and invalid downtime is excluded with count', () => {
  const structured=ticket(1,'2026-10-01T00:00','2026-10-01T12:00');
  structured.customData.causeCode='Gangguan listrik';
  const report=buildOutageReport([structured,ticket(2,'bad',null),ticket(3,'2026-10-02T12:00','2026-10-01T00:00')],filters({cause:'fo cut'}),now);
  assert.equal(report.rows.length,0);
  assert.equal(report.summary.invalidDowntime,2);
});
test('rejects bad calendar dates, reversed range, invalid operators and negative/nonfinite hours', () => {
  for(const x of [{startDate:'2026-02-30'},{startDate:'2026-11-01'},{durationOperator:'bad'},{durationHours:'-1'},{durationHours:'Infinity'},{outageStatus:'bad'}]) assert.throws(()=>filters(x));
});
test('CSV preserves lines and quotes and neutralizes spreadsheet formulas', () => {
  const csv=outageCsv([{trackingId:'=CMD()',customer:'A,"B"',services:'X',startAt:'2026-10-01T00:00:00Z',endAt:null,downtimeMinutes:12,cause:'FO CUT',causeSource:'test',action:'line1\nline2',ongoing:true,status:'New'}]);
  assert.ok(csv.includes("' =CMD()".replace(' ','')));
  assert.ok(csv.includes('A,""B""'));
  assert.ok(csv.includes('line1\nline2'));
});

test('classified installations are excluded, structured cause wins and CID is searchable', () => {
  const t=ticket(1,'2026-10-01T00:00','2026-10-01T12:00',{workType:'Trouble',symptomLabel:'Packet Loss',causeLabel:'Listrik',services:[{name:'Link A',cid:'CID-001',customer:{id:1,name:'A'}}]});
  assert.equal(buildOutageReport([t],filters({cause:'FO CUT'}),now).rows.length,0);
  assert.equal(buildOutageReport([t],filters({search:'CID-001',symptom:'Packet Loss'}),now).rows.length,1);
  assert.equal(buildOutageReport([{...t,workType:'Installation'}],filters(),now).rows.length,0);
  assert.equal(buildOutageReport([{...t,workType:'ServiceWork'}],filters(),now).rows.length,0);
});
