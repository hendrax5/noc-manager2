import test from 'node:test';import assert from 'node:assert/strict';
import {resolveCircuitIdentifier,registerCircuitIdentifier} from './circuitRegistry.js';
function fixture(){const services=[{id:1,cid:'SAP-C-1243-0002',customData:{}},{id:2,cid:null,customData:{CID:'I-0001-001-01'}}],identifiers=[];return{services,identifiers,$queryRaw:async()=>[],service:{findMany:async()=>services,findUnique:async({where})=>services.find(s=>s.id===where.id)},serviceIdentifier:{findMany:async()=>identifiers,create:async({data})=>{identifiers.push(data);return data;}}};}
test('canonical and legacy lookup, missing and contradictory alias ownership',async()=>{const db=fixture();assert.equal((await resolveCircuitIdentifier(db,'sap-c-1243-0002')).serviceId,1);assert.equal((await resolveCircuitIdentifier(db,'I-0001-001-01')).serviceId,2);assert.equal((await resolveCircuitIdentifier(db,'I-9999-001-01')).status,'missing');db.identifiers.push({code:'SAP-C-1243-0002',serviceId:2});assert.equal((await resolveCircuitIdentifier(db,'SAP-C-1243-0002')).status,'conflict');});
test('alias registration is idempotent, resolves old and new code, cannot steal canonical CID',async()=>{const db=fixture();await registerCircuitIdentifier(db,{code:'I-0275-021-01',serviceId:1,sourceTicketId:11952});await registerCircuitIdentifier(db,{code:'i-0275-021-01',serviceId:1});assert.equal(db.identifiers.length,1);assert.equal((await resolveCircuitIdentifier(db,'I-0275-021-01')).serviceId,1);await assert.rejects(()=>registerCircuitIdentifier(db,{code:'I-0275-021-01',serviceId:2}),e=>e.status===409);await assert.rejects(()=>registerCircuitIdentifier(db,{code:'I-0001-001-01',serviceId:1}),e=>e.status===409);});
test('pre-existing contradictory JSON codes are not confirmed aliases',async()=>{
 const db=fixture();db.services[0].customData={CID:'I-0275-021-01'};
 assert.equal((await resolveCircuitIdentifier(db,'I-0275-021-01')).status,'conflict');
 db.identifiers.push({code:'I-0275-021-01',serviceId:1});
 assert.equal((await resolveCircuitIdentifier(db,'I-0275-021-01')).serviceId,1);
});
