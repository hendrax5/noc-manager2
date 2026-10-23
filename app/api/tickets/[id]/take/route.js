import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {workflowFlags} from '@/lib/workflows/flags';
import {takeTicket} from '@/lib/workflows/ticketOwnership';
export async function POST(req,{params}){
 const s=await getServerSession(authOptions);if(!s)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const {id}=await params,enabled=(await workflowFlags()).work_phase_enabled;
 return NextResponse.json(await prisma.$transaction(tx=>takeTicket(tx,{ticketId:Number(id),actor:s.user,enabled})));
 }catch(e){return NextResponse.json({error:e.status?e.message:'Tiket gagal diambil.'},{status:e.status||500});}
}
