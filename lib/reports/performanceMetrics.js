const date=v=>v?new Date(v).getTime():NaN;
const duration=(a,b)=>{const n=(date(b)-date(a))/60000;return Number.isFinite(n)&&n>=0?n:null;};
const stats=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return {value:v.length?v[Math.ceil(v.length*.5)-1]:null,p90:v.length?v[Math.ceil(v.length*.9)-1]:null,denominator:v.length};};

export function calculatePerformanceMetrics(bundle,policy) {
 const {userId,tickets=[],phases=[],reports=[],events=[],reviews=[]}=bundle;
 const uniquePhases=[...new Map(phases.filter(p=>p.completedBy===userId).map(p=>[p.id,p])).values()];
 const latestReports=[...new Map([...reports].sort((a,b)=>b.revision-a.revision).map(r=>[r.reportDate,r]).reverse()).values()].filter(r=>r.state==='Submitted');
 const validated=events.filter(e=>e.source==='human'&&e.actorId===userId&&e.validationState==='accepted');
 const objects=new Set(validated.map(e=>e.entityType+':'+e.entityId));
 const quality=reviews.filter(r=>r.source!=='report'&&typeof r.qualityPassed==='boolean');
 const reportReviews=reviews.filter(r=>r.source==='report'&&latestReports.some(report=>report.id===r.sourceId));
 const requiredDates=[...new Set(bundle.context?.requiredReportDates||[])];
 const deadlineMinutes=policy?.performanceRules?.reportDeadlineMinutes;
 const timely=Number.isFinite(deadlineMinutes)?requiredDates.filter(day=>{const report=latestReports.find(r=>r.reportDate===day);return report?.submittedAt&&date(report.submittedAt)<=date(day+'T00:00:00+07:00')+86400000+deadlineMinutes*60000;}).length:null;
 const jobs=(bundle.serviceJobs||[]).filter(t=>t.serviceChange?.operation!=='BOD'&&/^\d{4}-\d{2}-\d{2}$/.test(t.serviceChange?.effectiveDate||'')&&t.resolvedAt);
 const onRfs=jobs.filter(t=>date(t.resolvedAt)<=date(t.serviceChange.effectiveDate+'T23:59:59.999+07:00')).length;
 const bod=(bundle.serviceJobs||[]).filter(t=>t.serviceChange?.operation==='BOD'&&t.bodWindow?.restoredAt&&t.bodWindow?.endsAt);
 const timeline=(bundle.resolvedTickets||[]).map(ticket=>{const assignedAt=ticket.assignedAt||ticket.createdAt;return {ticketId:ticket.id,firstResponse:duration(assignedAt,ticket.firstRespondedAt),resolution:duration(assignedAt,ticket.resolvedAt),total:duration(ticket.createdAt,ticket.resolvedAt),internal:(ticket.comments||[]).some(c=>c.isPublic===false),onTime:ticket.resolutionDueAt&&ticket.resolvedAt?date(ticket.resolvedAt)<=date(ticket.resolutionDueAt):null,responseOnTime:ticket.responseDueAt&&ticket.firstRespondedAt?date(ticket.firstRespondedAt)<=date(ticket.responseDueAt):null,noBreach:Number(ticket.slaBreaches||0)===0};});
 const firstResponses=timeline.filter(row=>row.firstResponse!=null);
 const dueResolutions=timeline.filter(row=>row.onTime!=null);
 const dueResponses=timeline.filter(row=>row.responseOnTime!=null);
 const ticketRefs=rows=>rows.map(row=>({source:'ticket',sourceId:row.ticketId,ticketId:row.ticketId}));
 const percentage=(key,label,count,total,evidenceRefs)=>({key,label,value:total?Math.round(count/total*1000)/10:null,numerator:count,denominator:total,unit:'%',status:total?'available':'insufficient_data',evidenceRefs});
 return [
 {key:'first_response',label:'Respons pertama setelah penugasan (publik/internal)',...stats(firstResponses.map(r=>r.firstResponse)),unit:'menit',status:firstResponses.length?'observed':'insufficient_data',note:'Termasuk balasan internal. Waktu penugasan diambil dari riwayat tiket; bila tidak ada, dari pembuatan tiket.',evidenceRefs:ticketRefs(firstResponses)},
 {key:'accountable_time',label:'Waktu penanganan sejak penugasan',...stats(timeline.map(r=>r.resolution)),unit:'menit',status:timeline.length?'observed':'insufficient_data',note:'Dari penugasan sampai tiket selesai. Termasuk waktu tunggu, bukan jam kerja aktif.',evidenceRefs:ticketRefs(timeline)},
 {key:'resolution_total',label:'Total waktu penyelesaian tiket',...stats(timeline.map(r=>r.total)),unit:'menit',status:timeline.length?'observed':'insufficient_data',note:'Dari tiket dibuat sampai selesai, termasuk waktu sebelum penugasan.',evidenceRefs:ticketRefs(timeline)},
 {key:'tickets_resolved',label:'Tiket selesai',value:timeline.length,denominator:timeline.length,unit:'tiket',status:'available',evidenceRefs:ticketRefs(timeline)},
 {key:'internal_responses',label:'Tiket selesai dengan balasan internal',value:timeline.filter(row=>row.internal).length,denominator:timeline.length,unit:'tiket',status:'available',note:'Balasan internal dihitung sebagai respons; bukan hanya balasan publik.',evidenceRefs:ticketRefs(timeline.filter(row=>row.internal))},
 {...percentage('ticket_ontime','Tiket selesai sesuai tenggat',dueResolutions.filter(row=>row.onTime).length,dueResolutions.length,ticketRefs(dueResolutions)),note:'Berdasarkan tenggat resolusi yang tercatat pada tiket, bukan review manual.'},
 {...percentage('ticket_no_breach','Tiket selesai tanpa pelanggaran SLA',timeline.filter(row=>row.noBreach).length,timeline.length,ticketRefs(timeline)),note:'Berdasarkan penghitung pelanggaran SLA pada tiket yang selesai.'},
 ...(uniquePhases.length?[{key:'phase_elapsed',label:'Durasi kalender fase selesai',...stats(uniquePhases.map(p=>duration(p.startedAt,p.completedAt))),unit:'menit',status:'observed',note:'Termasuk waktu menunggu; bukan jam kerja aktif.',evidenceRefs:uniquePhases.map(p=>({source:'phase',sourceId:p.id,ticketId:p.ticketId}))}]:[]), {key:'completed_phases',label:'Fase pekerjaan selesai',value:uniquePhases.length,denominator:uniquePhases.length,unit:'fase',status:'available',evidenceRefs:uniquePhases.map(p=>({source:'phase',sourceId:p.id,ticketId:p.ticketId}))},
 ...(quality.length?[percentage('quality','Hasil kerja lolos review',quality.filter(r=>r.qualityPassed).length,quality.length,quality.map(r=>({source:r.source,sourceId:r.sourceId})))]:[]),
 ...(reviews.some(r=>typeof r.onTime==='boolean')?[percentage('timeliness','Hasil kerja tepat waktu menurut review',reviews.filter(r=>r.onTime===true).length,reviews.filter(r=>typeof r.onTime==='boolean').length,reviews.map(r=>({source:r.source,sourceId:r.sourceId})))]:[]),
 {key:'submitted_reports',label:'Hari laporan terkirim',value:new Set(latestReports.map(r=>r.reportDate)).size,denominator:null,unit:'hari',status:'available',note:'Jumlah laporan bukan penilaian kualitas isi.',evidenceRefs:latestReports.map(r=>({source:'report',sourceId:r.id}))},
 {key:'data_contribution',label:'Objek data diperbaiki dan tervalidasi',value:objects.size,denominator:events.filter(e=>e.source==='human').length,unit:'objek',status:'available',note:'Objek unik; menekan Simpan berulang tidak menambah kontribusi.',evidenceRefs:validated.map(e=>({source:'activity',sourceId:e.id}))},
 {key:'data_pending',label:'Perubahan data menunggu review',value:events.filter(e=>e.source==='human'&&e.validationState==='pending').length,denominator:null,unit:'perubahan',status:'available',evidenceRefs:[]},
 percentage('report_content','Kualitas isi laporan menurut review',reportReviews.filter(r=>r.qualityPassed).length,reportReviews.length,reportReviews.map(r=>({source:'report',sourceId:r.sourceId}))),
 {...percentage('report_ontime','Laporan terkirim tepat waktu',timely||0,timely==null?0:requiredDates.length,latestReports.map(r=>({source:'report',sourceId:r.id}))),note:'Mengikuti tanggal wajib dan tenggat kebijakan dalam WIB. Cuti dan hari libur mengikuti konteks yang divalidasi.'},
 {...percentage('rfs','Pencapaian RFS pekerjaan yang diikuti',onRfs,jobs.length,jobs.map(t=>({source:'ticket',sourceId:t.id,ticketId:t.id}))),note:'Hasil bersama pada tiket, bukan seluruh durasi yang dibebankan ke PIC terakhir. Menggunakan RFS yang tercatat saat ini, belum riwayat revisi tenggat.'},
 {...percentage('bod_restoration','Pengembalian BOD sesuai tenggat',bod.filter(t=>date(t.bodWindow.restoredAt)<=date(t.bodWindow.endsAt)).length,bod.length,bod.map(t=>({source:'ticket',sourceId:t.id,ticketId:t.id}))),note:'Terpisah dari RFS instalasi; berdasarkan konfirmasi pengembalian.'},
 {...percentage('followup','Follow-up sesuai tenggat respons',dueResponses.filter(row=>row.responseOnTime).length,dueResponses.length,ticketRefs(dueResponses)),note:'Berdasarkan tenggat respons yang tercatat; isi respons tetap perlu review.'},
 {key:'rework',label:'Pekerjaan ulang terverifikasi',value:null,denominator:null,status:'insufficient_data',note:'Reopen belum membedakan pekerjaan baru dan koreksi hasil secara terstruktur. Tidak menjadi penalti otomatis.',evidenceRefs:[]},
 ];
}
