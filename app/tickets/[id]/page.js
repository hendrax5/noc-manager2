import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TicketDetailClient from "./TicketDetailClient";

export default async function TicketDetailsPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const resolvedParams = await params;
  const ticketId = parseInt(resolvedParams.id);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { 
      department: true, 
      assignee: true, 
      attachments: true,
      actionItem: { include: { meeting: true } },
      services: { include: { customer: true } },
      historyLogs: { include: { actor: true }, orderBy: { createdAt: 'desc' } },
      comments: { include: { author: true, attachments: true }, orderBy: { createdAt: 'asc' } }
    }
  });

  if (!ticket) {
    return (
      <main className="container">
        <h1>Ticket Not Found</h1>
      </main>
    );
  }

  const deptString = session.user.department || "";
  const isCS = deptString.includes('CS') || deptString.toLowerCase().includes('customer');
  const canView = true; // All authenticated staff can view any ticket if they have the link or use 'Show All'

  // Pre-fetch departments and users for re-assignment
  const departments = await prisma.department.findMany();
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  const jobCategories = await prisma.jobCategory.findMany({ where: { active: true } });
  const customFields = await prisma.customField.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  const serviceTemplates = await prisma.serviceTemplate.findMany({ orderBy: { name: 'asc' } });
  const canModifyTicket = session.user.role === 'Admin' || session.user.role === 'Manager' || isCS || isAdministrasi;

  return (
    <main className="container">
      <header className="page-header">
        <h1>Ticket {ticket.trackingId}</h1>
        <p>View and update the status of this operational issue.</p>
      </header>
      
      <TicketDetailClient 
        ticket={ticket} 
        departments={departments} 
        users={users} 
        jobCategories={jobCategories}
        customFields={customFields}
        serviceTemplates={serviceTemplates}
        canModifyTicket={canModifyTicket}
        currentUser={session.user}
      />
    </main>
  );
}
