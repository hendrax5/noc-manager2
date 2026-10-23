const fs=require('node:fs'),{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
 const arg=process.argv.find(x=>x.startsWith('--mapping='));if(!arg)throw new Error('Explicit reviewed mapping JSON required: --mapping=PATH; default dry-run.');
 const rows=JSON.parse(fs.readFileSync(arg.slice(10),'utf8'));
 if(!Array.isArray(rows))throw new Error('Mapping must be an array.');
 for(const row of rows){
 if(!Number.isSafeInteger(row.userId)||!Number.isSafeInteger(row.ticketId)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.monthKey))throw new Error('Invalid mapping.');
 await p.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${row.userId} FOR UPDATE`;
 const existing=await tx.monthlyReportContainer.findUnique({where:{userId_monthKey:{userId:row.userId,monthKey:row.monthKey}}});
 if(existing){if(existing.ticketId!==row.ticketId)throw new Error('Container conflict.');return;}
 const t=await tx.ticket.findUnique({where:{id:row.ticketId},include:{jobCategory:true,services:{select:{id:true}}}});
 if(!t||t.assigneeId!==row.userId||t.services.length||!(/daily\s*report|laporan\s*harian/i.test(t.jobCategory?.name||'')))throw new Error('Ambiguous archive; manual review required.');
 if(!process.argv.includes('--apply'))return;
 await tx.ticket.update({where:{id:t.id},data:{purpose:'PersonalMonthlyReport',enableSla:false}});
 await tx.monthlyReportContainer.create({data:{userId:row.userId,monthKey:row.monthKey,ticketId:t.id}});
 });
 }
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',reviewedMappings:rows.length}));
})().catch(e=>{console.error('Archive mapping failed:',e.code||e.message);process.exitCode=1;}).finally(()=>p.$disconnect());
