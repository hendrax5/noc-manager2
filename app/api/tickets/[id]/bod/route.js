import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {prisma} from '@/lib/prisma';
import {canAccessBodTicket,confirmBodAction} from '@/lib/tickets/bod';
export async function GET(_req,{params}){
 const session=await getServerSession(authOptions);if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {id}=await params;if(!/^\d+$/.test(id))return NextResponse.json({error:'ID tidak valid.'},{status:400});
 const ticket=await prisma.ticket.findUnique({where:{id:Number(id)}});
 if(!ticket||!canAccessBodTicket(session.user,ticket))return NextResponse.json({error:'Tiket tidak tersedia.'},{status:404});
 const window=await prisma.bodWindow.findUnique({where:{ticketId:ticket.id}});
 return NextResponse.json({window,canConfirm:session.user.role==='Admin'||session.user.permissions?.includes('manage_tickets')||Number(session.user.id)===ticket.assigneeId});
}
export async function POST(req,{params}){
 const session=await getServerSession(authOptions);if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {id}=await params;if(!/^\d+$/.test(id))return NextResponse.json({error:'ID tidak valid.'},{status:400});
 try{const body=await req.json();const window=await prisma.$transaction(tx=>confirmBodAction(tx,{ticketId:Number(id),actor:session.user,action:body.action,confirmed:body.confirmed,evidence:body.evidence}),{timeout:15000});return NextResponse.json({window});}
 catch(e){if(e.status)return NextResponse.json({error:e.message},{status:e.status});console.error('BOD confirmation failed',e.name);return NextResponse.json({error:'Konfirmasi gagal. Muat ulang dan coba kembali.'},{status:500});}
}
