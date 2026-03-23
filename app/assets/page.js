import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AssetClient from "./AssetClient";

export default async function AssetsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { services: true } } } });
  const templates = await prisma.serviceTemplate.findMany({ orderBy: { name: 'asc' } });
  const services = await prisma.service.findMany({ 
     include: { customer: true, template: true, hops: { orderBy: { orderIndex: 'asc' } }, _count: { select: { tickets: true } } },
     orderBy: { createdAt: 'desc' }
  });

  return <AssetClient session={session} initialCustomers={customers} initialTemplates={templates} initialServices={services} />;
}
