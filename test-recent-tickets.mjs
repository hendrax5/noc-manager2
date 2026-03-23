import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const tickets = await prisma.ticket.findMany({ orderBy: { id: 'desc' }, take: 5, include: { assignee: true, department: true }});
  console.log("Recent Tickets:");
  tickets.forEach(t => console.log(`ID: ${t.id}, Dept: ${t.department.name}, Assignee: ${t.assignee?.name || 'NULL'}, JobCat: ${t.jobCategoryId}`));
}

check().catch(console.error).finally(() => prisma.$disconnect());
