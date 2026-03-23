const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Renaming Role Technician to NOC General...');
  
  const techRole = await prisma.role.findFirst({ where: { name: 'Technician' } });
  if (techRole) {
    await prisma.role.update({
      where: { id: techRole.id },
      data: { name: 'NOC General' }
    });
    console.log('Role renamed successfully!');
  } else {
    // If it doesn't exist, maybe it was already renamed, or create it.
    const nocGenRole = await prisma.role.findFirst({ where: { name: 'NOC General' } });
    if (!nocGenRole) {
      await prisma.role.create({ data: { name: 'NOC General' } });
      console.log('Created NOC General role.');
    } else {
      console.log('NOC General role already exists.');
    }
  }

}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
