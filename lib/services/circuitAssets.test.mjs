import test from 'node:test';import assert from 'node:assert/strict';
import {buildCircuitCandidates} from './circuitCandidates.js';
const ticket=(id,name,extra={})=>({id,title:'I-0275-021-01',workType:'Unclassified',jobCategory:{name:'Installasi'},description:`[Original Reporter: ${name} - ]`,services:[],...extra});
test('legacy source preserves full reporter and resolves aliases',()=>{const rows=buildCircuitCandidates([ticket(11952,'PT GIGA DIGITAL - OFFICE KEPANJEN')],[{id:72,cid:'SAP-C-0389-0003',identifiers:[{code:'I-0275-021-01'}]}]);assert.equal(rows[0].sourceName,'PT GIGA DIGITAL - OFFICE KEPANJEN');assert.equal(rows[0].serviceId,72);assert.equal(rows[0].status,'ready_to_link');});
test('Trouble excluded; ambiguous/secondary codes review; different source names conflict',()=>{
 assert.equal(buildCircuitCandidates([ticket(1,'Site A',{workType:'Trouble'})],[]).length,0);
 assert.equal(buildCircuitCandidates([ticket(1,'Site A',{jobCategory:{name:'General'}})],[])[0].needsConfirmation,true);
 assert.equal(buildCircuitCandidates([ticket(1,'Site A',{title:'I2-0001-0001'})],[])[0].needsConfirmation,true);
 assert.equal(buildCircuitCandidates([ticket(1,'Site A'),ticket(2,'Site B')],[])[0].status,'conflict');
});
test('duplicate ownership and conflicting manual relations are never overwritten',()=>{
 assert.equal(buildCircuitCandidates([ticket(1,'Site A')],[{id:1,cid:'I-0275-021-01'},{id:2,cid:'I-0275-021-01'}])[0].status,'conflict');
 assert.equal(buildCircuitCandidates([ticket(1,'Site A',{services:[{id:3}]})],[{id:1,cid:'I-0275-021-01'}])[0].status,'conflict');
});
