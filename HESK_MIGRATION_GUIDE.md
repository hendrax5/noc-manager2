# Panduan Migrasi Database Hesk ke PostgreSQL (Next.js NOC Sistem)

Dokumen ini berisi langkah-langkah **pasti** (*foolproof*) untuk melakukan *import* ulang data tiket dan pengguna terbaru dari sistem Hesk lama Anda menuju ke Sistem NOC baru (PostgreSQL) tanpa kehilangan relasi, riwayat, maupun *error* struktural.

---

## Prasyarat
1. Anda memegang *file* `.sql` *dump* terbaru dari sistem Hesk lama Anda (cth: `dataewo.sql`). Patikan *file* tersebut diletakkan di dalam *folder* proyek sistem NOC ini (`/home/hendra/Documents/ag/dataewo.sql`).
2. Server Anda sudah terinstal `docker` dan hak akses `sudo`.

---

## Langkah-Langkah Eksekusi

### 1. Menyiapkan Database Penampung Sementara (MariaDB)
Sistem Hesk menggunakan MySQL/MariaDB yang format *dump*-nya tidak bisa langsung dibaca oleh PostgreSQL. Kita perlu "menghidupkan" *dump* tersebut ke dalam *container* MariaDB sesaat.

Jalankan perintah ini di Terminal proyek Anda:
```bash
sudo docker run --name tmp-mariadb -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=hesk -p 3307:3306 -d mariadb:10.11
```
*(Tunggu sekitar 15 - 20 detik sampai Docker benar-benar menyala).*

### 2. Menyuntikkan Data Hesk ke Penampung
Setelah penampung siap, kita tuangkan *file* *dump* mentah ke dalamnya:
```bash
sudo docker exec -i tmp-mariadb mariadb -u root -proot hesk < dataewo.sql
```
*(Proses ini pasif dan memakan waktu sekitar 1-2 menit tergantung besaran file .sql Anda. Tunggu sampai terminal kembali kosong/siap).*

### 3. Menjalankan Skrip Ekstraktor Cerdas (*ETL Bridge*)
Ini adalah skrip otomatis (Node.js + Prisma) yang secara spesifik telah dirancang untuk:
- Mengubah kategori Hesk menjadi **JobCategory** modern.
- Membaca semua Pengguna Hesk (*Users*) lalu menempatkan mereka rata ke dalam kelompok  **NOC Regional Jakarta** dengan kewenangan bawaan **NOC General**.
- Mengubah Format *Status Tiket* angka (0, 1, 3) menjadi format teks ("New", "Waiting Reply", "Resolved").
- Menyusun rentetan puluhan ribu Komentar/Balasan (`hesk6v_replies`) berangkai tepat di bawah tiket historis asalnya (`hesk6v_tickets`).

Jalankan:
```bash
node scripts/import_hesk.js
```
*Anda akan melihat indikator baris di terminal melaporkan "... Processed X tickets..." hingga selesai dengan bunyi **🎉 Migration Completed Successfully!**.*

### 4. Membersihkan Sisa Migrasi
Agar server Anda tidak membengkak karena *database* sementara tadi, hancurkan kontainernya:
```bash
sudo docker rm -f tmp-mariadb
```

---

## Catatan Penting Pasca Migrasi
- **Kata Sandi Pengguna Bawaan:** Semua teknisi/user lama yang di-*import* via skrip ini disetel ulang untuk menggunakan kata sandi bawaan `password123`. Hal ini dikarenakan format *hashing password* Hesk sangat usang sehingga tidak cocok dengan standar enkripsi `bcrypt` milik sistem modern kita. 
- **Format HTML Rendering:** Jangan menyaring atau membuang kolom `t.message` pada skrip meskipun itu nampak kotor oleh `<a>` atau `<br />`. Sistem NOC kita dirancang cerdas untuk menangkap dan me-*render* blok HTML masa lalu di dalam halaman *Ticket Detail* (menggunakan `dangerouslySetInnerHTML`).

> **Peringatan Timpaan (Upsert):** Skrip `import_hesk.js` menggunakan instrumen Prisma `upsert` pada ID Pelacakan Hesk. Artinya, menjalankan ulang skrip ini kelak dengan *dump file* yang lebih maju **hanya akan memperbarui (update)** tiket-tiket masa lalu atau **menyuntik (insert)** yang terbaru, fitur ini secara ajaib MENCEGAH terjadinya data tiket ganda (Duplikasi)!
