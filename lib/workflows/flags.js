import { prisma } from '@/lib/prisma';
export async function workflowFlags(db=prisma){
 const row=await db.appSetting.findUnique({where:{key:'workflow_reporting_flags'}});
 try{return {work_phase_enabled:false,structured_daily_enabled:false,monthly_evaluation_mode:'off',...JSON.parse(row?.value||'{}')};}catch{return {work_phase_enabled:false,structured_daily_enabled:false,monthly_evaluation_mode:'off'};}
}
