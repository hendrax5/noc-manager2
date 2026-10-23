import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getServerSession} from 'next-auth';
import {authOptions} from '../auth/[...nextauth]/route';
import {workflowFlags} from '@/lib/workflows/flags';
import {submitDailyReport,reportDayRange} from '@/lib/reports/dailySubmission';
import {jakartaMonthRange,jakartaMonthKey} from '@/lib/reports/monthPeriod';
import {loadReportScope} from '@/lib/reports/reportScopeServer';
import {canReadReport} from '@/lib/reports/reportScope';
export async function GET(req){
 const session=await getServerSession(authOptions);
 if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!(await workflowFlags()).structured_daily_enabled)return NextResponse.json({error:'Laporan terstruktur belum aktif.'},{status:404});
 try{
 const q=new URL(req.url).searchParams,month=q.get('month')||jakartaMonthKey(),range=jakartaMonthRange(month);
 const {scope,users}=await loadReportScope(prisma,session.user,range.gte);
 const target=q.get('userId')?Number(q.get('userId')):Number(session.user.id);
 if(!canReadReport(scope,target))return NextResponse.json({error:'Forbidden'},{status:403});
 const reports=await prisma.dailyReport.findMany({where:{userId:target,reportDate:{gte:month+'-01',lt:month+'-32'}},include:{items:true},orderBy:[{reportDate:'desc'},{revision:'desc'}]});
 let activities=[];
 if(q.get('date')){
 const day=reportDayRange(q.get('date'));if(!q.get('date').startsWith(month+'-'))return NextResponse.json({error:'Tanggal di luar bulan.'},{status:400});
 const history=await prisma.ticketHistory.findMany({where:{actorId:target,createdAt:day,ticket:{purpose:'Work'},NOT:{action:{startsWith:'Workflow phase completed:'}}},select:{id:true,action:true,ticketId:true},orderBy:{createdAt:'asc'},take:300});
 const phases=await prisma.ticketPhaseExecution.findMany({where:{completedBy:target,completedAt:day,state:'Completed'},include:{definition:{select:{label:true}}},take:300});
 activities=[...history.map(h=>({id:h.id,source:'history',label:h.action,ticketId:h.ticketId})),...phases.map(p=>({id:p.id,source:'phase',label:p.definition.label+': '+p.evidence,ticketId:p.ticketId}))];
 }
 return NextResponse.json({reports,activities,users:users.filter(u=>canReadReport(scope,u.id)).map(u=>({id:u.id,name:u.name})),userId:target,month});
 }catch(e){return NextResponse.json({error:e.status?e.message:'Laporan gagal dimuat.'},{status:e.status||500});}
}
export async function POST(req){
 const session=await getServerSession(authOptions);if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
 const b=await req.json(),actorId=Number(session.user.id);
 if(b.reportDate){
 if(!(await workflowFlags()).structured_daily_enabled)return NextResponse.json({error:'Laporan terstruktur belum aktif.'},{status:404});
 if(b.userId&&Number(b.userId)!==actorId)return NextResponse.json({error:'Kirim laporan untuk diri sendiri.'},{status:403});
 const report=await prisma.$transaction(tx=>submitDailyReport(tx,{actorId,reportDate:b.reportDate,manualItems:b.manualItems,activityRefs:b.activityRefs,idempotencyKey:b.idempotencyKey,revision:b.revision,state:b.state}),{timeout:20000});
 return NextResponse.json(report,{status:201});
 }
 if(typeof b.content!=='string'||!b.content.trim()||b.content.length>30000)return NextResponse.json({error:'Isi laporan wajib, maksimal30000 karakter.'},{status:400});
 return NextResponse.json(await prisma.dailyReport.create({data:{content:b.content,userId:actorId}}),{status:201});
 }catch(e){return NextResponse.json({error:e.status?e.message:'Laporan gagal disimpan.'},{status:e.status||500});}
}
