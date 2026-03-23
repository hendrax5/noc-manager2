import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ArticleDetailClient from "./ArticleDetailClient";

export default async function ArticleDetailPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const resolveParams = await params;
  
  const article = await prisma.knowledgeArticle.findUnique({
    where: { id: parseInt(resolveParams.id) },
    include: {
      category: true,
      author: { select: { id: true, name: true, email: true, avatarUrl: true, role: { select: { name: true } } } }
    }
  });

  if (!article) redirect('/knowledge');

  // Authorization check for drafts
  const isAdminOrManager = session.user.role === 'Admin' || session.user.role === 'Manager';
  if (!article.isPublished && !isAdminOrManager && article.authorId !== session.user.id) {
     redirect('/knowledge');
  }

  // Pass categories down in case they want to Edit
  const categories = await prisma.knowledgeCategory.findMany({
    orderBy: { name: 'asc' }
  });

  return <ArticleDetailClient article={article} session={session} categories={categories} />;
}
