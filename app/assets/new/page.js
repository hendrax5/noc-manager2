import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ServiceForm from "./ServiceForm";

export default async function NewAssetPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const hasPermission = session.user.permissions?.includes('manage_assets') || session.user.role === 'Admin' || session.user.role === 'Manager';
  if (!hasPermission) redirect('/assets');

  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
  const templates = await prisma.serviceTemplate.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

  return <ServiceForm session={session} customers={customers} templates={templates} />;
}
