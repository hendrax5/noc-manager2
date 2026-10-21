import test from 'node:test';
import assert from 'node:assert/strict';
import { WORK_TYPES, workTypeWhere, prepareTicketClassification } from './workClassification.js';
import { getServiceCid, normalizeCid } from '../services/cid.js';

const master=[{id:1,kind:'symptom',name:'Down',active:true},{id:2,kind:'cause',name:'FO CUT',active:true},{id:3,kind:'cause',name:'Listrik lama',active:false}];
const service={id:7,cid:'CID-001',customerId:9};
const db={troubleMasterEntry:{findUnique:async({where})=>master.find(x=>x.id===where.id)||null},service:{findMany:async({where})=>[service].filter(s=>where.id.in.includes(s.id))}};
const trouble={workType:'Trouble',symptomId:1,causeId:2,serviceIds:[7]};
test('global/default classification preserves all old records without inference', async()=>{
  assert.deepEqual(WORK_TYPES,['Unclassified','Trouble','Installation']);
  assert.deepEqual(workTypeWhere('all'),{});assert.deepEqual(workTypeWhere('bad'),{});
  assert.deepEqual(workTypeWhere('Trouble'),{workType:'Trouble'});
  const r=await prepareTicketClassification(db,{title:'SAP-C-1 FO CUT'});
  assert.equal(r.data.workType,'Unclassified');
  assert.deepEqual((await prepareTicketClassification(db,{status:'Resolved'},{id:3,workType:'Trouble'})).data,{});
});
test('trouble requires real CID services and correct active master choices',async()=>{
  const r=await prepareTicketClassification(db,trouble);
  assert.equal(r.data.symptomLabel,'Down');assert.equal(r.data.causeLabel,'FO CUT');assert.deepEqual(r.serviceIds,[7]);
  for(const invalid of [{...trouble,serviceIds:[]},{...trouble,serviceIds:[99]},{...trouble,symptomId:2},{...trouble,causeId:3},{...trouble,causeId:'2x'},{...trouble,workType:'Other'},{...trouble,serviceIds:[true]}])await assert.rejects(()=>prepareTicketClassification(db,invalid));
  await assert.rejects(()=>prepareTicketClassification({...db,service:{findMany:async()=>[{id:7,customData:{}}]}},trouble));
});
test('unchanged master snapshots survive rename/deactivation on unrelated metadata edits',async()=>{
  const existing={id:1,workType:'Trouble',symptomId:1,causeId:3,symptomLabel:'Gejala historis',causeLabel:'Nama historis',services:[service]};
  const r=await prepareTicketClassification(db,{workType:'Trouble',symptomId:1,causeId:3},existing);
  assert.equal(r.data.causeLabel,'Nama historis');assert.equal(r.data.symptomLabel,'Gejala historis');
});
test('installation preserves SAP manual reference and clears incompatible metadata',async()=>{
  const r=await prepareTicketClassification(db,{workType:'Installation',sapReference:' SAP-C-1855-0001 '},{id:1,workType:'Trouble',symptomId:1,causeId:2});
  assert.equal(r.data.sapReference,'SAP-C-1855-0001');assert.equal(r.data.causeId,null);assert.equal(r.data.symptomLabel,null);
  const generic=await prepareTicketClassification(db,{workType:'Unclassified'},{id:1,workType:'Installation',sapReference:'SAP-1'});
  assert.equal(generic.data.sapReference,null);
  await assert.rejects(()=>prepareTicketClassification(db,{workType:'Installation',sapReference:'x'.repeat(81)}));
});
test('CID uses canonical field or legacy aliases, never internal numeric service ID',()=>{
  assert.equal(getServiceCid({cid:' C-01 ',customData:{CID:'legacy'}}),'C-01');
  assert.equal(getServiceCid({id:1,customData:{'Circuit ID':'LINK-99'}}),'LINK-99');
  assert.equal(getServiceCid({id:9,customData:{}}),'');
  assert.equal(normalizeCid(' cid-x '),'CID-X');
  assert.throws(()=>normalizeCid('x'.repeat(101)));
});
