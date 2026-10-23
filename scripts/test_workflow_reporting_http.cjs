const assert=require('node:assert/strict'),{PrismaClient}=require('@prisma/client'),{encode}=require('next-auth/jwt');
const p=new PrismaClient();
(async()=>{
 if(process.env.WORKFLOW_TEST_DATABASE!=='isolated')throw new Error('Isolated database required.');
 const base=process.env.WORKFLOW_QA_ORIGIN||'http://noc-workflow-appqa:3000';
 for(let i=0;i<40;i++){try{if((await fetch(base+'/login')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const outsider=await p.user.findUnique({where:{email:'outsider@example.invalid'}});
 const archive=await p.monthlyReportContainer.findFirst(),unfinished=await p.ticket.findFirst({where:{title:'Unfinished work'}}),admin=await p.user.findUnique({where:{email:'manager@example.invalid'}});
 async function cookieFor(user){const t=await encode({token:{id:user.id,sub:String(user.id)},secret:process.env.NEXTAUTH_SECRET,maxAge:180});return '__Secure-next-auth.session-token='+t+'; next-auth.session-token='+t;}
 const cookie=await cookieFor(outsider),acookie=await cookieFor(admin);
 for(const [suffix,method,body] of [['take','POST',{}],['notes','GET'],['notes','POST',{content:'should not write'}],['watchers','GET'],['watchers','POST',{}],['watchers','DELETE'],['sla/snooze','POST',{}],['comments','POST',{text:'must not write'}]]){
 const r=await fetch(base+'/api/tickets/'+archive.ticketId+'/'+suffix,{method,headers:{cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,403,method+' '+suffix);
 }
 const r=await fetch(base+'/api/tickets/'+unfinished.id,{method:'PATCH',headers:{cookie:acookie,'Content-Type':'application/json'},body:JSON.stringify({status:'Resolved'})});assert.equal(r.status,409);
 assert.equal((await p.monthlyReportContainer.findFirst({include:{ticket:true}})).ticket.assigneeId,archive.userId);
 assert.equal(await p.comment.count(),1);
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const denied=await fetch(base+'/api/reports?month='+month+'&userId='+archive.userId,{headers:{cookie}});assert.equal(denied.status,403);
 await p.appSetting.update({where:{key:'workflow_reporting_flags'},data:{value:'{}'}});
 assert.equal((await fetch(base+'/api/tickets/'+unfinished.id,{method:'PATCH',headers:{cookie:acookie,'Content-Type':'application/json'},body:JSON.stringify({status:'Resolved'})})).status,409,'phase protection persists flagsOFF');
 assert.equal((await fetch(base+'/api/tickets/'+archive.ticketId+'/take',{method:'POST',headers:{cookie}})).status,403);
 const reassigned=await fetch(base+'/api/tickets/'+unfinished.id,{method:'PATCH',headers:{cookie:acookie,'Content-Type':'application/json'},body:JSON.stringify({assigneeId:outsider.id})});assert.equal(reassigned.status,200,'existing phase assignment persists flagsOFF');
 assert.ok((await p.ticketPhaseExecution.findMany({where:{ticketId:unfinished.id}})).every(x=>x.assigneeId===outsider.id));
 const deniedLegacy=await fetch(base+'/api/reports/performance/'+archive.userId,{headers:{cookie}});assert.equal(deniedLegacy.status,403,'legacy privacy persists flagsOFF');
 console.log('PASS isolated real HTTP: monthly take/notes/watchers/snooze/reply denied, private scope denied, unfinished Resolve denied, ownership/content unchanged, protections persist flagsOFF.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>p.$disconnect());
