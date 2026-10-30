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

Kapasitas historis hanya dikenali bila satuannya jelas: canonical `customData.bandwidthMbps`, atau alias `Bandwidth Mbps`, `Bandwidth (Mbps)`, `bandwidth_mbps`. Field tanpa satuan tidak ditebak. Pengelola Inventory dapat mengisi **Kapasitas layanan (Mbps)** pada Edit Details sebelum membuat Upgrade/Downgrade. Canonical capacity menjadi sumber utama dan alias eksplisit yang sudah ada diselaraskan ketika perubahan diterapkan. **Nilai 0 adalah kapasitas sah** (mis. layanan belum berkapasitas/terukur): tersimpan dan tampil sebagai 0 Gbps, serta Upgrade/BOD dapat dimulai dari 0 (arah Upgrade tetap harus menaikkan). Nilai negatif, teks, atau field tanpa satuan tetap dianggap belum diketahui.

## Kapasitas otomatis dari riwayat tiket

Operator biasanya sudah mencatat bandwidth asli di tiket: dump konfigurasi perangkat (`description INDOTEL-SITE-300M-SAP-C-...`, `qos lr ... cir`), nama client/perangkat, baris `Kapasitas Existing : 300 Mbps`, atau komentar EWO (`Upgrade ke 1G`). `lib/services/capacityHints.js` mengekstraknya agar tidak perlu dibaca manual.

- **Saran di form Pekerjaan Layanan.** Saat CID dipilih pada Upgrade/Downgrade/Perubahan/BOD, form memanggil `GET /api/assets/services/{id}/capacity-hints` (read-only). Jika Inventory belum punya kapasitas, form menampilkan kandidat beserta sumber dan tanggalnya, lalu tombol **Isi ke Inventory** (butuh izin `manage_assets`) menulis nilai pilihan dan mencatat audit `service.capacity_from_ticket`. Kapasitas tujuan juga terisi otomatis dari teks EWO terbaru dan tetap bisa diubah operator.
- **Adopsi otomatis di server.** `prepareServiceWork` mengisi kapasitas Inventory dari riwayat tiket ketika Upgrade/Downgrade/BOD dibuat dan nilainya belum ada. Hanya bukti yang tidak ambigu yang dipakai; jika bukti terbaru berbeda pada waktu yang sama, tiket ditolak (HTTP 400) dengan daftar kandidat untuk ditinjau di Assets & Services.
- **Aturan bukti.** Konfigurasi perangkat pada baris yang memuat CID layanan (atau aliasnya, termasuk akhiran legacy seperti `C-0006-0060` untuk `SAP-C-0006-0060`) bernilai tinggi; tiket yang hanya menautkan satu layanan boleh tanpa CID di baris. Nama client yang memuat bandwidth di depan CID bernilai sedang. CIR `rate-limit`/`qos lr` hanya pendukung perkiraan, bukan sumber adopsi. Bukti **terbaru** menang atas dump lama (riwayat upgrade). Bukti diturunkan bila baris berisi CID lain (circuit berbeda), bila CIR di blok yang sama bertentangan (mis. `-500G-` dengan `cir 512000`), kecuali interface `SOFTBLOCK`/`TERMINATE`/`shutdown` yang memang di-throttle.
- **Backfill massal.** `scripts/backfill_capacity_hints.mjs --customer=<id> --dry-run|--apply` mengisi layanan yang buktinya kuat, melewati DARKFIBER (berbasis pair), dan menulis audit `capacity-backfill-<tanggal>-<serviceId>`. Sisanya dilaporkan sebagai CSV review (status, kandidat, tiket sumber) tanpa menulis apa pun.
- **Verifikasi.** `node --test lib/services/capacityHints.test.mjs lib/tickets/serviceWork.test.mjs`.

## Master dan scoring

Menu **Administration → Jenis Pekerjaan Layanan** (`/settings/service-work-types`). Admin atau role dengan `manage_service_work` dapat membuat, mengganti nama, mengatur urutan, menonaktifkan/mengaktifkan, memetakan saran Job Category, serta menghapus jenis pekerjaan yang belum dipakai tiket. Operasi jenis pekerjaan tidak dapat diganti setelah dibuat. Nonaktif berarti tidak tersedia untuk pekerjaan baru; tiket existing mempertahankan snapshot nama dan dapat diselesaikan.

Form tambah/edit tampil sebagai dialog di atas daftar dengan galat per field. Operasi dan Saran Job Category memakai combobox select-only (`components/MasterPicker.js`), bukan select native: tombol pemicu + listbox, navigasi panah/Home/End, Enter/Space memilih, Escape menutup daftar tanpa menutup dialog, dan typeahead berdasarkan awalan nama. Status aktif diubah langsung dari baris; hapus permanen ditolak (409) bila jenis pekerjaan sudah dipakai tiket, dan dialog hapus menampilkan jumlah tiket pemakai serta menawarkan nonaktifkan.

Produk/Layanan tetap memakai katalog ServiceTemplate yang ada. METRO-E, IPT, COMIX, HSPIX, IPLC adalah contoh produk yang dikelola melalui katalog tersebut; tidak dibuat sebagai katalog kedua atau di-seed tanpa memeriksa data yang sudah ada.

Jenis pekerjaan adalah klasifikasi operasional. Job Category tetap sumber nilai poin; poin reply tetap menggunakan aturan existing. Resolve pekerjaan layanan mempertahankan penerima poin existing (penulis reply terakhir, fallback assignee), dan mencegah pemberian poin kategori yang sama untuk tiket tersebut setelah reopen. Reply baru tetap mengikuti aturan poin reply. Aturan reopen tiket legacy tidak diubah.

## Penerapan Inventory

