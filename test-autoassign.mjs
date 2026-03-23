import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ include: { role: true } });
  console.log("Users:", users.map(u => ({ id: u.id, name: u.name, dept: u.departmentId, role: u.role.name })));
}

check().catch(console.error).finally(() => prisma.$disconnect());
