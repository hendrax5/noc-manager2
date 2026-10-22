// Read-only audit. No registration, linking or backfill function is imported.
const fs=require('node:fs');const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();
async function main(){
 const{buildCircuitCandidates,circuitSourceNames}=await import('../lib/services/circuitCandidates.js');
 const{getServiceCid}=await import('../lib/services/cid.js');
 const{classifyCircuitSource}=await import('../lib/services/circuitSourcePolicy.js');
 const{parseCircuitIdentifier}=await import('../lib/services/circuitIdentifier.js');
 const data=await db.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  const[services,tickets]=await Promise.all([
   tx.service.findMany({include:{identifiers:true,customer:{select:{name:true}},template:{select:{name:true}}}}),
   tx.ticket.findMany({where:{title:{contains:'-'}},select:{id:true,title:true,description:true,customData:true,workType:true,jobCategory:{select:{name:true}},services:{select:{id:true}}}}),
  ]);return{services,tickets};
 },{timeout:60000});
 const normalize=s=>String(s||'').normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const candidates=buildCircuitCandidates(data.tickets,data.services);
 const families={};for(const row of candidates)families[row.family]=(families[row.family]||0)+1;
 const assets=data.services.map(service=>{
  const aliases=[service.name,`${service.customer.name} ${service.name}`,`${service.customer.name} SITE ${service.name}`].map(normalize);
  const matches=candidates.filter(row=>row.sourceName&&aliases.includes(normalize(row.sourceName)));
  return{serviceId:service.id,customerId:service.customerId,customer:service.customer.name,service:service.name,product:service.template.name,cid:getServiceCid(service),identifiers:service.identifiers.map(i=>i.code),matches:matches.map(row=>({cid:row.cid,family:row.family,status:row.status,needsConfirmation:row.needsConfirmation,sourceNames:row.sourceNames,ticketIds:row.ticketIds})),review:matches.length===1&&matches[0].status!=='conflict'&&!matches[0].needsConfirmation?'Exact name match; review before applying':'Needs manual identity review'};
 });
 const preview={at:new Date().toISOString(),mode:'READ ONLY',services:data.services.length,missingCid:assets.filter(s=>!s.cid).length,candidateCircuits:candidates.length,families,excludedCodeTickets:data.tickets.filter(t=>parseCircuitIdentifier(t.title)&&classifyCircuitSource(t).eligibility==='excluded').length,assets,candidates,sample11952:data.tickets.filter(t=>t.id===11952).map(t=>({id:t.id,title:t.title,source:circuitSourceNames(t),policy:classifyCircuitSource(t)}))};
 const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(preview,null,2),{mode:0o600});else console.log(JSON.stringify(preview,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
