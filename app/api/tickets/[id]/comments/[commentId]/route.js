import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const commentId = parseInt(resolvedParams.commentId);
    
    const body = await req.json();
    const { text } = body;

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const isAdministrasi = session?.user?.department?.toLowerCase() === 'administrasi' || session?.user?.department?.toLowerCase().includes('admin');
    const isAuthor = comment.authorId === parseInt(session.user.id);
    const minsSinceCreation = (new Date().getTime() - new Date(comment.createdAt).getTime()) / 60000;

    if (!isAdministrasi && (!isAuthor || minsSinceCreation > 15)) {
      return NextResponse.json({ error: "Forbidden. Edits are restricted to Administrasi or the author within 15 mins of posting." }, { status: 403 });
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

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const commentId = parseInt(resolvedParams.commentId);

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const isAdministrasi = session?.user?.department?.toLowerCase() === 'administrasi' || session?.user?.department?.toLowerCase().includes('admin');
    const isAuthor = comment.authorId === parseInt(session.user.id);
    const minsSinceCreation = (new Date().getTime() - new Date(comment.createdAt).getTime()) / 60000;

    if (!isAdministrasi && (!isAuthor || minsSinceCreation > 15)) {
      return NextResponse.json({ error: "Forbidden. Deletions are restricted to Administrasi or the author within 15 minutes of posting." }, { status: 403 });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { 
        deletedAt: new Date()
      }
    });

    return NextResponse.json({ message: "Deleted (Tombstone applied)", updated });
  } catch(error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
