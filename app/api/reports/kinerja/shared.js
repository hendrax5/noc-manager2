import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {prisma} from '@/lib/prisma';
import {workflowFlags} from '@/lib/workflows/flags';
import {loadReportScope} from '@/lib/reports/reportScopeServer';
import {jakartaMonthKey,jakartaMonthRange} from '@/lib/reports/monthPeriod';
import {WorkflowError} from '@/lib/workflows/policy';
export const failure=e=>NextResponse.json({error:e.status?e.message:'Kinerja gagal dimuat.'},{status:e.status||500,headers:{'Cache-Control':'private, no-store'}});
export const respond=data=>NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
export async function kinerjaAccess(req){
 const session=await getServerSession(authOptions);if(!session)throw new WorkflowError('Unauthorized',401);
 const flags=await workflowFlags();if(!flags.unified_performance_ui)throw new WorkflowError('Kinerja terpadu belum diaktifkan.',404);
 const query=new URL(req.url).searchParams,month=query.get('month')||jakartaMonthKey();
 const range=jakartaMonthRange(month),access=await loadReportScope(prisma,session.user,range.gte);
 return {...access,actor:session.user,month,query,flags,mode:flags.monthly_evaluation_mode==='official'?'official':'simulation'};
}
