import test from 'node:test';import assert from 'node:assert/strict';
import {buildCircuitCandidates,matchesCircuitQuery,isSiteNameConflictOnly,SITE_NAME_CONFLICT_REASON} from './circuitCandidates.js';
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
test('contradictory legacy JSON cannot auto-link as an unconfirmed alias',()=>{
 const service={id:9,cid:'SAP-C-9999-0001',customData:{CID:'I-0275-021-01'},identifiers:[]};
 assert.equal(buildCircuitCandidates([ticket(1,'Site A')],[service])[0].status,'conflict');
 service.identifiers=[{code:'I-0275-021-01'}];assert.equal(buildCircuitCandidates([ticket(1,'Site A')],[service])[0].status,'ready_to_link');
});
test('candidate rows keep every source tracking id for search',()=>{
 const rows=buildCircuitCandidates([ticket(1,'Site A',{trackingId:'HSK-T879-YX6C'}),ticket(2,'Site A',{trackingId:'HSK-AAAA-BBBB'})],[]);
 assert.deepEqual([...rows[0].trackingIds].sort(),['HSK-AAAA-BBBB','HSK-T879-YX6C']);
});
test('search matches CID, source name or tracking id',()=>{
 const row={cid:'SAP-C-0006-0468',sourceNames:['PT INDO TELEMEDIA SOLUSI (ION PARTNERSHIP) Site KHOIRUL'],trackingIds:['HSK-T879-YX6C']};
 assert.equal(matchesCircuitQuery(row,''),true);
 assert.equal(matchesCircuitQuery(row,'sap-c-0006-0468'),true);
 assert.equal(matchesCircuitQuery(row,'hsk-t879-yx6c'),true);
 assert.equal(matchesCircuitQuery(row,'KHOIRUL'),true);
 assert.equal(matchesCircuitQuery(row,'tidak-ada'),false);
 assert.equal(matchesCircuitQuery({cid:'X'},'x'),true);
});
test('only a site-name conflict can be confirmed for mapping',()=>{
 const row={status:'conflict',reasons:[SITE_NAME_CONFLICT_REASON]};
 assert.equal(isSiteNameConflictOnly(row,[{services:[]},{services:[]}]),true);
 assert.equal(isSiteNameConflictOnly(row,[{services:[]},{services:[{id:1}]}]),false);
 assert.equal(isSiteNameConflictOnly({status:'conflict',reasons:[SITE_NAME_CONFLICT_REASON,'Field CID lama belum dikonfirmasi sebagai alias.']},[{services:[]}]),false);
 assert.equal(isSiteNameConflictOnly({status:'conflict',reasons:[]},[{services:[]}]),false);
 assert.equal(isSiteNameConflictOnly({status:'ready_to_link',reasons:[SITE_NAME_CONFLICT_REASON]},[{services:[]}]),false);
});
