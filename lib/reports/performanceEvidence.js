import {jakartaMonthRange} from './monthPeriod.js';
export const canonicalEvidence=rows=>[...new Map(rows.map(r=>[r.source+':'+r.sourceId,r])).values()];
export const canReadPerformanceDetails=(actor,userId,stable)=>Number(actor.id)===userId||actor.role==='Admin'||stable===true;
export function fullMonthAssignment(rows,range){return rows.length===1&&new Date(rows[0].effectiveFrom)<=range.gte&&(!rows[0].effectiveTo||new Date(rows[0].effectiveTo)>=range.lt)?rows[0]:null;}
export function hasUnstableCohortAssignments(rows,range){return [...new Set(rows.map(r=>r.userId))].some(id=>!fullMonthAssignment(rows.filter(r=>r.userId===id),range));}

export async function collectPerformanceEvidence(db,{userId,monthKey}) {
 const range=jakartaMonthRange(monthKey);
 const [phases,reports,reviews,events,comments,logs,articles,actions,context]=await Promise.all([
  db.ticketPhaseExecution.findMany({where:{completedBy:userId,state:'Completed',completedAt:range}}),
  db.dailyReport.findMany({where:{userId,reportDate:{gte:monthKey+'-01',lt:monthKey+'-32'}},include:{items:true},orderBy:{revision:'desc'}}),
  db.workEvidenceReference.findMany({where:{userId,monthKey}}),
  db.activityEvent.findMany({where:{actorId:userId,occurredAt:range},orderBy:{occurredAt:'desc'}}),
  db.comment.findMany({where:{authorId:userId,createdAt:range},select:{id:true,authorId:true,isPublic:true,source:true,createdAt:true,ticket:{select:{id:true,createdAt:true,integrationAppId:true,historyLogs:{where:{action:{startsWith:'Ticket created'}},select:{actorId:true},take:1}}}}}),
  db.ticketHistory.findMany({where:{actorId:userId,createdAt:range},select:{id:true,action:true,awardedScore:true,createdAt:true,ticketId:true}}),
  db.knowledgeArticle.findMany({where:{authorId:userId,createdAt:range},select:{id:true,title:true,isPublished:true}}),
  db.actionItem.findMany({where:{assigneeId:userId,updatedAt:range},select:{id:true,task:true,status:true,dueDate:true,updatedAt:true,linkedTicketId:true}}),
  db.evaluationMonthlyContext.findUnique({where:{userId_monthKey:{userId,monthKey}}}),
 ]);
 const ticketMap=new Map();for(const c of comments){if(!ticketMap.has(c.ticket.id))ticketMap.set(c.ticket.id,{...c.ticket,comments:[]});ticketMap.get(c.ticket.id).comments.push({...c,ticket:undefined,isAutomated:c.source==='integration'||c.source==='system',isCreator:c.ticket.historyLogs.some(h=>h.actorId===userId)});}
 const ids=[...new Set([...phases.map(p=>p.ticketId),...logs.map(l=>l.ticketId)])];
 const serviceJobs=ids.length?await db.ticket.findMany({where:{id:{in:ids},resolvedAt:range,workType:'ServiceWork'},select:{id:true,resolvedAt:true,serviceChange:true,bodWindow:{select:{endsAt:true,restoredAt:true}}}}):[];
 return {userId,monthKey,context,phases,reports,reviews,events,tickets:[...ticketMap.values()],serviceJobs,articles,actions,logs,points:{ledger:logs.reduce((s,r)=>s+(r.awardedScore||0),0),events:logs.length},capturedAt:new Date().toISOString()};
}
