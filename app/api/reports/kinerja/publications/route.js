import {prisma} from '@/lib/prisma';
import {cohortRows,cohortHasTransfers} from '@/lib/reports/kinerjaServer';
import {publicationManifest} from '@/lib/reports/performancePublication';
import {canReadReport} from '@/lib/reports/reportScope';
import {WorkflowError} from '@/lib/workflows/policy';
import {loadReportScope} from '@/lib/reports/reportScopeServer';
import {jakartaMonthRange} from '@/lib/reports/monthPeriod';
import {kinerjaAccess,respond,failure} from '../shared';
export async function POST(req){try{
 const a=await kinerjaAccess(req);
 if(!a.flags.performance_ranking_publication||a.mode!=='official')throw new WorkflowError('Publikasi resmi belum diaktifkan.',409);
 if(!(a.actor.role==='Admin'||a.actor.permissions?.includes('lock_evaluations')))throw new WorkflowError('Forbidden',403);
 const b=await req.json(),departmentId=Number(b.departmentId),company=b.company;
 if(!Number.isSafeInteger(departmentId)||departmentId<1||typeof company!=='string'||!company)throw new WorkflowError('Cohort tidak valid.');
 const members=a.users.filter(u=>u.departmentId===departmentId&&u.company===company);
 if(!members.length||members.some(u=>!canReadReport(a.scope,u.id)))throw new WorkflowError('Akses seluruh cohort diperlukan.',403);
 if(members.some(u=>u.id===Number(a.actor.id)))throw new WorkflowError('Tidak boleh mempublikasikan penilaian diri sendiri.',403);
 const record=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(761234002)::text`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(761234003)::text`;
  const current=await loadReportScope(tx,a.actor,jakartaMonthRange(a.month).gte);
  const currentMembers=current.users.filter(u=>u.departmentId===departmentId&&u.company===company);
  if(!currentMembers.length||currentMembers.some(u=>u.id===Number(a.actor.id)||!canReadReport(current.scope,u.id)))throw new WorkflowError('Cakupan cohort berubah. Muat ulang.',409);
  if(await cohortHasTransfers(tx,{month:a.month,departmentId,company}))throw new WorkflowError('Penempatan cohort berubah dalam bulan ini. Kebijakan prorata perlu diverifikasi.',409);
  const rows=await cohortRows(tx,{month:a.month,users:currentMembers,mode:a.mode,usePublished:false});
  const manifest=publicationManifest(rows,{departmentId,company});
  const latest=await tx.performancePublication.findFirst({where:{monthKey:a.month,departmentId,company},orderBy:{version:'desc'}});
  if(Number(b.expectedVersion)!==(latest?.version||0))throw new WorkflowError('Versi publikasi berubah.',409);
  const p=await tx.performancePublication.create({data:{monthKey:a.month,departmentId,company,version:(latest?.version||0)+1,manifest:JSON.parse(JSON.stringify(manifest)),publishedBy:Number(a.actor.id)}});
  await tx.reportConfigurationAudit.create({data:{actorId:Number(a.actor.id),kind:'performance_publication',recordId:p.id,payload:{month:a.month,departmentId,company,version:p.version}}});
  return p;
 },{timeout:60000});
 return respond({id:record.id,version:record.version});
 }catch(e){return failure(e);}}
