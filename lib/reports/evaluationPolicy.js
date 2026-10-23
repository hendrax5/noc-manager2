import {WorkflowError} from '../workflows/policy.js';
export const isEvaluationExcluded=(departmentId,eligibility=[])=>eligibility.some(e=>e.departmentId===departmentId&&e.enabled===false);
export function validateEvaluationPolicy(p){
 const keys=['outcome','quality','timeliness','reporting'];
 if(!p.weights||keys.some(k=>typeof p.weights[k]!=='number'||!Number.isFinite(p.weights[k])||p.weights[k]<0)||keys.reduce((s,k)=>s+p.weights[k],0)!==100)throw new WorkflowError('Bobot harus berjumlah100.');
 if(typeof p.targetUnits!=='number'||!Number.isFinite(p.targetUnits)||p.targetUnits<=0)throw new WorkflowError('Target harus positif.');
 if(p.categoryWeights&&Object.values(p.categoryWeights).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0))throw new WorkflowError('Bobot kompleksitas harus positif.');
 return p;
}
export function resolveEvaluationPolicy({departmentId,roleId,company,monthKey,eligibility=[],policies=[]}){
 if(isEvaluationExcluded(departmentId,eligibility))return {status:'excluded',policy:null,reason:'Departemen dikecualikan dari evaluasi.'};
 const matched=policies.filter(p=>p.publishedAt&&p.departmentId===departmentId&&p.roleId===roleId&&p.company===company&&p.effectiveMonth<=monthKey&&(!p.endMonth||monthKey<p.endMonth)).sort((a,b)=>b.effectiveMonth.localeCompare(a.effectiveMonth));
 if(!matched.length)return {status:'insufficient_data',policy:null,reason:'Target peran/departemen/perusahaan belum dikonfigurasi.'};
 if(matched[1]?.effectiveMonth===matched[0].effectiveMonth)throw new WorkflowError('Kebijakan penilaian ambigu.',409);
 return {status:'ready',policy:validateEvaluationPolicy(matched[0])};
}
