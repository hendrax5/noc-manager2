const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const t = await prisma.ticket.findMany({
    where: {
      AND: [
        { customData: { string_contains: 'ION' } },
        { OR: [ { visibility: "Public" } ] }
      ]
    }, select: { id: true }
  });
  console.log("Count:", t.length);
}
run();
