import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import KnowledgeClient from "./KnowledgeClient";

export default async function KnowledgePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  // Fetch initial categories
  const initialCategories = await prisma.knowledgeCategory.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' }
  });

  return <KnowledgeClient session={session} initialCategories={initialCategories} />;
}
