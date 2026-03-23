import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function update() {
  // Find or create "Staff" role
  let staffRole = await prisma.role.findUnique({ where: { name: 'Staff' } });
  if (!staffRole) {
     staffRole = await prisma.role.create({ data: { name: 'Staff' } });
     console.log('Created Staff role');
  }

  // Find or create "NOC General" department
  let nocGenDept = await prisma.department.findUnique({ where: { name: 'NOC General' } });
  if (!nocGenDept) {
     nocGenDept = await prisma.department.create({ data: { name: 'NOC General' } });
     console.log('Created NOC General department');
  }

  // Find Admin Role ID to exclude
  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  const adminRoleId = adminRole ? adminRole.id : -1;

  // Bulk update
  const result = await prisma.user.updateMany({
    where: {
      roleId: { not: adminRoleId }
    },
    data: {
      roleId: staffRole.id,
      departmentId: nocGenDept.id
    }
  });

  console.log(`Successfully updated ${result.count} users.`);
  console.log(`Role: Staff (ID: ${staffRole.id})`);
  console.log(`Department: NOC General (ID: ${nocGenDept.id})`);
}

update().catch(console.error).finally(() => prisma.$disconnect());
