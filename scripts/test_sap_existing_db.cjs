// Destructive fixtures are permitted only in this dedicated, schema-only QA database.
const assert=require('node:assert/strict');const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();
async function main(){
 if(new URL(process.env.DATABASE_URL).pathname!=='/noc_assets_verify_20261022')throw new Error('Dedicated scratch database required');
 const{mapSapCircuit}=await import('../lib/services/sapAssets.js');
 const department=await db.department.create({data:{name:'Assets QA NOC'}}),role=await db.role.create({data:{name:'Assets QA role'}});
 const actor=await db.user.create({data:{email:'assets-qa@example.invalid',roleId:role.id,departmentId:department.id}});
 const owner=await db.customer.create({data:{name:'Explicit owner'}}),other=await db.customer.create({data:{name:'Other owner'}}),template=await db.serviceTemplate.create({data:{name:'METRO-E QA',fields:[]}});
 const service=await db.service.create({data:{name:'Existing office',customerId:owner.id,templateId:template.id,status:'Active',customData:{bandwidthMbps:100}}});
 const ticket=await db.ticket.create({data:{title:'SAP-C-1243-0001',description:'Existing service mapping QA',departmentId:department.id,status:'Resolved'}});
 const body={cid:ticket.title,existingServiceId:service.id,customerId:owner.id};
 await assert.rejects(()=>mapSapCircuit(db,{...body,customerId:other.id},actor.id),/bukan milik/);
 const failing={$transaction:callback=>db.$transaction(tx=>callback({$queryRaw:tx.$queryRaw.bind(tx),$executeRaw:tx.$executeRaw.bind(tx),ticket:tx.ticket,service:tx.service,customer:tx.customer,serviceTemplate:tx.serviceTemplate,ticketHistory:{createMany:async()=>{throw new Error('Forced audit failure');}}}))};
 await assert.rejects(()=>mapSapCircuit(failing,body,actor.id),/Forced audit/);
 assert.equal((await db.service.findUnique({where:{id:service.id}})).cid,null);
 assert.equal((await db.ticket.findUnique({where:{id:ticket.id},include:{services:true}})).services.length,0);
 const results=await Promise.all([mapSapCircuit(db,body,actor.id),mapSapCircuit(db,body,actor.id)]);
 assert.ok(results.every(result=>!result.created&&result.serviceId===service.id));assert.equal(await db.service.count(),1);
 const updated=await db.service.findUnique({where:{id:service.id}});assert.equal(updated.cid,ticket.title);assert.equal(updated.templateId,template.id);assert.equal(updated.status,'Active');assert.deepEqual(updated.customData,{bandwidthMbps:100});assert.ok(+updated.updatedAt>=+service.updatedAt);
 const linked=await db.ticket.findUnique({where:{id:ticket.id},include:{services:true}});assert.equal(+linked.updatedAt,+ticket.updatedAt);assert.equal(linked.status,'Resolved');assert.equal(linked.services[0].id,service.id);assert.equal(await db.ticketHistory.count(),1);assert.equal(await db.ticketHistory.count({where:{awardedScore:{gt:0}}}),0);
 const second=await db.ticket.create({data:{title:'SAP-C-1243-0002',description:'Different CID QA',departmentId:department.id}});
 await assert.rejects(()=>mapSapCircuit(db,{...body,cid:second.title},actor.id),/CID berbeda/);
 const empty=await db.service.create({data:{name:'Race office',customerId:owner.id,templateId:template.id}});
 const third=await db.ticket.create({data:{title:'SAP-C-9999-0003',description:'Race CID QA',departmentId:department.id}});
 const race=await Promise.allSettled([mapSapCircuit(db,{...body,cid:second.title,existingServiceId:empty.id},actor.id),mapSapCircuit(db,{...body,cid:third.title,existingServiceId:empty.id},actor.id)]);
 assert.equal(race.filter(result=>result.status==='fulfilled').length,1,'Different CID race must not overwrite the service');
 console.log('PASS PostgreSQL: reuse existing service; owner and CID validation; atomic rollback; concurrent idempotency and different-CID conflict; product/capacity/status/ticket timestamps and score preserved. Scratch DB only.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
