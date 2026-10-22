import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSapCid, buildSapCandidates } from './sapCid.js';

test('accepts complete SAP subjects only, without deriving owner from sequence',()=>{
 assert.equal(extractSapCid(' sap-c-1243-0003 '),'SAP-C-1243-0003');
 for(const value of ['I-0666-004-01','SAP-C-1-2 Upgrade','SAP','ASAP-1-2',null]) assert.equal(extractSapCid(value),null);
 const groups=buildSapCandidates([{id:1,title:'SAP-C-1243-0003',customData:{'Customer Name':'Customer A - Site A'}},{id:2,title:'SAP-C-1243-0004',customData:{'Customer Name':'Customer B - Site B'}}],[]);
 assert.equal(groups.length,2);assert.equal(groups[0].customerId,undefined);assert.equal(groups[1].customerId,undefined);
});

test('same normalized CID groups all tickets and retains prose as source name',()=>{
 const groups=buildSapCandidates([{id:1,title:'SAP-C-1-2',description:'[Original Reporter: PT ABC - Site X - old]',updatedAt:'2026-01-01',services:[]},{id:2,title:' sap-c-1-2 ',customData:{'Customer Name':'PT ABC - Site Y'},updatedAt:'2026-02-01',services:[]}],[]);
 assert.equal(groups.length,1);assert.deepEqual(groups[0].ticketIds,[2,1]);assert.equal(groups[0].sourceName,'PT ABC - Site Y');assert.equal(groups[0].status,'needs_mapping');
});

test('canonical and legacy CID matches are reused; duplicate/mismatched links require review',()=>{
 const ticket={id:1,title:'SAP-C-1-2',services:[]};
 let row=buildSapCandidates([ticket],[{id:7,customData:{'Circuit ID':'sap-c-1-2'}}])[0];assert.equal(row.status,'ready_to_link');assert.equal(row.serviceId,7);
 row=buildSapCandidates([{...ticket,services:[{id:7}]}],[{id:7,cid:'SAP-C-1-2'}])[0];assert.equal(row.status,'linked');
 assert.equal(buildSapCandidates([ticket],[{id:7,cid:'SAP-C-1-2'},{id:8,cid:'sap-c-1-2'}])[0].status,'conflict');
 assert.equal(buildSapCandidates([{...ticket,services:[{id:8}]}],[{id:7,cid:'SAP-C-1-2'}])[0].status,'conflict');
 assert.equal(buildSapCandidates([ticket],[{id:7,cid:'SAP-C-9-9',customData:{CID:'SAP-C-1-2'}}])[0].status,'conflict','Contradictory canonical/legacy CIDs must not create another circuit');
});
