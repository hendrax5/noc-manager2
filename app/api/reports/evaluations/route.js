import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {prisma} from '@/lib/prisma';
import {workflowFlags} from '@/lib/workflows/flags';
import {loadReportScope} from '@/lib/reports/reportScopeServer';
import {canReadReport} from '@/lib/reports/reportScope';
import {jakartaMonthRange,jakartaMonthKey} from '@/lib/reports/monthPeriod';
import {calculateUserEvaluation} from '@/lib/reports/evaluationServer';
import {aggregateEvaluations} from '@/lib/reports/monthlyEvaluation';
import {WorkflowError} from '@/lib/workflows/policy';
import {evaluationAccess} from './shared';
export async function GET(req){
 try{
 const a=await evaluationAccess(req);if(a.error)return a.error;
 const q=new URL(req.url).searchParams;
 const selected=a.users.filter(u=>canReadReport(a.scope,u.id)&&(!q.get('departmentId')||u.departmentId===Number(q.get('departmentId')))&&(!q.get('company')||u.company===q.get('company')));
 const stored=await prisma.monthlyEvaluation.findMany({where:{monthKey:a.month,userId:{in:selected.map(u=>u.id)}},orderBy:{revision:'desc'}});
 const latest=[...new Map([...stored].reverse().map(r=>[r.userId,r])).values()];
 const rows=[];
 for(const user of selected){
 const row=latest.find(r=>r.userId===user.id);
 const calculated=row?{...row.snapshot,id:row.id,revision:row.revision,reviewState:row.status,lockedAt:row.lockedAt,mode:row.mode}:await calculateUserEvaluation(prisma,{user,monthKey:a.month});
 rows.push({...calculated,name:user.name||'User '+user.id,department:user.department?.name||'',mode:calculated.mode||a.mode});
 }
 return NextResponse.json({rows,aggregate:aggregateEvaluations(rows),month:a.month,mode:a.mode,categories:await prisma.jobCategory.findMany({where:{active:true},select:{id:true,name:true}}),currentUserId:Number(a.actor.id),canReview:a.actor.role==='Admin'||a.actor.role==='Manager'||a.actor.permissions?.includes('review_evaluations')});
 }catch(e){return NextResponse.json({error:e.status?e.message:'Evaluasi gagal dimuat.'},{status:e.status||500});}
}
export async function POST(req){
 try{
 const a=await evaluationAccess(req);if(a.error)return a.error;
 if(!(a.actor.role==='Admin'||a.actor.role==='Manager'||a.actor.permissions?.includes('review_evaluations')))throw new WorkflowError('Forbidden',403);
 const b=await req.json(),user=a.users.find(u=>u.id===Number(b.userId));
 if(!user||!canReadReport(a.scope,user.id))throw new WorkflowError('Akses tidak tersedia.',403);
 const row=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
 const latest=await tx.monthlyEvaluation.findFirst({where:{userId:user.id,monthKey:a.month},orderBy:{revision:'desc'}});
 if((latest?.revision||0)!==Number(b.expectedRevision||0))throw new WorkflowError('Revisi berubah. Muat ulang.',409);
 if(latest?.lockedAt&&(!(a.actor.role==='Admin'||a.actor.permissions?.includes('reopen_evaluations'))||typeof b.reason!=='string'||!b.reason.trim()))throw new WorkflowError('Evaluasi terkunci, perlu izin revisi dan alasan.',409);
 const snapshot=await calculateUserEvaluation(tx,{user,monthKey:a.month});
 const created=await tx.monthlyEvaluation.create({data:{userId:user.id,monthKey:a.month,revision:(latest?.revision||0)+1,departmentId:snapshot.departmentId,roleId:snapshot.roleId,company:snapshot.company,policyVersionId:snapshot.policyVersionId,mode:a.mode,status:snapshot.status,total:snapshot.total,snapshot:JSON.parse(JSON.stringify(snapshot))}});
 if(latest?.lockedAt)await tx.evaluationReviewEvent.create({data:{evaluationId:created.id,actorId:Number(a.actor.id),decision:'reopen_revision',reason:b.reason}});
 return created;
 },{timeout:20000});
 return NextResponse.json(row,{status:201});
 }catch(e){return NextResponse.json({error:e.status?e.message:'Evaluasi gagal dihitung.'},{status:e.status||500});}
}
