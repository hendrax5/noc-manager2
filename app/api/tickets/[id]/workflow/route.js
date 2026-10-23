import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { workflowFlags } from '@/lib/workflows/flags';
import { completeTicketPhase } from '@/lib/workflows/ticketWorkflow';
import { canAccessPersonalTicket } from '@/lib/tickets/personalCategories';
async function access(params){
 const session=await getServerSession(authOptions);
 if(!session)return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 if(!(await workflowFlags()).work_phase_enabled)return {error:NextResponse.json({error:'Workflow belum aktif.'},{status:404})};
 const {id}=await params;const ticket=await prisma.ticket.findUnique({where:{id:Number(id)},include:{jobCategory:true}});
 if(!ticket||!canAccessPersonalTicket(session.user,ticket))return {error:NextResponse.json({error:'Not found'},{status:404})};
 return {session,ticket};
}
export async function GET(req,{params}){
 const a=await access(params);if(a.error)return a.error;
 return NextResponse.json(await prisma.ticketPhaseExecution.findMany({where:{ticketId:a.ticket.id},include:{definition:{select:{label:true,key:true}}},orderBy:{ordinal:'asc'}}));
}
export async function POST(req,{params}){
 const a=await access(params);if(a.error)return a.error;
 try{const b=await req.json();const result=await prisma.$transaction(async tx=>{
 const row=await tx.ticketPhaseExecution.findUnique({where:{id:Number(b.executionId)}});
 if(!row||row.ticketId!==a.ticket.id)return null;
 return completeTicketPhase(tx,{executionId:row.id,actor:a.session.user,idempotencyKey:b.idempotencyKey,evidence:b.evidence,overrideCategoryId:b.overrideCategoryId,reason:b.reason});
 });return result?NextResponse.json(result):NextResponse.json({error:'Not found'},{status:404});
 }catch(e){return NextResponse.json({error:e.status?e.message:'Fase gagal disimpan.'},{status:e.status||500});}
}
