import {calculateUserEvaluation} from './evaluationServer';
import {collectPerformanceEvidence,fullMonthAssignment,canReadPerformanceDetails,hasUnstableCohortAssignments} from './performanceEvidence';
import {calculatePerformanceMetrics} from './performanceMetrics';
import {buildPerformanceAnalysis} from './performanceAnalysis';
import {rankDepartment,personalRank} from './departmentRanking';
import {jakartaMonthRange} from './monthPeriod';
import {canReadReport} from './reportScope';
import {WorkflowError} from '../workflows/policy';
export async function cohortHasTransfers(db,{month,departmentId,company}){const range=jakartaMonthRange(month);const rows=await db.employeeAssignmentPeriod.findMany({where:{departmentId,company,effectiveFrom:{lt:range.lt},OR:[{effectiveTo:null},{effectiveTo:{gt:range.gte}}]}});return hasUnstableCohortAssignments(rows,range);}

export async function cohortRows(db,{month,users,mode,usePublished=true}) {
 const range=jakartaMonthRange(month);
 const [stored,policies,assignments,departments,publications]=await Promise.all([
 db.monthlyEvaluation.findMany({where:{monthKey:month,userId:{in:users.map(u=>u.id)}},orderBy:{revision:'desc'}}),
 db.evaluationPolicyVersion.findMany(),
 db.employeeAssignmentPeriod.findMany({where:{userId:{in:users.map(u=>u.id)},effectiveFrom:{lt:range.lt},OR:[{effectiveTo:null},{effectiveTo:{gt:range.gte}}]}}),
 db.department.findMany({select:{id:true,name:true}}),
 mode==='official'&&usePublished?db.performancePublication.findMany({where:{monthKey:month},orderBy:{version:'desc'}}):[],
 ]);
 const latest=new Map();for(const s of stored)if(!latest.has(s.userId))latest.set(s.userId,s);
 const rows=[];
 for(const user of users){
  const a=fullMonthAssignment(assignments.filter(x=>x.userId===user.id),range);
  const currentPublications=[...new Map([...publications].reverse().map(p=>[p.departmentId+':'+p.company,p])).values()];
  const published=currentPublications.flatMap(p=>p.manifest?.members||[]).find(m=>m.userId===user.id);
  const s=published?stored.find(row=>row.id===published.evaluationId):latest.get(user.id);
  const calc=s?{...s.snapshot,id:s.id,revision:s.revision,reviewState:s.status,lockedAt:s.lockedAt,mode:s.mode,policyVersionId:s.policyVersionId}:await calculateUserEvaluation(db,{user,monthKey:month});
  const policy=policies.find(p=>p.id===calc.policyVersionId)||null;
  const departmentId=published?s.departmentId:a?.departmentId||user.departmentId;
  const unpublished=mode==='official'&&usePublished&&!published&&calc.status!=='excluded';
  rows.push({...calc,userId:user.id,name:user.name||'User '+user.id,departmentId,department:departments.find(d=>d.id===departmentId)?.name||'',company:published?s.company:a?.company||user.company||null,roleId:published?s.roleId:a?.roleId||user.roleId,assignmentStable:Boolean(a),status:unpublished?'unpublished':!a&&!published&&calc.status!=='excluded'?'insufficient_data':calc.status,total:unpublished||(!a&&!published)?null:calc.total,policy,mode:calc.mode||mode});
 }
 return rows;
}

export async function loadPersonalKinerja(db,{actor,scope,users,userId,month,mode}) {
 if(!canReadReport(scope,userId))throw new WorkflowError('Akses tidak tersedia.',403);
 const user=users.find(u=>u.id===userId);if(!user)throw new WorkflowError('User tidak ditemukan.',404);
 const own=(await cohortRows(db,{month,users:[user],mode}))[0];
 if(!canReadPerformanceDetails(actor,userId,own.assignmentStable))throw new WorkflowError('Detail lintas perubahan penempatan belum tersedia. Cakupan periode perlu diverifikasi.',403);
 const bundle=await collectPerformanceEvidence(db,{userId,monthKey:month});
 let metrics=calculatePerformanceMetrics(bundle,own.policy);
 const simulation=mode==='simulation';
 let publishedEvaluation=null;
 let ranking={score:own.total,rank:null,reason:own.status==='excluded'?'Departemen dikecualikan dari evaluasi.':'Penempatan perusahaan/periode belum tervalidasi.',mode,rankedCount:0,eligibleCount:0,unratedCount:0};
 if(own.company&&own.status!=='excluded'){
  if(simulation){
   const peers=users.filter(u=>u.departmentId===own.departmentId&&u.company===own.company);
   const rows=await cohortRows(db,{month,users:peers,mode});
   ranking=personalRank(rankDepartment(rows,{departmentId:own.departmentId,company:own.company,mode}),userId);
   if(await cohortHasTransfers(db,{month,departmentId:own.departmentId,company:own.company}))ranking={...ranking,rank:null,reason:'Terdapat perubahan penempatan dalam kelompok ini. Kebijakan prorata perlu diverifikasi.'};
  }else{
   const pub=await db.performancePublication.findFirst({where:{monthKey:month,departmentId:own.departmentId,company:own.company},orderBy:{version:'desc'}});
   const member=pub?.manifest?.members?.find(m=>m.userId===userId);
   if(member){publishedEvaluation=await db.monthlyEvaluation.findUnique({where:{id:member.evaluationId}});metrics=publishedEvaluation?.snapshot?.performance?.metrics||[];}
   ranking={score:member?.score??null,rank:member?.rank??null,rankedCount:pub?.manifest?.rankedCount||0,eligibleCount:pub?.manifest?.members?.length||0,unratedCount:0,mode,publicationId:pub?.id||null,reason:member?null:'Peringkat resmi belum dipublikasikan.'};
  }
 }
 const legacyTickets=await db.ticket.findMany({where:{assigneeId:userId,resolvedAt:jakartaMonthRange(month),awardedScore:{not:null}},select:{id:true,awardedScore:true}});
 const points={ledger:bundle.points.ledger,legacy:legacyTickets.reduce((s,t)=>s+(t.awardedScore||0),0)};
 const evaluated=publishedEvaluation?{...publishedEvaluation.snapshot,id:publishedEvaluation.id,revision:publishedEvaluation.revision,reviewState:publishedEvaluation.status,lockedAt:publishedEvaluation.lockedAt}:own;
 return {user:{id:userId,name:own.name,department:own.department,company:own.company},month,mode,evaluation:{id:evaluated.id,revision:evaluated.revision,status:evaluated.status,total:evaluated.total,dimensions:evaluated.dimensions,explanations:evaluated.explanations,reviewState:evaluated.reviewState,lockedAt:evaluated.lockedAt},ranking,points,metrics,analysis:publishedEvaluation?(publishedEvaluation.snapshot.performance?.analysis||{strengths:[],improvements:[],context:[],coverage:[{text:'Snapshot periode ini belum menyimpan analisis kegiatan.',evidenceRefs:[]}]}):buildPerformanceAnalysis({metrics}),activities:bundle.logs.slice(0,100),dataChanges:bundle.events.slice(0,100),articles:bundle.articles,actions:bundle.actions,capturedAt:publishedEvaluation?.snapshot?.performance?.capturedAt||bundle.capturedAt,canReview:Number(actor.id)!==userId&&(actor.role==='Admin'||actor.role==='Manager'||actor.permissions?.includes('review_evaluations'))};
}
