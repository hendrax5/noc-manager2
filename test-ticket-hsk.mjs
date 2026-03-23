import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const t = await prisma.ticket.findUnique({
    where: { trackingId: 'HSK-DIE4-C2S7' },
    include: { department: true, assignee: true, historyLogs: true }
  });
  console.log("Ticket found:", t ? `ID: ${t.id}, Dept: ${t.department.name} (${t.departmentId}), Assignee: ${t.assignee?.name || 'NULL'}, Created: ${t.createdAt}` : 'NO TICKET FOUND');
  if (t) {
     console.log("Logs:", t.historyLogs);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
