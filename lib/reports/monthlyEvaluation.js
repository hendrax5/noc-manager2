import {validateEvaluationPolicy} from './evaluationPolicy.js';
export function evaluateMonthly({policy,evidence}){
 let partial=null;
 const insufficient=reason=>({status:'insufficient_data',dimensions:partial,total:null,coverage:evidence?.coverage||null,explanations:reason});
 if(!policy)return insufficient(['Target belum dikonfigurasi.']);
 validateEvaluationPolicy(policy);
 if(evidence){const ratio=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?Math.max(0,Math.min(100,a/b*100)):null;const eligible=evidence.eligibleMinutes>0&&evidence.scheduledMinutes>=evidence.eligibleMinutes;partial={outcome:eligible?ratio(evidence.units,policy.targetUnits*evidence.eligibleMinutes/evidence.scheduledMinutes):null,quality:ratio(evidence.qualityPassed,evidence.qualityCount),timeliness:ratio(evidence.onTime,evidence.timedCount),reporting:ratio(evidence.reportedDays,evidence.requiredDays)};}
 if(!evidence||evidence.missingReasons?.length)return insufficient(evidence?.missingReasons||['Bukti belum tersedia.']);
 if(!(evidence.eligibleMinutes>0&&evidence.scheduledMinutes>=evidence.eligibleMinutes&&evidence.qualityCount>0&&evidence.timedCount>0&&evidence.requiredDays>0))return insufficient(['Denominator belum lengkap.']);
 const cap=(a,b)=>Math.max(0,Math.min(100,a/b*100));
 const target=policy.targetUnits*evidence.eligibleMinutes/evidence.scheduledMinutes;
 const dimensions={outcome:cap(evidence.units,target),quality:cap(evidence.qualityPassed,evidence.qualityCount),timeliness:cap(evidence.onTime,evidence.timedCount),reporting:cap(evidence.reportedDays,evidence.requiredDays)};
 const total=Math.round(Object.entries(dimensions).reduce((sum,[key,value])=>sum+value*policy.weights[key]/100,0)*100)/100;
 return {status:'ready',dimensions,total,coverage:evidence.coverage||null,explanations:[{targetUnits:policy.targetUnits,proratedTarget:target,completedUnits:evidence.units,weights:policy.weights,formula:'sum(dimension × weight / 100)',cap:100}]};
}
export function aggregateEvaluations(rows){
 const ready=rows.filter(r=>r.status==='ready'&&Number.isFinite(r.total)),eligible=rows.filter(r=>r.status!=='excluded');
 return {mean:ready.length?Math.round(ready.reduce((s,r)=>s+r.total,0)/ready.length*100)/100:null,denominator:ready.length,excluded:rows.length-eligible.length,coverage:eligible.length?ready.length/eligible.length:0};
}
