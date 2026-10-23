import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAppConfig } from '@/lib/config';
import { validateWorkflowPolicy, WorkflowError } from '@/lib/workflows/policy';
export async function GET(){
 const session=await getServerSession(authOptions);
 if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(session.user.role!=='Admin'&&!session.user.permissions?.includes('manage_workflows'))return NextResponse.json({error:'Forbidden'},{status:403});
 return NextResponse.json(await prisma.workflowPolicyVersion.findMany({include:{phases:{include:{category:true},orderBy:{ordinal:'asc'}}},orderBy:{id:'desc'}}));
}
export async function POST(req){
 const session=await getServerSession(authOptions);
 if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(session.user.role!=='Admin'&&!session.user.permissions?.includes('manage_workflows'))return NextResponse.json({error:'Forbidden'},{status:403});
 try{
 const b=await req.json(),config=await getAppConfig();
 const companies=String(config.companyNames||'').split(',').map(x=>x.trim()).filter(Boolean);
 const categories=await prisma.jobCategory.findMany({where:{active:true}});
 if(!Array.isArray(b.phases))throw new WorkflowError('Fase wajib diisi.');
 const phases=b.phases.map(p=>({...p,jobCategoryId:Number(p.jobCategoryId),category:categories.find(c=>c.id===Number(p.jobCategoryId))||{active:false}}));
 const data={name:typeof b.name==='string'?b.name.trim():'',workType:b.workType,operation:b.workType==='ServiceWork'?b.operation:null,originCompany:b.originCompany||null,executorCompany:b.executorCompany||null,departmentId:b.departmentId?Number(b.departmentId):null,roleId:b.roleId?Number(b.roleId):null,effectiveFrom:new Date(b.effectiveFrom),createdBy:Number(session.user.id)};
 if(!data.name||data.name.length>80||!Number.isFinite(data.effectiveFrom.getTime()))throw new WorkflowError('Nama dan tanggal berlaku wajib valid.');
 for(const [field,model] of [['departmentId','department'],['roleId','role']])if(data[field]&&(!Number.isSafeInteger(data[field])||!(await prisma[model].findUnique({where:{id:data[field]}}))))throw new WorkflowError('Departemen/peran tidak valid.');
 validateWorkflowPolicy({...data,phases},{companyNames:companies});
 const result=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(761234001)::text`;
 if(b.publish){
 const overlap=await tx.workflowPolicyVersion.findFirst({where:{workType:data.workType,operation:data.operation,originCompany:data.originCompany,executorCompany:data.executorCompany,departmentId:data.departmentId,roleId:data.roleId,publishedAt:{not:null},OR:[{effectiveTo:null},{effectiveTo:{gt:data.effectiveFrom}}]}});
 if(overlap){
 if(overlap.effectiveFrom>=data.effectiveFrom)throw new WorkflowError('Versi pengganti harus berlaku setelah versi sebelumnya.',409);
 await tx.workflowPolicyVersion.update({where:{id:overlap.id},data:{effectiveTo:data.effectiveFrom}});
 }
 }
 return tx.workflowPolicyVersion.create({data:{...data,publishedAt:b.publish?new Date():null,phases:{create:phases.map((p,i)=>({key:p.key,label:p.label.trim(),ordinal:i,jobCategoryId:p.jobCategoryId}))}},include:{phases:true}});
 });
 return NextResponse.json(result,{status:201});
 }catch(e){return NextResponse.json({error:e instanceof WorkflowError?e.message:'Workflow gagal disimpan.'},{status:e.status||400});}
}
