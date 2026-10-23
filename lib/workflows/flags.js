import { prisma } from '@/lib/prisma';
import { parseWorkflowFlags } from './flagsPolicy';
export async function workflowFlags(db=prisma){
 const [row,marker]=await Promise.all([db.appSetting.findUnique({where:{key:'workflow_reporting_flags'}}),db.appSetting.findUnique({where:{key:'workflow_reporting_schema_v1'}})]);
 return parseWorkflowFlags(row?.value,Boolean(marker));
}