- Kondisi sebelum/sesudah dibuat server, tidak diterima dari browser. CID tidak dapat diganti melalui payload pekerjaan layanan.
- Upgrade menaikkan kapasitas, Downgrade menurunkannya. Perubahan Layanan dapat mengganti produk dan field produk yang secara eksplisit diisi, sambil mempertahankan data lama pada histori.
- Tanggal efektif (RFS) adalah **tanggal target**, bukan penghalang Resolve. Tanggal masa depan boleh dicatat; tiket tetap dapat di-Resolve sekarang dengan bukti penyelesaian. Keterlambatan terhadap RFS tetap dilaporkan lewat metrik RFS.
- Resolve mengunci tiket dan circuit, memeriksa kondisi Inventory terhadap snapshot, memperbarui Inventory, status tiket, dan audit/poin dalam transaksi yang sama.
- Resolve pekerjaan layanan (selain BOD) wajib menyertakan **konfirmasi pekerjaan telah dilaksanakan**, **tanggal selesai aktual** (tidak boleh di masa depan, WIB), dan **bukti penyelesaian** (link BA/EWO, foto, atau catatan; maksimal 4000 karakter). Bukti dan aktor disimpan pada snapshot `serviceChange.completion` dan riwayat tiket.
- Perubahan Inventory oleh tiket/operator lain menyebabkan HTTP 409; buka Edit, tinjau kondisi terbaru dan simpan ulang permintaan sebelum Resolve.
- Resolve berulang tidak menerapkan perubahan atau poin kategori kembali. Reopen tidak mengembalikan Inventory otomatis. Setelah diterapkan, payload perubahan serta relasi CID tidak dapat diganti.
- Terminasi mengubah status menjadi Terminated tanpa menghapus layanan atau tiket. Membatalkan hasil pekerjaan memerlukan pekerjaan koreksi tersendiri; tidak ada rollback layanan diam-diam.
- Integrasi API existing tidak boleh Resolve/Close ServiceWork melalui jalur lama; HTTP 409 meminta penyelesaian melalui aplikasi agar transaksi Inventory tidak dilewati. Integrasi legacy lainnya tetap berjalan.
- ServiceWork serta Installation legacy dikecualikan dari laporan downtime/SLA gangguan; Trouble dan tiket historis tetap mengikuti aturan durasi per tiket.

## RFS sebagai target dan aktivasi terjadwal

- Layanan hasil registrasi (Instalasi Baru dan CID baru pada pekerjaan Data Center) tetap dibuat `Pending` dan menyimpan `Service.plannedActiveAt` = RFS pukul 00:00 WIB. Tanggal RFS yang diubah pada tiket ikut memindahkan `plannedActiveAt` selama tiket belum Resolve.
- **Resolve tidak mengaktifkan layanan.** Aktivasi `Pending → Active` dilakukan sweep RFS: `POST /api/internal/rfs-activation/run` (header `x-cron-secret`, idempoten, audit `service.activated_at_rfs` dengan sumber `system`) yang dijalankan `scripts/schedule_cron.js` tiap jam. Sweep juga dijalankan sesaat setelah tiket registrasi dibuat/diubah atau di-Resolve, sehingga RFS yang sudah tiba langsung aktif tanpa menunggu tick.
- Sweep tidak pernah mengubah status tiket. Tiket yang RFS-nya lewat tetapi belum ditutup hanya tampil di panel **RFS terlewat, tiket belum ditutup** pada dashboard. Menghapus tiket sebelum Resolve mengosongkan `plannedActiveAt` layanan Pending agar tidak aktif sendiri; aktivasi manual tetap bisa dilakukan lewat Assets.
- Jika layanan Pending sudah diaktifkan sweep sebelum tiket di-Resolve, Resolve toleran terhadap perbedaan status itu (dibandingkan tanpa status/updatedAt) dan tidak menurunkan status kembali.
- Konfigurasi cron: `RFS_START_DELAY_MS` (default 120000), `RFS_INTERVAL_MS` (default 3600000). Monitoring jumlah yang jatuh tempo: `GET /api/internal/rfs-activation/run`.

## Upgrade database dan rollout

Belum diterapkan ke produksi oleh pekerjaan implementasi ini. Siapkan backup lalu jalankan SQL tambahan sebelum aplikasi baru:

```sh
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d nocticketing -v ON_ERROR_STOP=1 \
  < prisma/changes/20261022_service_work.sql
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d nocticketing -v ON_ERROR_STOP=1 \
  < prisma/changes/20261030_rfs_activation.sql
```

SQL transaksional dan idempoten; menambahkan tabel master serta tiga kolom Ticket dan lima jenis pekerjaan awal, lalu `Service.plannedActiveAt`/`Service.activatedAt` beserta indeks `(status, plannedActiveAt)` untuk sweep RFS. Tidak mengklasifikasikan ulang data lama dan tidak mengubah layanan Pending yang sudah ada (kolom baru nullable, jadi layanan tanpa rencana tidak pernah aktif sendiri). Generate Prisma Client dan build aplikasi sesudahnya. Jangan menjalankan seed-permissions: registrasi permission hanya menambah pilihan yang dapat diberikan melalui Team Access Manager; seed lama dapat mengganti role yang sudah ada.

## Verifikasi

```sh
node --test lib/services/cidLookup.test.mjs lib/tickets/workClassification.test.mjs lib/tickets/troubleMasters.test.mjs lib/tickets/serviceWork.test.mjs lib/tickets/serviceWorkView.test.mjs lib/tickets/installation.test.mjs lib/services/rfsActivation.test.mjs lib/reports/dashboard.test.mjs lib/reports/outageReport.test.mjs
node scripts/test_service_work_api.cjs
node scripts/test_datacenter_registration.cjs
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
