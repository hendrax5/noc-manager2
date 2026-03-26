import TicketForm from "./TicketForm";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

import { getAppConfig } from "@/lib/config";

export default async function NewTicketPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
  const categories = await prisma.jobCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  // Evaluate the dynamic components globally set by operations logic
  const customFields = await prisma.customField.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  const services = await prisma.service.findMany({ include: { customer: true }, orderBy: { name: 'asc' } });
  const serviceTemplates = await prisma.serviceTemplate.findMany({ orderBy: { name: 'asc' } });
  const users = await prisma.user.findMany({ 
    where: { role: { name: { not: 'Admin' } } }, 
    select: { id: true, name: true, email: true, departmentId: true } 
  });
  
  const config = getAppConfig();
  const companies = config.companyNames ? config.companyNames.split(',').map(s => s.trim()) : ["ION", "SDC", "Sistercompany"];
  const deptAutoRouteMap = config.deptAutoRouteMap || {};
  
  const creatorDeptId = session.user.departmentId;
  const targetRouteDeptId = creatorDeptId && deptAutoRouteMap[creatorDeptId] ? parseInt(deptAutoRouteMap[creatorDeptId]) : null;
  const defaultTargetDeptId = targetRouteDeptId || departments[0]?.id;

  return (
    <main className="container">
      <header className="page-header">
        <h1>Submit New Ticket</h1>
        <p>Create a trackable operational ticket for your related sub-department.</p>
      </header>
      
      <TicketForm departments={departments} categories={categories} customFields={customFields} services={services} serviceTemplates={serviceTemplates} users={users} companies={companies} defaultTargetDeptId={defaultTargetDeptId} />
    </main>
  );
}
