const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgrespassword@10.16.124.242:5432/nocticketing?schema=public",
    },
  },
});

async function run() {
  console.log("Mencari tiket VLX-6JY-J948 di database server (10.16.124.242)...");
  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        trackingId: { contains: 'VLX-6JY-J948', mode: 'insensitive' }
      },
      include: {
        assignee: true,
        department: true
      }
    });

    if (ticket) {
      console.log("\n✅ Tiket Ditemukan!");
      console.log("=====================");
      console.log(`ID Database: ${ticket.id}`);
      console.log(`Tracking ID: ${ticket.trackingId}`);
      console.log(`Judul      : ${ticket.title}`);
      console.log(`Status     : ${ticket.status}`);
      console.log(`Visibilitas: ${ticket.visibility}`);
      console.log(`Assignee   : ${ticket.assignee ? ticket.assignee.name : '-'}`);
      console.log(`Departemen : ${ticket.department ? ticket.department.name : '-'}`);
      console.log(`Dibuat     : ${ticket.createdAt}`);
      console.log("\nDeskripsi:");
      console.log(ticket.description);
    } else {
      console.log("❌ Tiket VLX-6JY-J948 tidak ditemukan di dalam database server.");
    }
  } catch (err) {
    console.error("Gagal koneksi ke database:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
