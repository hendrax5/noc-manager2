import test from 'node:test';
import assert from 'node:assert/strict';
import { checkServiceCid, findServiceIdsByCid } from './cidLookup.js';

const services=[{id:1,cid:'CID-ONE'},{id:2,customData:{'id layanan':'Legacy-Two'}},{id:3,customData:{cId:'MIXED-THREE'}}];
const db={service:{findMany:async()=>services}};
test('canonical and legacy CIDs are unique regardless of case; own CID is allowed',async()=>{
  assert.equal(await checkServiceCid(db,{cid:'cid-one'},1),'CID-ONE');
  assert.equal(await checkServiceCid(db,{cid:'new-cid'}),'NEW-CID');
  for(const cid of ['cid-one','legacy-two','mixed-three'])await assert.rejects(()=>checkServiceCid(db,{cid}),e=>e.status===409);
  await assert.rejects(()=>checkServiceCid(db,{cid:123}),e=>e.status===400);
});
test('search mirrors CID display aliases including custom key capitalization',async()=>{
  assert.deepEqual(await findServiceIdsByCid(db,'legacy-two'),[2]);
  assert.deepEqual(await findServiceIdsByCid(db,'mixed-three'),[3]);
  assert.deepEqual(await findServiceIdsByCid(db,''),[]);
});
test('database errors remain server failures rather than invalid CID responses',async()=>{
  const failure=new Error('database unavailable');
  await assert.rejects(()=>checkServiceCid({service:{findMany:async()=>{throw failure}}},{cid:'x'}),e=>e===failure);
});
