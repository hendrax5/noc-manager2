import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {evaluationAccess} from '../shared';
import {reviewEvaluation,lockPeriod} from '@/lib/reports/evaluationReview';
export async function PATCH(req,{params}){
 try{const a=await evaluationAccess(req);if(a.error)return a.error;const {id}=await params,b=await req.json();
 const r=await prisma.$transaction(async tx=>{
 const row=await tx.monthlyEvaluation.findUnique({where:{id:Number(id)}});
 if(!row||row.monthKey!==a.month){const e=new Error('Not found');e.status=404;throw e;}
 return reviewEvaluation(tx,{evaluationId:row.id,actor:a.actor,scope:a.scope,expectedRevision:b.expectedRevision,decision:b.decision,reason:b.reason});
 });return NextResponse.json(r);
 }catch(e){return NextResponse.json({error:e.status?e.message:'Review gagal.'},{status:e.status||500});}
}
export async function POST(req,{params}){
 try{const a=await evaluationAccess(req);if(a.error)return a.error;
 const {id}=await params,b=await req.json();
 const row=await prisma.monthlyEvaluation.findUnique({where:{id:Number(id)}});
 if(!row||row.monthKey!==a.month||!a.scope.all&&!a.scope.userIds.includes(row.userId))return NextResponse.json({error:'Not found'},{status:404});
 return NextResponse.json(await prisma.$transaction(tx=>lockPeriod(tx,{monthKey:a.month,scope:{all:false,userIds:[row.userId]},actor:a.actor,expectedEvaluationId:row.id,expectedRevision:Number(b.expectedRevision)})));
 }catch(e){return NextResponse.json({error:e.status?e.message:'Penguncian gagal.'},{status:e.status||500});}
}
