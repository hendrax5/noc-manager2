import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ServiceForm from "./ServiceForm";

export default async function NewAssetPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
  const templates = await prisma.serviceTemplate.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

  return <ServiceForm session={session} customers={customers} templates={templates} />;
}
