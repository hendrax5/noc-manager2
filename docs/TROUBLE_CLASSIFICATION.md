# Trouble dan Instalasi dalam NOC Manager

Fitur ini memakai satu basis data tiket dan nomor EWO otomatis yang sama.

## Menu dan formulir

- Dashboard tetap global secara default, dengan filter klasifikasi opsional.
- Semua Tiket (`/tickets`) tetap menampilkan seluruh tiket yang diizinkan oleh hak akses pengguna.
- Trouble (`/tickets?workType=Trouble`) dan Instalasi (`/tickets?workType=Installation`) adalah tampilan tersaring dari data yang sama, bukan tiket duplikat.
- Form lama, kategori pekerjaan/poin, ITIL ticketType, routing, PIC, lampiran, dan custom fields dipertahankan.
- Form dapat dibuka dengan preset `/tickets/new?workType=Trouble` atau `Installation`.
- Trouble baru memerlukan gejala, penyebab, dan layanan yang memiliki CID. Penyebab Belum diketahui tersedia untuk investigasi awal.
- Instalasi menambahkan referensi SAP manual opsional. Kolom dan waktu downtime lama tidak dihapus ketika memilih Instalasi; tiket berklasifikasi Instalasi dikecualikan dari laporan downtime/SLA.
- Tiket lama otomatis berstatus klasifikasi Belum diklasifikasikan. Tidak ada inferensi dari judul, nama kategori, atau nomor SAP.

## Customer dan CID

Satu customer memiliki beberapa layanan/link. Setiap layanan memiliki CID sendiri.
Relasi Ticket–Service tetap menjadi sumber tautan. Satu tiket dapat menaut ke beberapa
CID, tetapi daftar tetap memiliki satu baris per tiket.

`Service.cid` adalah field utama, opsional untuk kompatibilitas. Nilai CID lama pada
customData (CID, SID, Circuit ID, id layanan, service id, termasuk variasi huruf besar)
tetap dikenali. Pencarian memakai ekstraksi yang sama dengan tampilan.

CID baru dinormalisasi ke huruf besar dan dicegah duplikat terhadap field utama maupun
data legacy. Tidak ada penggantian/backfill otomatis pada CID historis. Duplikat CID
yang sudah ada pada customData perlu diselesaikan operator inventory sebelum dipromosikan.

## Master data dan hak akses

Menu **Administration → Master Data Trouble** (`/settings/trouble-masters`).
Admin atau role dengan `manage_trouble_master` dapat membuat, mengganti nama/deskripsi,
mengatur urutan, mengaktifkan/menonaktifkan, serta menghapus pilihan yang belum dipakai tiket.

Form tambah/edit tampil sebagai dialog di atas daftar, bukan panel di bawah tabel: galat
validasi dan tombol Simpan berada pada pandangan yang sama dengan isian, dan daftar tetap
terlihat di belakangnya. Status aktif dikendalikan langsung dari baris daftar (switch), tanpa
membuka form. Setiap baris menampilkan jumlah tiket yang memakai master (`usageCount`) agar
konsekuensi edit atau hapus terlihat sebelum diklik. Di layar sempit tabel berubah menjadi
daftar kartu dengan label per nilai, bukan tabel yang dipaksa menyempit.

`DELETE /api/trouble-masters/:id` menolak dengan 409 bila master sudah dipakai tiket
(`onDelete: Restrict` pada `Ticket.symptomId`/`Ticket.causeId`). Respons memuat jumlah tiket
dan saran menonaktifkan agar riwayat tetap utuh; penghapusan permanen hanya untuk master yang
belum pernah dipakai. `GET /api/trouble-masters?includeInactive=true` menyertakan `usageCount`
dari relasi tiket. Nama duplikat ditolak per jenis master melalui normalisasi Unicode, spasi,
dan kapitalisasi. Jenis master tidak dapat dipindahkan dari Gejala ke Penyebab atau sebaliknya.
Snapshot label pada tiket lama tetap dipertahankan setelah rename/deaktivasi.

Permission dapat diberikan melalui Team Access Manager. Role tersebut tidak memerlukan
`manage_settings` untuk mengelola master. Operator terautentikasi membaca pilihan aktif
melalui API, sementara pilihan nonaktif hanya tersedia bagi pengelola.

## Upgrade database sebelum menjalankan versi baru

Perubahan berupa tabel dan kolom tambahan. Tidak ada penghapusan atau re-klasifikasi tiket.
Siapkan backup operasional seperti biasa, lalu terapkan skrip idempoten berikut terhadap
database NOC Manager sebelum mengganti aplikasi:

```sh
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d nocticketing -v ON_ERROR_STOP=1 \
  < prisma/changes/20261022_trouble_classification.sql
```

Skrip juga mengisi pilihan Gejala/Penyebab awal. Menjalankannya ulang tidak menimpa pilihan
master yang telah diedit atau dinonaktifkan. Jangan menjalankan seed-permissions hanya
untuk fitur ini karena seed lama mengganti seluruh daftar izin role.

Setelah SQL diterapkan, generate Prisma Client dan build/restart aplikasi. Pada instalasi
baru yang belum memiliki tabel Ticket/Service, jalankan pembuatan schema normal terlebih
dahulu lalu jalankan SQL yang sama untuk master awal.

Perubahan ini belum diterapkan pada database atau container produksi dalam tahap implementasi.

## Verifikasi

```sh
node --test lib/tickets/workClassification.test.mjs lib/tickets/troubleMasters.test.mjs lib/services/cidLookup.test.mjs lib/reports/dashboard.test.mjs lib/reports/outageReport.test.mjs
node scripts/test_ticket_classification_api.cjs
node scripts/test_trouble_master_ui.cjs
node scripts/_design-review/audit-master-ui.cjs
node scripts/test_outage_report_api.cjs
node scripts/test_ticket_classification_ui.cjs
node scripts/test_outage_report_ui.cjs
npm run lint
```

Browser/API fixture tests memakai data simulasi, bukan penulisan database live.
Full build lokal dapat tertahan oleh BOM pada `C:/Users/hendr/package.json` di luar proyek;
file tersebut tidak diubah oleh fitur ini. Validasi schema dan generate Prisma diuji terpisah.
