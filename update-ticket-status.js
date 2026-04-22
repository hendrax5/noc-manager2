const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Daftar status yang ada di UI (TicketAdvancedFilter)
  const validStatuses = ['New', 'Open', 'Reopened', 'Pending', 'Finish', 'Resolved', 'Closed'];

  console.log('Mencari tiket dengan status di luar daftar valid...');
  
  try {
    // Cari dulu tiket mana saja yang akan diubah untuk preview (opsional tapi bagus untuk log)
    const ticketsToUpdate = await prisma.ticket.findMany({
      where: {
        status: {
          notIn: validStatuses
        }
      },
      select: {
        trackingId: true,
        title: true,
        status: true
      }
    });

    if (ticketsToUpdate.length === 0) {
      console.log('Tidak ada tiket yang perlu diupdate. Semua status sudah valid.');
      return;
    }

    console.log(`Ditemukan ${ticketsToUpdate.length} tiket yang perlu diupdate:`);
    ticketsToUpdate.forEach(t => {
      console.log(`- [${t.trackingId}] ${t.title} (Status saat ini: ${t.status})`);
    });

    // Lakukan update massal
    console.log('\nMemproses update ke status "Reopened"...');
    const result = await prisma.ticket.updateMany({
      where: {
        status: {
          notIn: validStatuses
        }
      },
      data: {
        status: 'Reopened'
      }
    });

    console.log(`\nBERHASIL: ${result.count} tiket telah diubah statusnya menjadi 'Reopened'.`);
  } catch (error) {
    console.error('Terjadi kesalahan saat mengupdate tiket:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
