# UI consistency release (7ae7fb8)

Tanggal: 2026-10-24 (Asia/Jakarta)
Host: `ewo` (10.16.124.242), user deploy `nochspnet`, akses lewat jump server.
Aplikasi: Docker Compose project `noc-manager2` di `/home/nochspnet/noc-manager2`.

## Isi rilis

Commit `7ae7fb880931bfeef591cca5cbdaaa324397651e`:

- Master Data Trouble dan Jenis Pekerjaan Layanan: dialog tambah/edit, aksi baris Edit/Hapus, switch status, jumlah tiket pemakai, empty state terpisah, daftar kartu di layar sempit.
- `MasterPicker` (combobox select-only) untuk form master dan form tiket (jenis pekerjaan, Department, PIC).
- Konsistensi tombol/label/tabel di Pengaturan, Laporan, Tiket, dan Dashboard.
- Endpoint `DELETE` bertingkat untuk trouble-masters dan service-work-types dengan penjagaan pemakaian tiket dan `usageCount` pada `GET`.
- Perbaikan harness tes form tiket (stub `node:crypto`, CSS outdir) dan penulisan ulang dua tes UI yang stale.

Tidak ada perubahan schema Prisma atau migrasi data.

## Artefak

- Image dasar: `noc-manager2-app:release-v3-theme-6ea74c6`
- Image rilis: `noc-manager2-app:release-7ae7fb8`
  - label `org.opencontainers.image.revision=7ae7fb880931bfeef591cca5cbdaaa324397651e`
  - dibangun dari image dasar + `app/`, `components/`, `lib/` commit baru, lalu `npm run build`
- Direktori rilis: `/opt/noc-manager2/releases/ui-consistency-7ae7fb8`
  - `Dockerfile`, `release.yml`, `rollback.yml`, `rollback.sh`, `build.log`, `RELEASE.txt`
- Backup database sebelum deploy: `/opt/noc-manager2/backups/pre-7ae7fb8-20261024T165957Z.dump` (20.5 MB, format custom)

## Deploy

```sh
cd /home/nochspnet/noc-manager2
git merge --ff-only origin/main            # 6ea74c6 -> 7ae7fb8
docker build -f /opt/noc-manager2/releases/ui-consistency-7ae7fb8/Dockerfile \
  -t noc-manager2-app:release-7ae7fb8 .
docker compose -p noc-manager2 -f docker-compose.prod.yml \
  -f /opt/noc-manager2/releases/ui-consistency-7ae7fb8/release.yml \
  up -d --no-deps --no-build app
```

## Verifikasi

- Container `noc-manager2-app-1` berjalan dengan image `release-7ae7fb8`, `RestartCount=0`.
- Log start: `✓ Ready in 261ms`, cron `schedule_cron.js` aktif, tidak ada error Prisma/Next.
- `http://127.0.0.1:3000/login` → 200; `/dashboard`, `/settings/trouble-masters`, `/settings/service-work-types`, `/tickets` → 307 (redirect login); `/api/trouble-masters` dan `/api/service-work-types` → 401.
- `http://noc.servicex.id/login` → 307 ke HTTPS.
- Image berisi `components/MasterPicker.js`, `components/master-picker.module.css`, dan referensi picker di `TicketWorkClassification.js`.

## Catatan terbuka

`https://noc.servicex.id` mengembalikan **521** dari reverse proxy publik `103.162.16.165`, sementara host aplikasi tidak membuka listener 443 (hanya 3000 via docker-proxy). Aplikasi sendiri sehat di dalam host. Ini lapisan proxy/TLS di luar host aplikasi dan tidak diubah oleh rilis ini; perlu diperiksa dengan akses ke proxy tersebut bila HTTPS masih gagal.

## Rollback

```sh
sudo /opt/noc-manager2/releases/ui-consistency-7ae7fb8/rollback.sh
```

Rollback hanya mengganti image kembali ke `release-v3-theme-6ea74c6`; tidak menyentuh database. Backup database tersedia bila diperlukan pemulihan terpisah.
