import {resolveEvaluationPolicy} from './evaluationPolicy';
import {buildWorkEvidence} from './workEvidence';
import {evaluateMonthly} from './monthlyEvaluation';
import {jakartaMonthRange} from './monthPeriod';
export async function calculateUserEvaluation(db,{user,monthKey}){
 const range=jakartaMonthRange(monthKey);
 const [eligibility,policies,assignments]=await Promise.all([
 db.evaluationDepartmentEligibility.findMany(),
 db.evaluationPolicyVersion.findMany({where:{publishedAt:{not:null}}}),
 db.employeeAssignmentPeriod.findMany({where:{userId:user.id,effectiveFrom:{lt:range.lt},OR:[{effectiveTo:null},{effectiveTo:{gt:range.gte}}]}})
 ]);
 const assignment=assignments.length===1&&assignments[0].effectiveFrom<=range.gte&&(!assignments[0].effectiveTo||assignments[0].effectiveTo>=range.lt)?assignments[0]:null;
 const departmentId=assignment?.departmentId||user.departmentId;
 const selected=resolveEvaluationPolicy({departmentId,roleId:assignment?.roleId||user.roleId,company:assignment?.company,monthKey,eligibility,policies});
 const identity={userId:user.id,departmentId,roleId:assignment?.roleId||user.roleId,company:assignment?.company||null};
 if(selected.status==='excluded')return {...identity,status:'excluded',total:null,policyVersionId:null,dimensions:null,explanations:[selected.reason]};
 if(!assignment)return {...identity,status:'insufficient_data',total:null,policyVersionId:null,dimensions:null,explanations:['Penempatan peran/perusahaan belum mencakup satu bulan penuh, atau berubah dalam bulan ini. Perlu verifikasi.']};
 if(!selected.policy)return {...identity,status:'insufficient_data',total:null,policyVersionId:null,dimensions:null,explanations:[selected.reason]};
 const [phases,reports,reviews,context]=await Promise.all([
 db.ticketPhaseExecution.findMany({where:{completedBy:user.id,completedAt:range,state:'Completed'}}),
 db.dailyReport.findMany({where:{userId:user.id,reportDate:{gte:monthKey+'-01',lt:monthKey+'-32'}},include:{items:true},orderBy:{revision:'desc'}}),
 db.workEvidenceReference.findMany({where:{userId:user.id,monthKey}}),
 db.evaluationMonthlyContext.findUnique({where:{userId_monthKey:{userId:user.id,monthKey}}})
 ]);
 const latest=[...new Map([...reports].reverse().map(r=>[r.reportDate,r])).values()];
 const manualItems=latest.filter(r=>r.state==='Submitted').flatMap(r=>r.items.filter(i=>i.source==='manual').map(i=>({...i,report:r})));
 const evidence=buildWorkEvidence({userId:user.id,phases,manualItems,reviews,policy:selected.policy,context,reports:latest});
 return {...identity,...evaluateMonthly({policy:selected.policy,evidence}),policyVersionId:selected.policy.id,evidence,policy:selected.policy,candidates:[...phases.map(p=>({source:'phase',sourceId:p.id,label:p.evidence,categoryId:p.categorySnapshot?.id})),...manualItems.map(i=>({source:'manual',sourceId:i.id,label:i.description+' — '+i.result,categoryId:i.categorySnapshot?.id}))]};
}
