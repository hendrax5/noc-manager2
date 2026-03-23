import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id);
  
  const ticket = await prisma.ticket.update({
    where: { id },
    data: { 
      assigneeId: parseInt(session.user.id),
      status: 'Open' 
    }
  });

  await prisma.ticketHistory.create({
    data: {
      action: `Self-Assigned and Opened ticket`,
      actorId: parseInt(session.user.id),
      ticketId: id
    }
  });

  return NextResponse.json(ticket);
}
