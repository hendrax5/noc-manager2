// Defaults to read-only verification. Reversal requires explicit --apply and unchanged state.
const assert=require('node:assert/strict'),fs=require('node:fs');const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();
const clean=x=>JSON.parse(JSON.stringify(x));
async function main(){
 const file=process.argv.slice(2).find(arg=>arg!=='--apply');const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!['committed','pending_commit'].includes(snapshot.phase)||!snapshot.after||!snapshot.ticketsAfter)throw new Error('Complete snapshot required; inspect partial operations manually.');
 await db.$transaction(async tx=>{
  for(const ticket of [...snapshot.ticketsAfter].sort((a,b)=>a.id-b.id))await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticket.id} FOR UPDATE`;
  for(const service of [...snapshot.after].sort((a,b)=>a.id-b.id))await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${service.id} FOR UPDATE`;
  const current=await tx.service.findMany({where:{id:{in:snapshot.after.map(s=>s.id)}},include:{identifiers:true,tickets:{select:{id:true,updatedAt:true,status:true,awardedScore:true}}}});
  const tickets=await tx.ticket.findMany({where:{id:{in:snapshot.ticketsAfter.map(t=>t.id)}},include:{services:{select:{id:true}}}});
  assert.equal(current.length,snapshot.after.length);assert.equal(tickets.length,snapshot.ticketsAfter.length);
  for(const service of current)assert.deepEqual(clean(service),snapshot.after.find(s=>s.id===service.id),'Service changed: manual rollback review required');
  for(const ticket of tickets)assert.deepEqual(clean(ticket),snapshot.ticketsAfter.find(t=>t.id===ticket.id),'Ticket changed: manual rollback review required');
  if(!process.argv.includes('--apply')){console.log('Rollback state checks passed; no changes applied.');return;}
  for(const before of snapshot.before){
   const after=snapshot.after.find(s=>s.id===before.id);const added=after.identifiers.filter(i=>!before.identifiers.some(old=>old.id===i.id));
   if(added.length)await tx.serviceIdentifier.deleteMany({where:{id:{in:added.map(i=>i.id)},serviceId:before.id}});
   if(before.cid!==after.cid)await tx.service.update({where:{id:before.id},data:{cid:before.cid}});
  }
  for(const before of snapshot.ticketsBefore){
   const after=snapshot.ticketsAfter.find(t=>t.id===before.id);const added=after.services.filter(s=>!before.services.some(old=>old.id===s.id));
   for(const service of added)await tx.$executeRaw`DELETE FROM "_ServiceToTicket" WHERE "A" = ${service.id} AND "B" = ${before.id}`;
   if(added.length)await tx.ticketHistory.create({data:{ticketId:before.id,actorId:null,action:'Rollback circuit identifier backfill '+snapshot.at}});
  }
 },{timeout:120000});
 console.log(process.argv.includes('--apply')?'Approved backfill reversed; audit retained.':'Preview complete.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
