import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const depts = await prisma.department.findMany({ include: { users: { include: { role: true } } }});
  depts.forEach(d => {
    const nonAdmins = d.users.filter(u => u.role.name !== 'Admin');
    console.log(`Dept: ${d.name} (ID: ${d.id}) -> Total Users: ${d.users.length}, Non-Admins: ${nonAdmins.length}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
