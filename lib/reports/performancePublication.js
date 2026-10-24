import {WorkflowError} from '../workflows/policy.js';
import {rankDepartment} from './departmentRanking.js';

export function publicationManifest(rows,cohort) {
 const included=rows.filter(r=>r.departmentId===cohort.departmentId&&r.company===cohort.company);
 const eligible=included.filter(r=>r.status!=='excluded');
 if(eligible.some(r=>r.status!=='ready'||r.mode!=='official'||!r.lockedAt||r.reviewState!=='locked'||!r.id))throw new WorkflowError('Seluruh peserta harus siap, direview, dan terkunci dalam mode resmi.',409);
 const ranked=rankDepartment(eligible,{...cohort,mode:'official'});
 if(ranked.reason)throw new WorkflowError(ranked.reason,409);
 return {members:eligible.map(r=>({userId:r.userId,evaluationId:r.id,revision:r.revision,score:r.total,rank:ranked.ranks.find(x=>x.userId===r.userId)?.rank,policyVersionId:r.policyVersionId})),excluded:included.filter(r=>r.status==='excluded').map(r=>({userId:r.userId,reason:r.explanations})),calibrationKey:eligible[0].policy.performanceRules.calibrationKey,rankedCount:ranked.rankedCount};
}
