const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const filters = [];
  filters.push({ customData: { path: ['company'], string_contains: 'ION' } });
  
  try {
    const t = await prisma.ticket.findMany({ where: { AND: filters }, select: { id: true } });
    console.log("Count with path:", t.length);
  } catch(e) { console.log("Error path:", e.message); }

  const filters2 = [];
  filters2.push({ customData: { string_contains: 'ION' } });
  try {
    const t2 = await prisma.ticket.findMany({ where: { AND: filters2 }, select: { id: true } });
    console.log("Count without path:", t2.length);
  } catch(e) { console.log("Error without path:", e.message); }
}
run();
