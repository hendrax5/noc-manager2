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
  const userDeptId = session.user.departmentId ? parseInt(session.user.departmentId) : null;
  const isCS = deptString.includes('CS') || deptString.toLowerCase().includes('customer');
  const isAdministrasi = deptString.toLowerCase() === 'administrasi' || deptString.toLowerCase().includes('admin');
  const isSameDept = userDeptId && ticket.departmentId === userDeptId;
  const isAssignee = ticket.assigneeId === parseInt(session.user.id);
  const hasInteracted = ticket.historyLogs?.some(log => log.actorId === parseInt(session.user.id));
  // Bug 27: Enforce department-based access control
  const canView = session.user.role === 'Admin' || isCS || isSameDept || isAssignee || hasInteracted || ticket.visibility === 'Public';

  if (!canView) {
    return <main className="container"><h1>Access Denied</h1><p>You do not have permission to view this ticket.</p></main>;
  }

  // Pre-fetch departments and users for re-assignment
  const departments = await prisma.department.findMany();
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  const jobCategories = await prisma.jobCategory.findMany({ where: { active: true } });
  const customFields = await prisma.customField.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  const serviceTemplates = await prisma.serviceTemplate.findMany({ orderBy: { name: 'asc' } });
  // Bug 28: Administrasi/Manager can only modify tickets within their own department scope
  const canModifyTicket = session.user.role === 'Admin' || isCS || (session.user.role === 'Manager' && isSameDept) || (isAdministrasi && isSameDept);

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
