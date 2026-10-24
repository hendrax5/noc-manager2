const date=v=>v?new Date(v).getTime():NaN;
const duration=(a,b)=>{const n=(date(b)-date(a))/60000;return Number.isFinite(n)&&n>=0?n:null;};
const stats=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return {value:v.length?v[Math.ceil(v.length*.5)-1]:null,p90:v.length?v[Math.ceil(v.length*.9)-1]:null,denominator:v.length};};

export function calculatePerformanceMetrics(bundle,policy) {
 const {userId,tickets=[],phases=[],reports=[],events=[],reviews=[]}=bundle;
 const responses=[];
 for(const t of tickets){const comments=(t.comments||[]).filter(c=>c.authorId===userId&&c.isPublic&&!c.isAutomated&&!c.isCreator).sort((a,b)=>date(a.createdAt)-date(b.createdAt));const first=comments[0];if(first)responses.push({minutes:duration(t.createdAt,first.createdAt),source:'comment',sourceId:first.id,ticketId:t.id});}
 const uniquePhases=[...new Map(phases.filter(p=>p.completedBy===userId).map(p=>[p.id,p])).values()];
 const latestReports=[...new Map([...reports].sort((a,b)=>b.revision-a.revision).map(r=>[r.reportDate,r]).reverse()).values()].filter(r=>r.state==='Submitted');
 const validated=events.filter(e=>e.source==='human'&&e.actorId===userId&&e.validationState==='accepted');
 const objects=new Set(validated.map(e=>e.entityType+':'+e.entityId));
 const quality=reviews.filter(r=>r.source!=='report'&&typeof r.qualityPassed==='boolean');
 const reportReviews=reviews.filter(r=>r.source==='report'&&latestReports.some(report=>report.id===r.sourceId));
 const requiredDates=[...new Set(bundle.context?.requiredReportDates||[])];
 const deadlineMinutes=policy?.performanceRules?.reportDeadlineMinutes;
 const timely=Number.isFinite(deadlineMinutes)?requiredDates.filter(day=>{const report=latestReports.find(r=>r.reportDate===day);return report?.submittedAt&&date(report.submittedAt)<=date(day+'T00:00:00+07:00')+86400000+deadlineMinutes*60000;}).length:null;
 const percentage=(key,label,count,total,evidenceRefs)=>({key,label,value:total?Math.round(count/total*1000)/10:null,numerator:count,denominator:total,unit:'%',status:total?'available':'insufficient_data',evidenceRefs});
 return [
 {key:'public_response',label:'Balasan publik pertama sejak tiket dibuat',...stats(responses.map(r=>r.minutes)),unit:'menit',status:responses.length?'observed':'insufficient_data',note:'Indikator observasi, belum mengukur waktu respons pelanggan atau jam tanggung jawab.',evidenceRefs:responses},
 {key:'phase_elapsed',label:'Durasi kalender fase selesai',...stats(uniquePhases.map(p=>duration(p.startedAt,p.completedAt))),unit:'menit',status:uniquePhases.length?'observed':'insufficient_data',note:'Termasuk waktu menunggu; bukan jam kerja aktif.',evidenceRefs:uniquePhases.map(p=>({source:'phase',sourceId:p.id,ticketId:p.ticketId}))},
 {key:'completed_phases',label:'Fase pekerjaan selesai',value:uniquePhases.length,denominator:uniquePhases.length,unit:'fase',status:'available',evidenceRefs:uniquePhases.map(p=>({source:'phase',sourceId:p.id,ticketId:p.ticketId}))},
 percentage('quality','Hasil kerja lolos review',quality.filter(r=>r.qualityPassed).length,quality.length,quality.map(r=>({source:r.source,sourceId:r.sourceId}))),
 percentage('timeliness','Hasil kerja tepat waktu menurut review',reviews.filter(r=>r.onTime===true).length,reviews.filter(r=>typeof r.onTime==='boolean').length,reviews.map(r=>({source:r.source,sourceId:r.sourceId}))),
 {key:'submitted_reports',label:'Hari laporan terkirim',value:new Set(latestReports.map(r=>r.reportDate)).size,denominator:null,unit:'hari',status:'available',note:'Jumlah laporan bukan penilaian kualitas isi.',evidenceRefs:latestReports.map(r=>({source:'report',sourceId:r.id}))},
 {key:'data_contribution',label:'Objek data diperbaiki dan tervalidasi',value:objects.size,denominator:events.filter(e=>e.source==='human').length,unit:'objek',status:'available',note:'Objek unik; menekan Simpan berulang tidak menambah kontribusi.',evidenceRefs:validated.map(e=>({source:'activity',sourceId:e.id}))},
 {key:'data_pending',label:'Perubahan data menunggu review',value:events.filter(e=>e.source==='human'&&e.validationState==='pending').length,denominator:null,unit:'perubahan',status:'available',evidenceRefs:[]},
 percentage('report_content','Kualitas isi laporan menurut review',reportReviews.filter(r=>r.qualityPassed).length,reportReviews.length,reportReviews.map(r=>({source:'report',sourceId:r.sourceId}))),
 {...percentage('report_ontime','Laporan terkirim tepat waktu',timely||0,timely==null?0:requiredDates.length,latestReports.map(r=>({source:'report',sourceId:r.id}))),note:'Mengikuti tanggal wajib dan tenggat kebijakan dalam WIB. Cuti dan hari libur mengikuti konteks yang divalidasi.'},
 {key:'accountable_time',label:'Waktu dalam tanggung jawab',value:null,denominator:null,unit:'menit',status:'insufficient_data',note:'Belum cukup interval tanggung jawab dan jadwal tervalidasi.',evidenceRefs:[]},
 ];
}
