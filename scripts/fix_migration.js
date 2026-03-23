const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing Database Data...');

  // 1. Setup Exact Departments
  const deptNames = ['NOC Regional Jakarta', 'NOC Regional Semarang', 'NOC Regional Bali'];
  const createdDepts = {};
  for (const name of deptNames) {
    let dept = await prisma.department.findFirst({ where: { name } });
    if (!dept) {
      dept = await prisma.department.create({ data: { name } });
    }
    createdDepts[name] = dept;
  }

  // Find NOC General (the old default I made)
  const nocGeneral = await prisma.department.findFirst({ where: { name: 'NOC General' } });

  // 2. Set all non-Admins to NOC Regional Jakarta
  // First, find the Admin role
  const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
  
  if (adminRole) {
    // Update all users who are NOT Admins
    const updateUsers = await prisma.user.updateMany({
      where: {
        roleId: { not: adminRole.id }
      },
      data: {
        departmentId: createdDepts['NOC Regional Jakarta'].id
      }
    });

    console.log(`Updated ${updateUsers.count} users to NOC Regional Jakarta.`);
  }

  console.log('Database fixes complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
