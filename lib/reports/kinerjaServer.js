import {calculateUserEvaluation} from './evaluationServer';
import {collectPerformanceEvidence,fullMonthAssignment,canReadPerformanceDetails,hasUnstableCohortAssignments} from './performanceEvidence';
import {calculatePerformanceMetrics} from './performanceMetrics';
import {buildPerformanceAnalysis} from './performanceAnalysis';
import {loadTeamOperationalWindow,scoreActivity} from './activityScore';
import {jakartaMonthRange} from './monthPeriod';
import {canReadReport} from './reportScope';
import {
  buildRollingMonthKeys,
  resolveCompareMonthKey,
  computeMetricDelta,
  buildComparisonMap,
  classifyMemberTrend,
  clampTrendCount,
} from './performanceComparison';
import {WorkflowError} from '../workflows/policy';

const LOWER_IS_BETTER_METRIC_KEYS = new Set([
  'first_response',
  'accountable_time',
  'resolution_total',
  'phase_elapsed',
  'data_pending',
]);

export async function cohortHasTransfers(db,{month,departmentId,company}){
  const range=jakartaMonthRange(month);
  const rows=await db.employeeAssignmentPeriod.findMany({where:{departmentId,company,effectiveFrom:{lt:range.lt},OR:[{effectiveTo:null},{effectiveTo:{gt:range.gte}}]}});
  return hasUnstableCohortAssignments(rows,range);
}

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

