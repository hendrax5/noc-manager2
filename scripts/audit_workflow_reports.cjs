const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
 const [departments,users,counts,categories]=await Promise.all([p.department.findMany({select:{id:true,name:true}}),p.user.findMany({select:{id:true,departmentId:true,roleId:true}}),Promise.all([p.customer.count(),p.service.count(),p.ticket.count(),p.serviceIdentifier.count()]),p.jobCategory.findMany({select:{id:true,name:true,score:true,active:true}})]);
 const personal=categories.filter(c=>/daily\s*report|laporan\s*harian/i.test(c.name));
 console.log(JSON.stringify({departments,users:users.map(u=>({id:u.id,departmentId:u.departmentId,roleId:u.roleId})),protectedCounts:{customers:counts[0],services:counts[1],tickets:counts[2],identifiers:counts[3]},personalCategoryIds:personal.map(c=>c.id),monthlyCandidateCount:await p.ticket.count({where:{jobCategoryId:{in:personal.map(c=>c.id)}}})}));
})().catch(e=>{console.error('Audit failed:',e.code||e.message);process.exitCode=1;}).finally(()=>p.$disconnect());
