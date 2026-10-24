import {prisma} from '@/lib/prisma';
import {cohortRows} from '@/lib/reports/kinerjaServer';
import {canReadReport} from '@/lib/reports/reportScope';
import {aggregateEvaluations} from '@/lib/reports/monthlyEvaluation';
import {kinerjaAccess,respond,failure} from '../shared';
export async function GET(req){try{
 const a=await kinerjaAccess(req);
 const selected=a.users.filter(u=>canReadReport(a.scope,u.id));
 const allRows=await cohortRows(prisma,{month:a.month,users:selected,mode:a.mode});
 const rows=allRows.filter(r=>(!a.query.get('company')||r.company===a.query.get('company'))&&(!a.query.get('departmentId')||String(r.departmentId)===a.query.get('departmentId')));
 const groups=new Map();for(const r of rows){const key=r.departmentId+':'+r.company;if(!groups.has(key))groups.set(key,{departmentId:r.departmentId,department:r.department,company:r.company,rows:[]});groups.get(key).rows.push(r);}
 const publications=await prisma.performancePublication.findMany({where:{monthKey:a.month},select:{id:true,departmentId:true,company:true,version:true},orderBy:{version:'desc'}});
 return respond({month:a.month,mode:a.mode,currentUserId:Number(a.actor.id),canPublish:a.flags.performance_ranking_publication&&a.mode==='official'&&(a.actor.role==='Admin'||a.actor.permissions?.includes('lock_evaluations')),canViewTeam:selected.some(u=>u.id!==Number(a.actor.id)),aggregate:aggregateEvaluations(rows),groups:[...groups.values()].map(g=>({...g,rows:undefined,...aggregateEvaluations(g.rows),publicationVersion:publications.find(p=>p.departmentId===g.departmentId&&p.company===g.company)?.version||0})),rows:rows.map(r=>({userId:r.userId,name:r.name,departmentId:r.departmentId,department:r.department,company:r.company,total:r.total,status:r.status,reviewState:r.reviewState})),departments:[...new Map(allRows.map(r=>[r.departmentId,{id:r.departmentId,name:r.department}])).values()],companies:[...new Set(allRows.map(r=>r.company).filter(Boolean))]});
 }catch(e){return failure(e);}}
