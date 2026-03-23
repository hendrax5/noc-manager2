import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ArticleForm from "./ArticleForm";

export default async function NewArticlePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const categories = await prisma.knowledgeCategory.findMany({
    orderBy: { name: 'asc' }
  });

  return <ArticleForm categories={categories} session={session} />;
}
