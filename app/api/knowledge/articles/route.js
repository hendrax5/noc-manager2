import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const q = searchParams.get('q');

    const where = { isPublished: true };
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } }
      ];
    }
    
    // Admins and Managers can see unpublished articles
    if (session.user.role === 'Admin' || session.user.role === 'Manager') {
      delete where.isPublished; 
    }

    const articles = await prisma.knowledgeArticle.findMany({
      where,
      include: {
        category: true,
        author: { select: { id: true, name: true, email: true, avatarUrl: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    // Only Admin, Manager, and NOC roles (or whoever is authorized) can create KB.
    // Let's allow any authorized staff to draft, but maybe restrict if needed later.
    // For now, allow all authenticated users (except maybe basic viewers, assuming everyone is staff).
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const json = await request.json();
    const { title, content, categoryId, isPublished } = json;

    const article = await prisma.knowledgeArticle.create({
      data: {
        title,
        content,
        categoryId: parseInt(categoryId),
        isPublished: isPublished !== undefined ? isPublished : true,
        authorId: session.user.id
      }
    });

    return NextResponse.json(article);
  } catch (error) {
    console.error('Create Error:', error);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
