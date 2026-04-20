const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.ticket.findMany({
      where: {
        OR: [
          { trackingId: { contains: 'test', mode: 'insensitive' } },
          { customData: { path: ['company'], string_contains: 'test' } }
        ]
      }
    });
    console.log('SUCCESS', res.length);
  } catch(e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
