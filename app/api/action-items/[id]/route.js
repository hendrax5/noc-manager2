import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import {recordActivity} from '@/lib/activity/recordActivity';

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const resolvedParams = await params;
    const body = await req.json();
    const { status } = body;

    const item = await prisma.$transaction(async tx=>{
    const before=await tx.actionItem.findUnique({where:{id:parseInt(resolvedParams.id)}});
    const changed = await tx.actionItem.update({
      where: { id: parseInt(resolvedParams.id) },
      data: { status }
    });
    await recordActivity(tx,{actorId:Number(session.user.id),source:'human',type:'action_item.updated',entityType:'actionItem',entityId:changed.id,ticketId:changed.linkedTicketId,before,after:changed});
    return changed;
    });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
