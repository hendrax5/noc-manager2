# RFS menjadi target, aktivasi terjadwal, dan bukti penyelesaian

Pengganti gerbang RFS pada Resolve. Dua keputusan yang diminta: **aktivasi CID dipisahkan dari Resolve** dan **Resolve memakai gerbang bukti**. Status tiket tidak pernah berubah tanpa manusia.

## Masalah

- RFS adalah tanggal yang diketik di form, tetapi dipakai sebagai penghalang Resolve. Tanggal lampau membuat pekerjaan tidak bisa ditutup; tanggal mundur membuat siapa pun bisa Resolve tanpa verifikasi.
- Layanan hasil registrasi dibuat `Pending` dan hanya aktif saat Resolve, sehingga CID bisa menggantung `Pending` bila tidak ada yang menutup tiket.
- Tidak ada bukti bahwa pekerjaan benar-benar selesai; Resolve hanya konfirmasi visual.

## Perubahan

- **RFS = tanggal target.** Guard `RFS <tanggal> belum tiba` dihapus dari `applyServiceWork` (pekerjaan layanan maupun Data Center). RFS tetap dipakai metrik ketepatan (`onRfs`), bukan penghalang.
- **Aktivasi terjadwal.** Registrasi Instalasi Baru / CID baru Data Center menyimpan `Service.plannedActiveAt` (RFS 00:00 WIB). Sweep `lib/services/rfsActivation.js` mengubah `Pending → Active` secara idempoten ketika waktunya tiba, menulis `activatedAt` dan audit `service.activated_at_rfs` (`source: system`). Sweep dipanggil dari cron baru `POST /api/internal/rfs-activation/run` (`x-cron-secret`) yang dijalankan `scripts/schedule_cron.js` tiap jam, dan secara oportunistik setelah tiket registrasi dibuat, diubah RFS-nya, atau di-Resolve.
- **Resolve tidak mengubah status registrasi.** Snapshot `after.status` tetap status saat ini; Resolve hanya mencatat completion. Bila sweep sudah mengaktifkan sebelum Resolve, perbandingan snapshot mengabaikan status/updatedAt agar tidak menjadi konflik palsu dan tidak menurunkan status.
- **Gerbang bukti.** Resolve ServiceWork (selain BOD) wajib mengirim `completion: {confirmed: true, finishedAt, evidence}`. Server memvalidasi: konfirmasi eksplisit, tanggal `YYYY-MM-DD` tidak di masa depan (WIB), bukti 1–4000 karakter. Snapshot menyimpan `completion.confirmedAt`/`confirmedBy` dan riwayat tiket mencatat tanggal + cuplikan bukti. Dialog Resolve di detail tiket mengambil tanggal selesai, bukti (link BA/EWO/foto/catatan), dan centang konfirmasi. Resolve berulang atau reopen tidak meminta bukti lagi.
- **Perubahan RFS pada tiket** menyinkronkan `plannedActiveAt` selama tiket belum Resolve (`syncPlannedActivation`). Menghapus tiket sebelum Resolve mengosongkan `plannedActiveAt` agar layanan Pending tidak aktif sendiri; status Pending dibiarkan untuk tindakan manual di Assets.
- **Panel "RFS terlewat, tiket belum ditutup"** di dashboard (komponen `RfsOverduePanel`) melaporkan tiket ServiceWork yang RFS-nya lewat tetapi belum di-Resolve, urut keterlambatan. Panel hanya membaca; tidak ada status otomatis. BOD dikecualikan karena memakai Reminder BOD sendiri.
- **Kop form/summary** menjelaskan RFS sebagai target aktivasi, bukan penghalang, dan bahwa layanan Pending diaktifkan otomatis saat RFS tiba.

## Upgrade database

```sh
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d nocticketing -v ON_ERROR_STOP=1 \
  < prisma/changes/20261030_rfs_activation.sql
```

Menambah `Service.plannedActiveAt`, `Service.activatedAt`, dan indeks `(status, plannedActiveAt)`. Additif/nullable: layanan Pending lama tanpa rencana tidak akan aktif sendiri dan tetap dapat diaktifkan manual lewat Assets. Status tiket lama tidak berubah; tiket lama yang di-Resolve tetap memakai jalur lamanya bila snapshot masih menyimpan `after.status = Active`.

## Verifikasi

- `node --test lib/tickets/serviceWork.test.mjs lib/tickets/serviceWorkView.test.mjs lib/tickets/installation.test.mjs lib/services/rfsActivation.test.mjs`
- `node scripts/test_service_work_api.cjs` — Resolve tanpa completion ditolak 400, completion tersimpan, rollback atomik, Resolve berulang/reopen, konflik Inventory.
- `node scripts/test_datacenter_registration.cjs` — registrasi Pending + `plannedActiveAt`, Resolve tidak mengaktifkan, sweep mengaktifkan sekali dengan audit, RFS masa depan tidak menghalangi Resolve, guard completion, hapus rencana mengosongkan aktivasi.
- `node scripts/test_service_work_detail_ui.cjs` — dialog bukti di browser: payload hanya `completion`, konflik mengembalikan status, edit tiket applied tidak mengirim snapshot.
- `node scripts/test_service_capacity_http.cjs`, `node scripts/test_ticket_forms_bod_http.cjs` — QA terisolasi: aktivasi RFS saat registrasi (RFS hari ini), Resolve wajib bukti, BOD tetap memakai konfirmasi pengembalian.

## Deploy produksi (2026-10-31)

- Revisi: `b10b56e` (tag `v3.21.0`), image `noc-manager2-app:release-3.21.0` dibangun dari image dasar `release-3.20.4`.
- Backup DB sebelum migrasi: `/opt/noc-manager2/backups/pre-3.21.0-20261030T234711Z.dump` (21 MB).
- Migrasi `prisma/changes/20261030_rfs_activation.sql` dijalankan (`ALTER TABLE` ×2 + `CREATE INDEX`); kolom `plannedActiveAt`/`activatedAt` terverifikasi lewat `information_schema`.
- Health check: `/login` HTTP 200, `app_version 3.21.0`, container berjalan dengan `node scripts/schedule_cron.js & npm start`, log cron `[schedule-cron] started` terlihat.
- Tanpa aktivasi retroaktif: 837 layanan Pending tetap Pending, `plannedActiveAt` dan `activatedAt` masih kosong. Endpoint sweep dengan secret mengembalikan `{"due":0}`; tanpa secret HTTP 403.
- Rollback: `/opt/noc-manager2/releases/rfs-target-3.21.0/rollback.sh` mengembalikan image `release-3.20.4`; recipe `release.yml`/`rollback.yml` tersimpan di folder rilis.
- Catatan kapasitas: disk host 92% terpakai (sisa ±4 GB) setelah image baru; pertimbangkan prune image lama setelah periode stabil.

