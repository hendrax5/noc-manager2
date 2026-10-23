const assert=require('node:assert/strict'),{PrismaClient}=require('@prisma/client'),{encode}=require('next-auth/jwt');
const p=new PrismaClient();
(async()=>{
 const admin=await p.user.findFirst({where:{role:{name:'Admin'}},select:{id:true}});
 assert.ok(admin);
 const setting=await p.appSetting.findUnique({where:{key:'workflow_reporting_flags'}});
 const flags=JSON.parse(setting?.value||'{}');
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const token=await encode({token:{id:admin.id,sub:String(admin.id),name:'Read only release verification'},secret:process.env.NEXTAUTH_SECRET,maxAge:180});
 const cookie='__Secure-next-auth.session-token='+token+'; next-auth.session-token='+token;
 for(const origin of ['http://127.0.0.1:3000','https://ewo2.hsp.net.id']){
 const paths=['/tickets/new','/assets','/settings/workflows','/settings/evaluation','/reports/daily','/reports/evaluations','/api/workflows','/api/settings/evaluation'];
 if(flags.structured_daily_enabled)paths.push('/api/reports?month='+month);
 if(flags.monthly_evaluation_mode!=='off')paths.push('/api/reports/evaluations?month='+month);
 for(const path of paths){
 const r=await fetch(origin+path,{headers:{cookie},redirect:'manual'});assert.equal(r.status,200,path);
 const text=await r.text();assert.doesNotMatch(text.split(String.fromCharCode(92)+String.fromCharCode(34)).join(String.fromCharCode(34)),/"digest"\s*:\s*"[0-9]+"/,path);
 }
 assert.equal((await fetch(origin+'/api/reports/evaluations')).status,401);
 assert.equal((await fetch(origin+'/api/workflows')).status,401);
 console.log(JSON.stringify({origin,newPagesAndAPI:'PASS',anonymousDenied:'PASS'}));
 }
 const excluded=await p.evaluationDepartmentEligibility.findMany({where:{enabled:false}});
 for(const id of [4,10,11])assert.ok(excluded.some(x=>x.departmentId===id));
 assert.notEqual(flags.monthly_evaluation_mode,'official');
 console.log(JSON.stringify({flags,excludedDepartmentIds:excluded.map(x=>x.departmentId),readOnly:true}));
})().catch(e=>{console.error('Verification failed:',e.message);process.exitCode=1;}).finally(()=>p.$disconnect());
