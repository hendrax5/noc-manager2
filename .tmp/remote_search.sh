sshpass -p 'Hspnet2026' ssh -o StrictHostKeyChecking=no nochspnet@10.16.124.242 << 'EOF'
echo "Terhubung. Mencari noc-manager2..."
DIR=$(find / -name "noc-manager2" -type d 2>/dev/null | head -n 1)
if [ -n "$DIR" ]; then
    echo "Ditemukan di: $DIR"
    cd "$DIR"
    # Coba cari dengan npx prisma
    if [ -f "prisma/schema.prisma" ]; then
        echo "Menjalankan script query prisma..."
        cat << 'INCSCRIPT' > search_tmp.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const t = await prisma.ticket.findFirst({ where: { trackingId: { contains: 'VLX-6JY-J948' } } });
  if (t) {
     console.log("Tiket Ditemukan:", t);
  } else {
     console.log("Tiket tidak ditemukan di database dengan tracking ID tersebut.");
  }
}
run().finally(() => prisma.$disconnect());
INCSCRIPT
        node search_tmp.js
        rm search_tmp.js
    fi
else
    echo "Folder noc-manager2 tidak ditemukan."
fi
EOF
