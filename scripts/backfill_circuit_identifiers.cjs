// Explicit reviewed list only. Audit/preview is a different read-only script.
const assert=require('node:assert/strict'),fs=require('node:fs');const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();
async function main(){
 if(!process.argv.includes('--apply'))throw new Error('No changes: run the read-only audit first. --apply requires an approved exact list, backup and output snapshot path.');
 const args=process.argv.slice(2).filter(arg=>arg!=='--apply'),[planFile,backupFile,output]=args;
 if(!planFile||!backupFile||!output||!fs.statSync(backupFile).size||fs.existsSync(output))throw new Error('Reviewed plan, nonempty backup, and new snapshot output required.');
 const plan=JSON.parse(fs.readFileSync(planFile,'utf8').replace(/^\uFEFF/,''));
 assert.ok(Array.isArray(plan.rows)&&plan.rows.length>0&&plan.approvedBy&&plan.approvedAt,'Exact approved rows and approval evidence required');
 const{mapCircuitCandidate}=await import('../lib/services/circuitAssets.js');
 const serviceIds=[...new Set(plan.rows.map(row=>Number(row.serviceId)))];assert.ok(serviceIds.every(Number.isSafeInteger));
 const result=await db.$transaction(async tx=>{
  const before=await tx.service.findMany({where:{id:{in:serviceIds}},include:{identifiers:true,tickets:{select:{id:true,updatedAt:true,status:true,awardedScore:true}}}});
  assert.equal(before.length,serviceIds.length);const results=[];
  for(const row of plan.rows)results.push(await mapCircuitCandidate({$transaction:callback=>callback(tx)},{cid:row.cid,customerId:row.customerId,existingServiceId:row.serviceId,confirmReview:row.confirmReview===true,confirmAlias:row.confirmAlias===true},null));
  const after=await tx.service.findMany({where:{id:{in:serviceIds}},include:{identifiers:true,tickets:{select:{id:true,updatedAt:true,status:true,awardedScore:true}}}});
  return{at:new Date().toISOString(),plan,before,after,results};
 },{timeout:120000});
 fs.writeFileSync(output,JSON.stringify(result,null,2),{mode:0o600});console.log('Applied '+result.results.length+' approved rows; snapshot saved.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
