# Arsip lampiran tiket ke Google Drive

Fitur ini mengunggah lampiran tiket (lampiran tiket dan lampiran balasan) ke Google
Drive secara otomatis, lalu menyimpan link Drive pada baris `Attachment`. Pada halaman
tiket, di samping nama file muncul link kecil **Drive**.

## Perilaku

- Lampiran baru dibuat dengan `driveStatus = pending`. Setelah response dikirim, job
  latar belakang langsung mengunggahnya. Sweep cron mengulang yang gagal setiap
  `DRIVE_SYNC_INTERVAL_MS` (default 5 menit).
- Maksimal 3 percobaan (`status: failed` setelah itu; error terakhir disimpan di
  `driveError`).
- Satu folder per tiket, dinamai `trackingId` (contoh `HSK-N44G-8OLE`), di bawah folder
  induk `GDRIVE_FOLDER_ID`. Nama file diberi prefix tracking id.
- Baris lama (sebelum fitur ini) ditandai `skipped` oleh migrasi: tidak ada backfill
  otomatis 1,4 GB. Backfill dijalankan manual (lihat bawah).
- Jika env Drive belum diisi, fitur dorman: tidak ada unggahan, UI tidak berubah, dan
  lampiran baru tetap `pending` sampai diaktifkan.

## Konfigurasi

Variabel env di `/home/nochspnet/noc-manager2/.env` (dibaca `docker-compose.prod.yml`):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `GDRIVE_FOLDER_ID` | ya | ID folder tujuan (atau folder di dalam Shared Drive) |
| `GDRIVE_MODE` | tidak | `service_account` (default) atau `oauth` |
| `GDRIVE_SERVICE_ACCOUNT_B64` | mode SA | Isi file JSON service account, di-base64 |
| `GDRIVE_IMPERSONATE` | tidak | Email Workspace untuk domain-wide delegation |
| `GDRIVE_SHARED_DRIVE_ID` | tidak | ID Shared Drive (jika folder berada di Shared Drive) |
| `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN` | mode OAuth | Kredensial OAuth user |
| `DRIVE_SYNC_INTERVAL_MS` | tidak | Interval sweep, minimal 60000 |

### Pilihan akun

1. **Service account + Shared Drive (disarankan untuk Workspace).** Service account
   tidak punya kuota penyimpanan My Drive sendiri; unggahan ke folder My Drive biasa
   akan gagal `storageQuotaExceeded`. Buat Shared Drive, tambahkan email service
   account sebagai *Content manager*, lalu isi `GDRIVE_FOLDER_ID` dengan ID folder di
   Shared Drive tersebut.
2. **Service account + domain-wide delegation.** Aktifkan delegation di Admin Console,
   isi `GDRIVE_IMPERSONATE` dengan user Workspace; file menjadi milik user tersebut.
3. **OAuth refresh token.** Untuk Drive pribadi/Gmail. Buat OAuth client, consent
   sekali dengan scope `https://www.googleapis.com/auth/drive`, lalu simpan refresh
   token ke `GDRIVE_REFRESH_TOKEN`.

Service account butuh akses ke Drive API (aktifkan di project Google Cloud) dan folder
harus di-share ke `client_email` service account.

## Migrasi database

Tambahan kolom saja (tanpa perubahan data lain). Jalankan **sebelum** mengganti image:

```sh
cd /home/nochspnet/noc-manager2
docker compose -p noc-manager2 -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d nocticketing -v ON_ERROR_STOP=1 < prisma/changes/20261027_drive_attachments.sql
```

## Aktivasi & verifikasi

```sh
# 1. isi env, lalu buat ulang container agar env terbaca
docker compose -p noc-manager2 -f docker-compose.prod.yml -f <release.yml> up -d --no-deps --no-build app

# 2. cek konfigurasi + hitungan status
docker exec noc-manager2-app-1 sh -c \
  'curl -s -H "x-cron-secret: $SCHEDULE_CRON_SECRET" http://127.0.0.1:3000/api/internal/drive-sync/run'

# 3. uji satu lampiran (contoh lampiran laporan Rajasa di tiket 45976)
docker exec noc-manager2-app-1 sh -c \
  'curl -s -X POST -H "x-cron-secret: $SCHEDULE_CRON_SECRET" -H "Content-Type: application/json" \
   -d "{\"id\":2644}" http://127.0.0.1:3000/api/internal/drive-sync/backfill'
```

Setelah sukses, buka tiket 45976: di samping `Laporan Aktivasi IPT RAJASA.pdf` muncul
link **Drive**.

## Backfill lampiran lama

```sh
# proses 25 lampiran lama per panggilan (status skipped), ulangi sampai habis
docker exec noc-manager2-app-1 sh -c \
  'curl -s -X POST -H "x-cron-secret: $SCHEDULE_CRON_SECRET" -H "Content-Type: application/json" \
   -d "{\"limit\":25}" http://127.0.0.1:3000/api/internal/drive-sync/backfill'

# ulangi lampiran yang gagal (setelah memperbaiki izin/kuota)
... -d '{"limit":25,"status":"failed"}'
```

Status tersimpan di tabel `Attachment`: `driveStatus` (`pending`/`synced`/`failed`/
`skipped`), `driveFileId`, `driveUrl`, `driveFolderId`, `driveSyncedAt`,
`driveAttempts`, `driveError`.

## Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| `configured:false` | `GDRIVE_FOLDER_ID` atau kredensial belum terbaca container |
| `Google Drive 403 ... storageQuotaExceeded` | Folder di My Drive; pindahkan ke Shared Drive atau pakai impersonation/OAuth |
| `Google Drive 404` saat cari/buat folder | Service account belum punya akses ke folder induk |
| `Google Drive 401` | Service account JSON/refresh token salah atau Drive API belum aktif |
| Lampiran `failed` | Lihat `driveError`; perbaiki penyebab lalu backfill `status=failed` |

## Catatan keamanan

- Link Drive mengikuti permission folder Drive. Batasi sharing folder (bukan
  "anyone with the link") karena laporan berisi data pelanggan.
- Route `/api/uploads/...` yang lama tetap dapat diakses tanpa login bila URL diketahui.
  Fitur ini tidak mengubah perilaku tersebut; pengamanan route itu adalah pekerjaan
  terpisah.
- File tetap disimpan lokal di volume `noc_uploads`; Drive adalah arsip tambahan, bukan
  pengganti penyimpanan utama.
