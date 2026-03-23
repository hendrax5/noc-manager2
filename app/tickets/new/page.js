import TicketForm from "./TicketForm";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function NewTicketPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
  const categories = await prisma.jobCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  // Evaluate the dynamic components globally set by operations logic
  const customFields = await prisma.customField.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  const services = await prisma.service.findMany({ include: { customer: true }, orderBy: { name: 'asc' } });
  const serviceTemplates = await prisma.serviceTemplate.findMany({ orderBy: { name: 'asc' } });
  
  return (
    <main className="container">
      <header className="page-header">
        <h1>Submit New Ticket</h1>
        <p>Create a trackable operational ticket for your related sub-department.</p>
      </header>
      
      <TicketForm departments={departments} categories={categories} customFields={customFields} services={services} serviceTemplates={serviceTemplates} />
    </main>
  );
}
