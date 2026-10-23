import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {prisma} from '@/lib/prisma';
import {getAppConfig} from '@/lib/config';
import {validateEvaluationPolicy} from '@/lib/reports/evaluationPolicy';
import {jakartaMonthRange} from '@/lib/reports/monthPeriod';
import {WorkflowError} from '@/lib/workflows/policy';
import {loadReportScope} from '@/lib/reports/reportScopeServer';
import {canReadReport} from '@/lib/reports/reportScope';
const admin=u=>u.role==='Admin';
const reviewer=u=>admin(u)||u.role==='Manager'||u.permissions?.includes('review_evaluations');
const positive=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw new WorkflowError('ID harus bilangan bulat positif.');return n;};
export async function GET(){
 const s=await getServerSession(authOptions);if(!s)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!admin(s.user))return NextResponse.json({error:'Forbidden'},{status:403});
 const [users,departments,roles,categories,policies,grants,eligibility,config]=await Promise.all([prisma.user.findMany({select:{id:true,name:true,departmentId:true}}),prisma.department.findMany({select:{id:true,name:true}}),prisma.role.findMany({select:{id:true,name:true}}),prisma.jobCategory.findMany({where:{active:true}}),prisma.evaluationPolicyVersion.findMany({orderBy:{id:'desc'}}),prisma.reportAccessGrant.findMany(),prisma.evaluationDepartmentEligibility.findMany(),getAppConfig()]);
 return NextResponse.json({users,departments,roles,categories,policies,grants,eligibility,companies:String(config.companyNames||'').split(',').map(x=>x.trim()).filter(Boolean)});
}
export async function POST(req){
 const s=await getServerSession(authOptions);if(!s)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
 const b=await req.json();if(b.kind==='evidence'||b.kind==='context'){if(!reviewer(s.user))throw new WorkflowError('Forbidden',403);}else if(!admin(s.user))throw new WorkflowError('Forbidden',403);
 if(!['policy','assignment','grant','context','evidence'].includes(b.kind))throw new WorkflowError('Jenis pengaturan tidak valid.');
 const config=await getAppConfig(),companies=String(config.companyNames||'').split(',').map(x=>x.trim());
 if(['policy','assignment','grant'].includes(b.kind)&&!companies.includes(b.company))throw new WorkflowError('Pilih perusahaan dari routing existing.');
 const actorId=Number(s.user.id),userId=b.userId?positive(b.userId):null;
 if(userId&&!(await prisma.user.findUnique({where:{id:userId}})))throw new WorkflowError('User tidak ditemukan.');
 if(['context','evidence'].includes(b.kind)){
 const range=jakartaMonthRange(b.monthKey),a=await loadReportScope(prisma,s.user,range.gte);
 if(userId===actorId||!canReadReport(a.scope,userId))throw new WorkflowError('Review harus oleh pihak berizin selain pelaksana.',403);
 }
 const record=await prisma.$transaction(async tx=>{
 let record;
 if(b.kind==='policy'){
 const departmentId=positive(b.departmentId),roleId=positive(b.roleId);
 if(!(await tx.department.findUnique({where:{id:departmentId}}))||!(await tx.role.findUnique({where:{id:roleId}})))throw new WorkflowError('Departemen/peran tidak ditemukan.');
 if((await tx.evaluationDepartmentEligibility.findUnique({where:{departmentId}}))?.enabled===false)throw new WorkflowError('Departemen dikecualikan dari penilaian.');
 jakartaMonthRange(b.effectiveMonth);
 const p=validateEvaluationPolicy({weights:b.weights,targetUnits:Number(b.targetUnits),categoryWeights:b.categoryWeights});
 if(!b.rubric||['quality','timeliness'].some(k=>typeof b.rubric[k]!=='string'||!b.rubric[k].trim()||b.rubric[k].length>4000))throw new WorkflowError('Rubrik kualitas dan waktu wajib diisi.');
 for(const id of Object.keys(b.categoryWeights||{}))if(!await tx.jobCategory.findFirst({where:{id:positive(id),active:true}}))throw new WorkflowError('Kategori kompleksitas harus aktif.');
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(761234003)`;
 const existing=await tx.evaluationPolicyVersion.findUnique({where:{departmentId_roleId_company_effectiveMonth:{departmentId,roleId,company:b.company,effectiveMonth:b.effectiveMonth}}});
 const data={departmentId,roleId,company:b.company,effectiveMonth:b.effectiveMonth,weights:p.weights,targetUnits:p.targetUnits,categoryWeights:p.categoryWeights||{},rubric:b.rubric,publishedAt:b.publish?new Date():null,createdBy:actorId};
 if(existing?.publishedAt)throw new WorkflowError('Kebijakan published tidak dapat diubah. Buat versi bulan berikutnya.',409);
 record=existing?await tx.evaluationPolicyVersion.update({where:{id:existing.id},data}):await tx.evaluationPolicyVersion.create({data});
 }else if(b.kind==='assignment'||b.kind==='grant'){
 const effectiveFrom=new Date(b.effectiveFrom),effectiveTo=b.effectiveTo?new Date(b.effectiveTo):null;
 if(!Number.isFinite(effectiveFrom.getTime())||effectiveTo&&(!Number.isFinite(effectiveTo.getTime())||effectiveTo<=effectiveFrom))throw new WorkflowError('Periode tidak valid.');
 const departmentId=positive(b.departmentId);
 if(!await tx.department.findUnique({where:{id:departmentId}}))throw new WorkflowError('Departemen tidak ditemukan.');
 if(b.kind==='assignment'){
 if(!userId)throw new WorkflowError('User wajib.');
 const roleId=positive(b.roleId);if(!await tx.role.findUnique({where:{id:roleId}}))throw new WorkflowError('Peran tidak ditemukan.');
 await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
 const overlaps=await tx.employeeAssignmentPeriod.findFirst({where:{userId,effectiveFrom:{lt:effectiveTo||new Date('9999-01-01')},OR:[{effectiveTo:null},{effectiveTo:{gt:effectiveFrom}}]}});
 if(overlaps)throw new WorkflowError('Periode penempatan bertumpuk.',409);
 record=await tx.employeeAssignmentPeriod.create({data:{userId,departmentId,roleId,company:b.company,effectiveFrom,effectiveTo,createdBy:actorId}});
 }else{
 const target=await tx.user.findUnique({where:{id:positive(b.actorId)},include:{role:true}});
 if(!target||!(target.role.name==='Manager'||target.role.name==='Admin'||target.role.permissions?.includes('view_team_reports')))throw new WorkflowError('Penerima akses harus memiliki izin laporan tim.');
 record=await tx.reportAccessGrant.create({data:{actorId:target.id,userId,departmentId,company:b.company,effectiveFrom,effectiveTo,createdBy:actorId}});
 }
 }else if(b.kind==='context'){
 const scheduledMinutes=Number(b.scheduledMinutes),eligibleMinutes=Number(b.eligibleMinutes);
 if(!Number.isSafeInteger(scheduledMinutes)||!Number.isSafeInteger(eligibleMinutes)||eligibleMinutes<=0||scheduledMinutes<eligibleMinutes||scheduledMinutes>31*24*60)throw new WorkflowError('Menit kerja efektif tidak valid.');
 if(!Array.isArray(b.requiredReportDates)||b.requiredReportDates.length>31||b.requiredReportDates.some(d=>typeof d!=='string'||!d.startsWith(b.monthKey+'-')||new Date(d).toISOString().slice(0,10)!==d))throw new WorkflowError('Hari wajib laporan tidak valid.');
 if(typeof b.note!=='string'||!b.note.trim()||b.note.length>4000)throw new WorkflowError('Catatan sumber jadwal/cuti wajib.');
 record=await tx.evaluationMonthlyContext.upsert({where:{userId_monthKey:{userId,monthKey:b.monthKey}},create:{userId,monthKey:b.monthKey,scheduledMinutes,eligibleMinutes,requiredReportDates:b.requiredReportDates,note:b.note,reviewedBy:actorId},update:{scheduledMinutes,eligibleMinutes,requiredReportDates:b.requiredReportDates,note:b.note,reviewedBy:actorId,reviewedAt:new Date()}});
 }else{
 if(!['phase','manual'].includes(b.source)||typeof b.qualityPassed!=='boolean'||typeof b.onTime!=='boolean'||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>4000)throw new WorkflowError('Bukti/rubrik review tidak valid.');
 const sourceId=positive(b.sourceId),range=jakartaMonthRange(b.monthKey);
 if(b.source==='phase'){
 const phase=await tx.ticketPhaseExecution.findFirst({where:{id:sourceId,completedBy:userId,state:'Completed',completedAt:range}});
 if(!phase)throw new WorkflowError('Fase bukan milik pelaksana/periode.',403);
 }else{
 const item=await tx.dailyReportItem.findUnique({where:{id:sourceId},include:{report:true}});
 if(!item||item.source!=='manual'||item.report.userId!==userId||item.report.state!=='Submitted'||!item.report.reportDate?.startsWith(b.monthKey+'-'))throw new WorkflowError('Pekerjaan manual tidak sesuai pelapor/periode.',403);
 const category=await tx.jobCategory.findUnique({where:{id:positive(b.jobCategoryId)}});
 if(!category?.active)throw new WorkflowError('Kategori aktif wajib.');
 await tx.dailyReportItem.update({where:{id:item.id},data:{reviewedAt:new Date(),reviewedBy:actorId,categorySnapshot:{id:category.id,name:category.name,score:category.score}}});
 }
 const data={userId,monthKey:b.monthKey,source:b.source,sourceId,qualityPassed:b.qualityPassed,onTime:b.onTime,reason:b.reason,assessedBy:actorId};
 record=await tx.workEvidenceReference.upsert({where:{source_sourceId:{source:b.source,sourceId}},create:data,update:{...data,assessedAt:new Date()}});
 }
 await tx.reportConfigurationAudit.create({data:{actorId,kind:b.kind,recordId:record.id||null,payload:JSON.parse(JSON.stringify(record))}});
 return record;
 },{timeout:20000});
 return NextResponse.json(record,{status:201});
 }catch(e){return NextResponse.json({error:e.status?e.message:e.code==='P2002'?'Aturan/periode sudah ada.':'Pengaturan gagal disimpan.'},{status:e.status||400});}
}
