# Pekerjaan Layanan melalui CID

## Alur operator

1. Buka Assets & Services, cari customer atau CID, lalu buka circuit.
2. Klik **Buat Tiket**. Customer/CID otomatis terpilih pada form Pekerjaan Layanan.
3. Pilih Instalasi Baru, Upgrade, Downgrade, Perubahan Layanan, atau Terminasi.
4. Isi produk tujuan dari ServiceTemplate, kapasitas Mbps, tanggal efektif, serta field wajib produk tujuan. Terminasi hanya meminta alasan dan tanggal efektif.
5. Periksa Job Category yang disarankan; operator berizin tetap bisa memilih kategori lain. Isi deskripsi dan penanganan seperti form lama.
6. Simpan tiket baru. Inventory belum berubah. Setelah pekerjaan benar-benar selesai, Resolve dari aplikasi untuk menerapkan perubahan otomatis.

Satu tiket perubahan menangani satu CID. Trouble tetap bisa memilih beberapa layanan. Setiap pekerjaan baru memiliki nomor tiket dari generator yang sama; tidak membuka kembali tiket instalasi untuk pekerjaan berbeda.

Untuk circuit baru, tautan pendaftaran pada form membuka `/assets/new?ticketSetup=1` melalui hak akses Inventory yang sudah ada. Daftarkan CID yang telah diketahui; layanan dibuat Pending, lalu lanjut ke form tiket Instalasi Baru dengan CID terpilih. Tidak membuat customer/circuit otomatis bagi user tanpa izin `manage_assets`. Jika customer belum terdaftar, gunakan registrasi customer pada Assets & Services terlebih dahulu.

Kapasitas historis hanya dikenali bila satuannya jelas: canonical `customData.bandwidthMbps`, atau alias `Bandwidth Mbps`, `Bandwidth (Mbps)`, `bandwidth_mbps`. Field tanpa satuan tidak ditebak. Pengelola Inventory dapat mengisi **Kapasitas layanan (Mbps)** pada Edit Details sebelum membuat Upgrade/Downgrade. Canonical capacity menjadi sumber utama dan alias eksplisit yang sudah ada diselaraskan ketika perubahan diterapkan.

## Master dan scoring

Menu **Administration → Jenis Pekerjaan Layanan** (`/settings/service-work-types`). Admin atau role dengan `manage_service_work` dapat menambah, mengganti nama, mengatur urutan, menonaktifkan/mengaktifkan, dan memetakan saran Job Category. Operasi jenis pekerjaan tidak dapat diganti setelah dibuat. Tidak ada hapus master. Nonaktif berarti tidak tersedia untuk pekerjaan baru; tiket existing mempertahankan snapshot nama dan dapat diselesaikan.

Produk/Layanan tetap memakai katalog ServiceTemplate yang ada. METRO-E, IPT, COMIX, HSPIX, IPLC adalah contoh produk yang dikelola melalui katalog tersebut; tidak dibuat sebagai katalog kedua atau di-seed tanpa memeriksa data yang sudah ada.

Jenis pekerjaan adalah klasifikasi operasional. Job Category tetap sumber nilai poin; poin reply tetap menggunakan aturan existing. Resolve pekerjaan layanan mempertahankan penerima poin existing (penulis reply terakhir, fallback assignee), dan mencegah pemberian poin kategori yang sama untuk tiket tersebut setelah reopen. Reply baru tetap mengikuti aturan poin reply. Aturan reopen tiket legacy tidak diubah.

## Penerapan Inventory

- Kondisi sebelum/sesudah dibuat server, tidak diterima dari browser. CID tidak dapat diganti melalui payload pekerjaan layanan.
- Upgrade menaikkan kapasitas, Downgrade menurunkannya. Perubahan Layanan dapat mengganti produk dan field produk yang secara eksplisit diisi, sambil mempertahankan data lama pada histori.
- Tanggal efektif adalah tanggal pelaksanaan aktual. Tanggal masa depan boleh dicatat, tetapi tidak dapat di-Resolve sebelum waktunya (WIB).
- Resolve mengunci tiket dan circuit, memeriksa kondisi Inventory terhadap snapshot, memperbarui Inventory, status tiket, dan audit/poin dalam transaksi yang sama.
- Perubahan Inventory oleh tiket/operator lain menyebabkan HTTP 409; buka Edit, tinjau kondisi terbaru dan simpan ulang permintaan sebelum Resolve.
- Resolve berulang tidak menerapkan perubahan atau poin kategori kembali. Reopen tidak mengembalikan Inventory otomatis. Setelah diterapkan, payload perubahan serta relasi CID tidak dapat diganti.
- Terminasi mengubah status menjadi Terminated tanpa menghapus layanan atau tiket. Membatalkan hasil pekerjaan memerlukan pekerjaan koreksi tersendiri; tidak ada rollback layanan diam-diam.
- Integrasi API existing tidak boleh Resolve/Close ServiceWork melalui jalur lama; HTTP 409 meminta penyelesaian melalui aplikasi agar transaksi Inventory tidak dilewati. Integrasi legacy lainnya tetap berjalan.
- ServiceWork serta Installation legacy dikecualikan dari laporan downtime/SLA gangguan; Trouble dan tiket historis tetap mengikuti aturan durasi per tiket.

## Upgrade database dan rollout

Belum diterapkan ke produksi oleh pekerjaan implementasi ini. Siapkan backup lalu jalankan SQL tambahan sebelum aplikasi baru:

```sh
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d nocticketing -v ON_ERROR_STOP=1 \
  < prisma/changes/20261022_service_work.sql
```

SQL transaksional dan idempoten; menambahkan tabel master serta tiga kolom Ticket dan lima jenis pekerjaan awal. Tidak mengklasifikasikan ulang data lama. Generate Prisma Client dan build aplikasi sesudahnya. Jangan menjalankan seed-permissions: registrasi permission hanya menambah pilihan yang dapat diberikan melalui Team Access Manager; seed lama dapat mengganti role yang sudah ada.

## Verifikasi

```sh
node --test lib/services/cidLookup.test.mjs lib/tickets/workClassification.test.mjs lib/tickets/troubleMasters.test.mjs lib/tickets/serviceWork.test.mjs lib/tickets/serviceWorkView.test.mjs lib/reports/dashboard.test.mjs lib/reports/outageReport.test.mjs
node scripts/test_service_work_api.cjs
node scripts/test_service_work_ui.cjs
node scripts/test_service_work_detail_ui.cjs
node scripts/test_service_work_master_ui.cjs
node scripts/test_ticket_classification_api.cjs
node scripts/test_ticket_classification_ui.cjs
node scripts/test_outage_report_api.cjs
node scripts/test_outage_report_ui.cjs
npm run lint
npx prisma validate
npx prisma generate
npm run build
```

API/browser fixtures memakai data simulasi dan tidak menulis database produksi. Transaksi dan konkurensi diuji dengan transactional fixtures; validasi PostgreSQL nyata saat rollout tetap diperlukan. Build Windows lokal diketahui terhalang BOM pada `C:/Users/hendr/package.json` di luar repository serta junction `.next`/izin Windows. File di luar proyek tidak diubah; kegagalan lingkungan ini tidak boleh dilaporkan sebagai build lulus.