export async function loadPersonalKinerja(db,{actor,scope,users,userId,month,compareMonth=null,trendMonths=null,query=null,mode}) {
  if(!canReadReport(scope,userId))throw new WorkflowError('Akses tidak tersedia.',403);
  const user=users.find(u=>u.id===userId);if(!user)throw new WorkflowError('User tidak ditemukan.',404);
  const own=(await cohortRows(db,{month,users:[user],mode}))[0];
  if(!canReadPerformanceDetails(actor,userId,own.assignmentStable))throw new WorkflowError('Detail lintas perubahan penempatan belum tersedia. Cakupan periode perlu diverifikasi.',403);

  const resolvedCompareMonth=resolveCompareMonthKey(month,compareMonth??query?.get?.('compareMonth'));
  const trendCount=clampTrendCount(trendMonths??query?.get?.('trendMonths'),6);
  const trendKeys=buildRollingMonthKeys(month,trendCount);
  const windowMonthKeys=[...new Set([...trendKeys,resolvedCompareMonth])];
  const simulation=mode==='simulation';
  const peers=simulation&&own.status!=='excluded'
    ?users.filter(u=>u.departmentId===own.departmentId&&(u.company||null)===(own.company||null))
    :[];
  const windowUserIds=peers.length?[...new Set([...peers.map(u=>u.id),userId])]:[userId];

  const [bundle,prevBundle,windowData,legacyTickets]=await Promise.all([
    collectPerformanceEvidence(db,{userId,monthKey:month,includeTicketTimeline:true}),
    resolvedCompareMonth===month
      ?Promise.resolve(null)
      :collectPerformanceEvidence(db,{userId,monthKey:resolvedCompareMonth,includeTicketTimeline:true}),
    loadTeamOperationalWindow(db,{userIds:windowUserIds,monthKeys:windowMonthKeys}),
    db.ticket.findMany({where:{assigneeId:userId,resolvedAt:jakartaMonthRange(month),awardedScore:{not:null}},select:{id:true,awardedScore:true}}),
  ]);

  const effectivePrevBundle=prevBundle||bundle;
  let metrics=calculatePerformanceMetrics(bundle,own.policy);
  const prevMetrics=calculatePerformanceMetrics(effectivePrevBundle,own.policy);

  const scoredByMonth=new Map();
  if(peers.length){
    for(const mKey of windowMonthKeys){
      const monthMap=windowData.byMonth.get(mKey);
      const cohortInput=peers.map(u=>({
        userId:u.id,
        departmentId:u.departmentId,
        company:u.company||null,
        ...(monthMap?.get(u.id)||{resolved:0,responses:0,points:0}),
      }));
      const scored=scoreActivity(cohortInput);
      scoredByMonth.set(mKey,new Map(scored.map(row=>[row.userId,row])));
    }
  }

  let publishedEvaluation=null;
  let ranking={score:own.total,rank:null,reason:own.status==='excluded'?'Departemen dikecualikan dari evaluasi.':'Penempatan perusahaan/periode belum tervalidasi.',mode,rankedCount:0,eligibleCount:0,unratedCount:0};
  if(own.status!=='excluded'){
    if(simulation){
      const currentCohortMap=scoredByMonth.get(month);
      const mine=currentCohortMap?.get(userId);
      const rankedCount=currentCohortMap?.size||0;
      ranking={score:mine?.score??null,rank:mine?.rank??null,rankedCount,eligibleCount:rankedCount,unratedCount:0,mode,reason:rankedCount?null:'Belum ada anggota pada departemen ini.'};
    }else if(own.company){
      const pub=await db.performancePublication.findFirst({where:{monthKey:month,departmentId:own.departmentId,company:own.company},orderBy:{version:'desc'}});
      const member=pub?.manifest?.members?.find(m=>m.userId===userId);
      if(member){publishedEvaluation=await db.monthlyEvaluation.findUnique({where:{id:member.evaluationId}});metrics=publishedEvaluation?.snapshot?.performance?.metrics||[];}
      ranking={score:member?.score??null,rank:member?.rank??null,rankedCount:pub?.manifest?.rankedCount||0,eligibleCount:pub?.manifest?.members?.length||0,unratedCount:0,mode,publicationId:pub?.id||null,reason:member?null:'Peringkat resmi belum dipublikasikan.'};
    }
  }

  const prevMetricMap=new Map(prevMetrics.map(m=>[m.key,m]));
  const comparison={};
  for(const m of metrics){
    const prevM=prevMetricMap.get(m.key);
    comparison[m.key]=computeMetricDelta(m.value,prevM?.value??null,{
      higherIsBetter:!LOWER_IS_BETTER_METRIC_KEYS.has(m.key),
      unit:m.unit==='%'?'pp':m.unit==='menit'?'minutes':'count',
      minPercentBase:m.unit==='menit'?5:2,
      deadbandAbs:m.unit==='%'?2:1,
    });
  }

  const getOperational=(mKey)=>{
    const cohortItem=scoredByMonth.get(mKey)?.get(userId);
    const raw=windowData.byMonth.get(mKey)?.get(userId);
    const src=cohortItem||raw||{resolved:0,responses:0,points:0,medianResponseMinutes:null,slaCleanPct:null,onTimePct:null};
    return {
      month:mKey,
      resolved:src.resolved||0,
      responses:src.responses||0,
      points:src.points||0,
      medianResponseMinutes:src.medianResponseMinutes??null,
      responseSampleCount:src.responseSampleCount||0,
      slaCleanPct:src.slaCleanPct??null,
      slaCleanCount:src.slaCleanCount||0,
      onTimePct:src.onTimePct??null,
      onTimeDueCount:src.onTimeDueCount||0,
      score:cohortItem?.score??null,
      rank:cohortItem?.rank??null,
    };
  };

  const curOp=getOperational(month);
  const prevOp=getOperational(resolvedCompareMonth);
  const trend=trendKeys.map(getOperational);
  const headlineDeltas=buildComparisonMap(curOp,prevOp);
  const trendDirection=classifyMemberTrend({current:curOp,previous:prevOp,deltas:headlineDeltas,history:trend});
  const kpiHeadline={
    current:curOp,
    previous:prevOp,
    deltas:headlineDeltas,
    trendDirection,
  };

  const points={ledger:bundle.points.ledger,legacy:legacyTickets.reduce((s,t)=>s+(t.awardedScore||0),0)};
  const timedById=new Map((bundle.resolvedTickets||[]).map(ticket=>[ticket.id,ticket]));
  const tickets=(bundle.involvedTickets||[]).map(ticket=>{
    const timed=timedById.get(ticket.id);
    const responseMinutes=timed?.firstRespondedAt?Math.round((new Date(timed.firstRespondedAt).getTime()-new Date(timed.assignedAt||timed.createdAt).getTime())/60000):null;
    return {id:ticket.id,trackingId:ticket.trackingId,title:ticket.title,status:ticket.status,role:ticket.assigneeId===userId?'PIC':'Respons',resolvedAt:ticket.resolvedAt,points:ticket.awardedScore||0,responseMinutes:Number.isFinite(responseMinutes)&&responseMinutes>=0?responseMinutes:null};
  }).sort((left,right)=>new Date(right.resolvedAt||0)-new Date(left.resolvedAt||0));

  const evaluated=publishedEvaluation?{...publishedEvaluation.snapshot,id:publishedEvaluation.id,revision:publishedEvaluation.revision,reviewState:publishedEvaluation.status,lockedAt:publishedEvaluation.lockedAt}:own;
  return {
    user:{id:userId,name:own.name,department:own.department,company:own.company},
    month,
    compareMonth:resolvedCompareMonth,
    trendMonths:trendKeys,
    mode,
    evaluation:{id:evaluated.id,revision:evaluated.revision,status:evaluated.status,total:evaluated.total,dimensions:evaluated.dimensions,explanations:evaluated.explanations,reviewState:evaluated.reviewState,lockedAt:evaluated.lockedAt},
    ranking,
    points,
    kpiHeadline,
    comparison,
    trend,
    tickets,
    metrics,
    analysis:publishedEvaluation?(publishedEvaluation.snapshot.performance?.analysis||{strengths:[],improvements:[],context:[],coverage:[{text:'Snapshot periode ini belum menyimpan analisis kegiatan.',evidenceRefs:[]}]}):buildPerformanceAnalysis({metrics}),
    activities:bundle.logs.slice(0,100),
    dataChanges:bundle.events.slice(0,100),
    articles:bundle.articles,
    actions:bundle.actions,
    capturedAt:publishedEvaluation?.snapshot?.performance?.capturedAt||bundle.capturedAt,
    canReview:Number(actor.id)!==userId&&(actor.role==='Admin'||actor.role==='Manager'||actor.permissions?.includes('review_evaluations')),
  };
}
