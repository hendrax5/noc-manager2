export function buildPerformanceAnalysis({metrics=[],previousSnapshot=null}) {
 const strengths=[],improvements=[],context=[],coverage=[];
 for(const metric of metrics){
  if(metric.value==null){coverage.push({text:metric.label+': '+(metric.note||'Belum cukup bukti.'),evidenceRefs:metric.evidenceRefs||[]});continue;}
  if(metric.key==='completed_phases'&&metric.value>0)strengths.push({text:`Menyelesaikan ${metric.value} fase pekerjaan yang tercatat.`,evidenceRefs:metric.evidenceRefs});
  if(metric.key==='data_contribution'&&metric.value>0)strengths.push({text:`Memperbaiki ${metric.value} objek data yang sudah divalidasi.`,evidenceRefs:metric.evidenceRefs});
  if(['quality','timeliness'].includes(metric.key))context.push({text:`${metric.label}: ${metric.numerator} dari ${metric.denominator} bukti yang direview.`,evidenceRefs:metric.evidenceRefs});
  if(metric.key==='data_pending'&&metric.value>0)improvements.push({text:`${metric.value} perubahan data masih memerlukan pemeriksaan, belum dinyatakan salah.`,evidenceRefs:metric.evidenceRefs});
 }
 if(!previousSnapshot)context.push({text:'Perbandingan bulan sebelumnya belum tersedia pada ringkasan ini.',evidenceRefs:[]});
 return {strengths,improvements,context,coverage,evidenceRefs:metrics.flatMap(m=>m.evidenceRefs||[])};
}
