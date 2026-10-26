import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ServiceDetailClient from "./ServiceDetailClient";

export default async function ServiceDetailPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const resolveParams = await params;
  
  const service = await prisma.service.findUnique({
    where: { id: parseInt(resolveParams.id) },
    include: {
      identifiers: {select:{code:true,family:true}},
      customer: true,
      template: true,
      hops: { orderBy: { orderIndex: 'asc' } },
      tickets: {
        orderBy: { createdAt: 'desc' },
        include: { assignee: { select: { name: true } } }
      }
    }
  });

  if (!service) redirect('/assets');

  const templates = await prisma.serviceTemplate.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, fields: true },
  });

  return <ServiceDetailClient service={service} session={session} templates={templates} />;
}
