const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tickets = await prisma.ticket.findMany({ 
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { assignee: true, department: true }
  });
  console.log("RECENT TICKETS:", JSON.stringify(tickets, null, 2));
}
main().finally(() => prisma.$disconnect());
