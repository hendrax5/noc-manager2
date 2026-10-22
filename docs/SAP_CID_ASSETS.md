# CID SAP pada Assets dan Trouble

## Penggunaan

- Buka Assets & Services → **CID SAP dari tiket** (Admin atau pengelola Inventory).
- Cari CID atau nama pada tiket. Setiap Subject SAP lengkap menjadi satu kandidat circuit; beberapa tiket dengan CID sama digabung pada baris yang sama.
- Klik **Lengkapi CID**. Pilih customer yang memiliki circuit dan produk/layanan; nama layanan terisi dari nama pada tiket sumber dan dapat diedit. Angka SAP tidak digunakan untuk mengelompokkan customer.
- Status awal Pending/perlu diperiksa; pilih status sebenarnya bila sudah diketahui. Produk dan status tidak ditebak dari kategori/status tiket lama.
- Simpan. Sistem membuat satu Asset dan menautkan tiket sumber. Bila CID sudah terdaftar, gunakan **Tautkan tiket** untuk memakai Asset existing tanpa membuat duplikat atau mengubah owner/produk.
- Dari hasilnya, pilih **Buat Trouble untuk CID ini** atau buka Asset → Buat Trouble/Buat Tiket. Tiket EWO/web baru dengan Subject CID SAP yang sama otomatis tertaut ketika Asset sudah tersedia.
- Customer yang belum ada didaftarkan melalui Customers Registry; produk memakai katalog Service Templates yang sudah ada. Tidak ada auto-create customer dari teks Name atau angka SAP.

Pada form Trouble, cari dan centang **CID layanan** terlebih dahulu. Gejala adalah kondisi gangguan (Down/Tidak terkoneksi, Putus-nyambung, High Latency, Packet Loss, Slow Throughput). Penyebab terpisah (FO CUT, listrik, konfigurasi, atau Belum diketahui). Jangan mengetik CID pada Cari gejala; filter tersebut memiliki tombol Hapus pencarian jika tidak ada pilihan cocok.

## Batasan dan integritas

Hanya token Subject lengkap seperti SAP-C-1243-0003 yang diterima setelah trim/kapitalisasi. Non-SAP dan Subject dengan keterangan tambahan tidak ditebak sebagai CID. CID berbeda tidak digabung berdasarkan urutan angka, kesamaan reporter atau kemiripan nama customer.

Preview/read API tidak menulis data. Mapping membutuhkan role terbaru dari database (Admin/manage_assets), menggunakan advisory lock per CID dan pemeriksaan ulang tiket sumber. Raw join M:N menjaga timestamp Ticket/Service, sehingga usia tiket, scoring dan snapshot pekerjaan layanan tidak berubah hanya karena linking. Audit link tidak memberikan poin. Konflik CID legacy/tautan existing tidak ditimpa; audit failure membatalkan Service baru serta tautannya. Belum ada import massal otomatis.

Tidak membutuhkan migrasi schema. Rollback aplikasi tidak menghapus Asset atau relasi yang sudah dibuat secara eksplisit; keduanya tetap kompatibel dengan versi sebelumnya. Backup database tetap diperlukan sebelum rollout/backfill operasional.

## Verifikasi

```sh
node --test lib/services/sapCid.test.mjs
node scripts/test_sap_assets_api.cjs
node scripts/test_sap_assets_ui.cjs
node scripts/test_ticket_classification_ui.cjs
npm run lint
```

Pengujian PostgreSQL pada database sementara membuktikan concurrency, rollback audit, dan raw join preserving timestamps dengan schema produksi tanpa data produksi. Tes API/browser lokal memakai fixture. Produksi tidak diisi massal oleh pengujian.
