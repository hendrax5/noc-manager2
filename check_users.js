const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ include: { department: true } });
  console.log("USERS:", JSON.stringify(users, null, 2));
  const depts = await prisma.department.findMany();
  console.log("DEPARTMENTS:", JSON.stringify(depts, null, 2));
}
main().finally(() => prisma.$disconnect());
