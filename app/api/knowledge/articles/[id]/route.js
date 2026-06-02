import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const resolveParams = await params;

    const article = await prisma.knowledgeArticle.findUnique({
      where: { id: parseInt(resolveParams.id) },
      include: {
        category: true,
        author: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    if (!article.isPublished && session.user.role !== 'Admin' && session.user.role !== 'Manager' && !session.user.permissions?.includes('manage_knowledge') && article.authorId !== session.user.id) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(article);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolveParams = await params;
    const existing = await prisma.knowledgeArticle.findUnique({ where: { id: parseInt(resolveParams.id) } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Only Author, Manager, Admin, or user with manage_knowledge can edit
    if (session.user.role !== 'Admin' && session.user.role !== 'Manager' && !session.user.permissions?.includes('manage_knowledge') && existing.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();

    const updated = await prisma.knowledgeArticle.update({
      where: { id: parseInt(resolveParams.id) },
      data: {
        title: data.title !== undefined ? data.title : existing.title,
        content: data.content !== undefined ? data.content : existing.content,
        categoryId: data.categoryId !== undefined ? parseInt(data.categoryId) : existing.categoryId,
        isPublished: data.isPublished !== undefined ? data.isPublished : existing.isPublished
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && session.user.role !== 'Manager' && !session.user.permissions?.includes('manage_knowledge'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolveParams = await params;
    await prisma.knowledgeArticle.delete({
      where: { id: parseInt(resolveParams.id) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}
