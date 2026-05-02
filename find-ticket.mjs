import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const query = process.argv[2];

async function main() {
  if (!query) {
    console.log("Gunakan: node find-ticket.mjs <kata_kunci>");
    console.log("Contoh: node find-ticket.mjs 1234");
    process.exit(1);
  }

  console.log(`Mencari tiket dengan kata kunci: "${query}"...\n`);

  const tickets = await prisma.ticket.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { trackingId: { contains: query, mode: 'insensitive' } },
        // Jika query berupa angka, cari berdasarkan ID juga
        ...(isNaN(parseInt(query)) ? [] : [{ id: parseInt(query) }])
      ]
    },
    include: {
      assignee: { select: { name: true } },
      department: { select: { name: true } }
    }
  });

  if (tickets.length === 0) {
    console.log("❌ Tidak ada tiket yang ditemukan.");
  } else {
    console.log(`✅ Ditemukan ${tickets.length} tiket:\n`);
    tickets.forEach(t => {
      console.log(`ID: ${t.id} | Tracking ID: ${t.trackingId}`);
      console.log(`Judul: ${t.title}`);
      console.log(`Status: ${t.status} | Visibilitas: ${t.visibility}`);
      console.log(`Departemen: ${t.department?.name || '-'} | Assignee: ${t.assignee?.name || '-'}`);
      console.log(`Dibuat: ${t.createdAt}`);
      console.log("--------------------------------------------------");
    });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
