import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const sessionObj = await getServerSession(authOptions);
    if (!sessionObj) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const body = await req.json();
    const { presentUserIds } = body; // Array of IDs

    const targetSession = await prisma.meetingSession.update({
      where: { id: parseInt(resolvedParams.sessionId) },
      data: {
        presentAttendees: {
          set: presentUserIds.map(id => ({ id: parseInt(id) }))
        }
      },
      include: { presentAttendees: true }
    });

    return NextResponse.json(targetSession);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
