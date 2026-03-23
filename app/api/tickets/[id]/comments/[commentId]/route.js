import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const commentId = parseInt(resolvedParams.commentId);
    
    const body = await req.json();
    const { text } = body;

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Forbidden or Not Found" }, { status: 403 });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { text }
    });

    return NextResponse.json(updated);
  } catch(error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
