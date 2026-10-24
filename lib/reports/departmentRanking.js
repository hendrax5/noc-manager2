import {validatePerformancePolicy} from './performancePolicy.js';

export function rankDepartment(rows,{departmentId,company,mode='simulation',publicationId=null}={}) {
 const cohort=rows.filter(r=>r.departmentId===departmentId&&r.company===company&&r.status!=='excluded');
 const ready=cohort.filter(r=>r.status==='ready'&&Number.isFinite(r.total)&&r.total>=0&&r.total<=100);
 let reason=null;
 const rules=cohort.map(r=>{try{return validatePerformancePolicy(r.policy?.performanceRules);}catch{return {rankable:false};}});
 if(!cohort.length)reason='Belum ada peserta pada periode ini.';
 else if(cohort.some(r=>r.assignmentStable===false))reason='Penempatan anggota berubah atau belum mencakup satu bulan penuh.';
 else if(cohort.some(r=>r.mode&&r.mode!==mode))reason='Mode penilaian peserta belum seragam.';
 else if(rules.some((r,i)=>!r.rankable||!r.calibratedRoles.includes(cohort[i].roleId))||new Set(rules.map(r=>r.calibrationKey)).size!==1)reason='Kebijakan peran belum dikalibrasi.';
 else if(ready.length/cohort.length<Math.max(...rules.map(r=>r.minimumCoverage)))reason='Cakupan penilaian belum mencukupi.';
 else if(ready.length<3)reason='Peringkat membutuhkan minimal 3 peserta yang dinilai.';
 const sorted=ready.map(r=>({...r,total:Math.round(r.total*100)/100})).sort((a,b)=>b.total-a.total);
 let rank=0;
 const ranks=sorted.map((r,i)=>{if(i===0||r.total!==sorted[i-1].total)rank=i+1;return {userId:r.userId,score:r.total,rank:reason?null:rank,tied:sorted.filter(x=>x.total===r.total).length>1};});
 return {ranks,rankedCount:ready.length,eligibleCount:cohort.length,unratedCount:cohort.length-ready.length,mode,publicationId,reason};
}

export function personalRank(result,userId) {
 const own=result.ranks.find(r=>r.userId===userId);
 return {score:own?.score??null,rank:own?.rank??null,tied:own?.tied??false,rankedCount:result.rankedCount,eligibleCount:result.eligibleCount,unratedCount:result.unratedCount,mode:result.mode,publicationId:result.publicationId,reason:result.reason||(!own?'Data penilaian pribadi belum tersedia.':null)};
}
