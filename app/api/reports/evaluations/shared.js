import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {prisma} from '@/lib/prisma';
import {workflowFlags} from '@/lib/workflows/flags';
import {loadReportScope} from '@/lib/reports/reportScopeServer';
import {canReadReport} from '@/lib/reports/reportScope';
import {jakartaMonthRange,jakartaMonthKey} from '@/lib/reports/monthPeriod';
import {calculateUserEvaluation} from '@/lib/reports/evaluationServer';
import {aggregateEvaluations} from '@/lib/reports/monthlyEvaluation';
import {WorkflowError} from '@/lib/workflows/policy';
export async function evaluationAccess(req){
 const session=await getServerSession(authOptions);
 if(!session)return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const flags=await workflowFlags();
 if(flags.monthly_evaluation_mode==='off')return {error:NextResponse.json({error:'Evaluasi belum aktif.'},{status:404})};
 const month=new URL(req.url).searchParams.get('month')||jakartaMonthKey(),range=jakartaMonthRange(month);
 const access=await loadReportScope(prisma,session.user,range.gte);
 return {...access,month,actor:session.user,mode:flags.monthly_evaluation_mode};
}
