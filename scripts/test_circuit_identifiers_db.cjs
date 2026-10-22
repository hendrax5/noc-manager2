const assert=require('node:assert/strict');const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();
async function main(){
 if(new URL(process.env.DATABASE_URL).pathname!=='/noc_circuit_verify_20261022')throw new Error('Dedicated scratch database required');
 const{mapCircuitCandidate,linkKnownCircuit,loadCircuitCandidates}=await import('../lib/services/circuitAssets.js');
 const{resolveCircuitIdentifier,registerCircuitIdentifier}=await import('../lib/services/circuitRegistry.js');
 const{findServiceIdsByCid}=await import('../lib/services/cidLookup.js');
 const dept=await db.department.create({data:{name:'Circuit QA'}}),category=await db.jobCategory.create({data:{name:'Installasi',score:5}});
 const owner=await db.customer.create({data:{name:'GIGA DIGITAL QA'}}),other=await db.customer.create({data:{name:'Other QA'}}),template=await db.serviceTemplate.create({data:{name:'METRO-E QA',fields:[]}});
 const service=await db.service.create({data:{customerId:owner.id,templateId:template.id,name:'OFFICE KEPANJEN',cid:'SAP-C-0389-0003',customData:{bandwidthMbps:100}}});
 const ticket=title=>db.ticket.create({data:{title,description:'[Original Reporter: GIGA DIGITAL QA - OFFICE KEPANJEN - ]',departmentId:dept.id,jobCategoryId:category.id,status:'Resolved'}});
 const source=await ticket('I-0275-021-01');const request={cid:source.title,customerId:owner.id,existingServiceId:service.id};
 await assert.rejects(()=>mapCircuitCandidate(db,request,null),e=>e.status===409);
 const failing={$transaction:callback=>db.$transaction(tx=>callback({$queryRaw:tx.$queryRaw.bind(tx),$executeRaw:tx.$executeRaw.bind(tx),ticket:tx.ticket,service:tx.service,serviceIdentifier:tx.serviceIdentifier,customer:tx.customer,serviceTemplate:tx.serviceTemplate,ticketHistory:{createMany:async()=>{throw new Error('Forced audit failure');}}}))};
 await assert.rejects(()=>mapCircuitCandidate(failing,{...request,confirmAlias:true},null),/Forced audit/);assert.equal(await db.serviceIdentifier.count(),0);
 const results=await Promise.all([mapCircuitCandidate(db,{...request,confirmAlias:true},null),mapCircuitCandidate(db,{...request,confirmAlias:true},null)]);
 assert.ok(results.every(r=>!r.created&&r.serviceId===service.id));assert.equal(await db.service.count(),1);assert.equal(await db.ticketHistory.count(),1);
 const after=await db.service.findUnique({where:{id:service.id}});assert.equal(+after.updatedAt,+service.updatedAt,'Alias addition does not invalidate ServiceWork snapshot');assert.equal(after.cid,service.cid);assert.deepEqual(after.customData,service.customData);
 assert.equal((await resolveCircuitIdentifier(db,source.title)).serviceId,service.id);assert.deepEqual(await findServiceIdsByCid(db,source.title),[service.id]);assert.deepEqual(await findServiceIdsByCid(db,`ION-CUST-${String(owner.id).padStart(6,'0')}`),[service.id]);
 const sourceAfter=await db.ticket.findUnique({where:{id:source.id},include:{services:true}});assert.equal(+sourceAfter.updatedAt,+source.updatedAt);assert.equal(sourceAfter.status,'Resolved');assert.equal(sourceAfter.awardedScore,source.awardedScore);
 const next=await ticket(source.title);assert.equal((await linkKnownCircuit(db,next.id)).linked,true);
 const trouble=await db.ticket.create({data:{title:'I-9999-001-01',description:'Trouble fixture',departmentId:dept.id,workType:'Trouble'}});assert.equal((await linkKnownCircuit(db,trouble.id)).linked,false);await assert.rejects(()=>mapCircuitCandidate(db,{...request,cid:trouble.title},null),e=>e.status===404);
 const ambiguous=await db.ticket.create({data:{title:'I2-0001-0001',description:'[Original Reporter: GIGA DIGITAL QA - OFFICE KEPANJEN - ]',departmentId:dept.id}});await assert.rejects(()=>mapCircuitCandidate(db,{...request,cid:ambiguous.title,confirmAlias:true},null),/Konfirmasikan/);await mapCircuitCandidate(db,{...request,cid:ambiguous.title,confirmAlias:true,confirmReview:true},null);
 const stranger=await db.service.create({data:{customerId:other.id,templateId:template.id,name:'Stranger'}});await assert.rejects(()=>db.$transaction(tx=>registerCircuitIdentifier(tx,{serviceId:stranger.id,code:source.title})),e=>e.status===409);
 const competing='C-1111-001-01';const race=await Promise.allSettled([db.$transaction(tx=>registerCircuitIdentifier(tx,{serviceId:service.id,code:competing})),db.$transaction(tx=>registerCircuitIdentifier(tx,{serviceId:stranger.id,code:competing}))]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
 const conflict=await ticket('C-2222-001-01');await db.ticket.create({data:{title:conflict.title,description:'[Original Reporter: Different owner - Different site - ]',departmentId:dept.id,jobCategoryId:category.id}});assert.equal((await loadCircuitCandidates(db)).find(r=>r.cid===conflict.title).status,'conflict');await assert.rejects(()=>mapCircuitCandidate(db,{...request,cid:conflict.title,confirmAlias:true},null),e=>e.status===409);
 console.log('PASS PostgreSQL: I/SAP alias mapping, provenance, canonical/metadata/version/ticket-age/score preservation, failed-audit rollback, idempotent ingestion, source exclusions, review confirmation, alias search + ION Customer ID, concurrent code ownership and source conflicts. Scratch DB only.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
