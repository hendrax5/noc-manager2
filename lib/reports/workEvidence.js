export function buildWorkEvidence({userId,phases=[],manualItems=[],reviews=[],policy={},context,reports=[]}={}){
 const missingReasons=[];
 if(!context||!Number.isFinite(context.scheduledMinutes)||!Number.isFinite(context.eligibleMinutes)||context.scheduledMinutes<=0||context.eligibleMinutes<=0||context.eligibleMinutes>context.scheduledMinutes||!Array.isArray(context.requiredReportDates))missingReasons.push('Jadwal efektif dan hari wajib laporan belum divalidasi.');
 const activities=[...phases.filter(p=>p.completedBy===userId).map(p=>({source:'phase',sourceId:p.id,categoryId:p.categorySnapshot?.id,result:p.evidence,occurredAt:p.completedAt})),...manualItems.filter(i=>i.reviewedAt&&i.report?.userId===userId).map(i=>({source:'manual',sourceId:i.id,categoryId:i.categorySnapshot?.id,result:i.result,occurredAt:i.report.submittedAt}))];
 const unique=[...new Map(activities.map(a=>[a.source+':'+a.sourceId,a])).values()];
 let units=0,qualityPassed=0,qualityCount=0,onTime=0,timedCount=0;
 for(const a of unique){
 const review=reviews.find(r=>r.source===a.source&&r.sourceId===a.sourceId);
 const weight=policy.categoryWeights?.[a.categoryId];
 if(typeof weight!=='number'||!Number.isFinite(weight)||weight<=0)missingReasons.push('Kompleksitas kategori belum dikonfigurasi: '+a.categoryId);else units+=weight;
 if(typeof review?.qualityPassed==='boolean'){qualityCount++;if(review.qualityPassed)qualityPassed++;}else missingReasons.push('Kualitas aktivitas belum direview: '+a.source+':'+a.sourceId);
 if(typeof review?.onTime==='boolean'){timedCount++;if(review.onTime)onTime++;}else missingReasons.push('Ketepatan waktu belum direview: '+a.source+':'+a.sourceId);
 a.review=review||null;a.weight=weight||null;
 }
 if(!unique.length)missingReasons.push('Belum ada hasil pekerjaan terverifikasi.');
 const requiredDates=[...new Set(context?.requiredReportDates||[])];
 const latest=[...new Map([...reports].sort((a,b)=>b.revision-a.revision).map(r=>[r.reportDate,r]).reverse()).values()];
 const reportedDays=new Set(latest.filter(r=>r.state==='Submitted'&&requiredDates.includes(r.reportDate)).map(r=>r.reportDate)).size;
 return {activities:unique,units,qualityPassed,qualityCount,onTime,timedCount,reportedDays,requiredDays:requiredDates.length,scheduledMinutes:context?.scheduledMinutes||0,eligibleMinutes:context?.eligibleMinutes||0,missingReasons:[...new Set(missingReasons)],coverage:{activities:unique.length,qualityReviewed:qualityCount,timeReviewed:timedCount}};
}
