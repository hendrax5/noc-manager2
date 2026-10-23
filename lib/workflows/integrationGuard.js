import {WorkflowError} from './policy.js';
export async function assertIntegrationWorkflowUpdate(tx,ticket,body){
 if(ticket.purpose==='PersonalMonthlyReport')throw new WorkflowError('Arsip personal dikelola melalui Daily Report.',403);
 const phases=await tx.ticketPhaseExecution.findMany({where:{ticketId:ticket.id}});
 if(!phases.length)return;
 if(body.customData&&['Order Origin','Executing Vendor'].some(k=>Object.hasOwn(body.customData,k)&&(body.customData[k]||null)!==(ticket.customData?.[k]||null)))throw new WorkflowError('Routing workflow aktif tidak dapat diganti.',409);
 if(['Resolved','Closed'].includes(body.status)&&phases.some(p=>p.state!=='Completed'))throw new WorkflowError('Selesaikan seluruh fase sebelum Resolve.',409);
}
