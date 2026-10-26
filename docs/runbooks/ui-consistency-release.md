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

`https://noc.servicex.id` mengembalikan **521** dari reverse proxy publik. Bukti: host aplikasi tidak membuka listener 443 (hanya 3000 via docker-proxy); saat `https://noc.servicex.id/login` diminta, tidak ada paket `GET /login` yang sampai ke port 3000 (0 hit), sementara traffic HTTP/1.1 dari `43.225.64.190` ke aplikasi tetap berjalan normal (mis. `PATCH /api/tickets/...`). Artinya kegagalan ada di lapisan TLS/HTTPS proxy, bukan di container aplikasi. Perlu akses ke proxy tersebut (bukan host `ewo`) untuk memperbaikinya.

## Rollback

```sh
sudo /opt/noc-manager2/releases/ui-consistency-7ae7fb8/rollback.sh
```

Rollback hanya mengganti image kembali ke `release-v3-theme-6ea74c6`; tidak menyentuh database. Backup database tersedia bila diperlukan pemulihan terpisah.

## Tindak lanjut 3.1.0 (changelog dan versi)

Commit `5a47019` menambahkan `CHANGELOG.md` (Keep a Changelog 1.1.0 + SemVer), panduan
`docs/CHANGELOG_GUIDE.md`, validator `scripts/changelog-check.cjs` dan gate CI, serta menaikkan
`package.json` ke `3.1.0`.

- Image: `noc-manager2-app:release-3.1.0` (dasar `release-7ae7fb8`, label revision `5a47019…`).
- Release dir: `/opt/noc-manager2/releases/ui-consistency-3.1.0` (`Dockerfile`, `release.yml`, `rollback.yml`, `rollback.sh`, `build.log`).
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.1.0-20261024T170835Z.dump` (20.5 MB).
- Verifikasi: container `noc-manager2-app-1` Up, `RestartCount=0`, `/login` 200, `/api/trouble-masters` 401, log start `@hendrax5/noc-manager2@3.1.0`.
- Rollback: `sudo /opt/noc-manager2/releases/ui-consistency-3.1.0/rollback.sh` (kembali ke `release-7ae7fb8`).
- Perubahan runtime hanya string versi di navbar; tidak ada migrasi database.

## Tindak lanjut 3.1.1 (kesiapan Kinerja)

Commit `8f11fe3`, image `noc-manager2-app:release-3.1.1` (dasar `release-3.1.0`).

- Tab tim Kinerja menampilkan panel kesiapan: jumlah anggota dengan penempatan sebulan penuh, kebijakan published, konteks jadwal, bukti direview, serta alasan penghambat teratas. API overview menyertakan `readiness` dan `reasons` per anggota.
- Audit produksi 2026-10 saat rilis: 0 penempatan, 0 kebijakan published, 0 konteks bulanan, 0 bukti direview, 0 laporan harian submitted, 0 fase selesai. Karena itu semua nilai tetap `null` sampai konfigurasi dan bukti diisi; ini bukan regresi UI.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.1.1-20261024T172246Z.dump` (20.5 MB).
- Verifikasi: container `noc-manager2-app-1` Up, `RestartCount=0`, `/login` 200, `/api/reports/kinerja/overview` 401, log start `@hendrax5/noc-manager2@3.1.1`.
- Rollback: `sudo /opt/noc-manager2/releases/ui-consistency-3.1.1/rollback.sh` (kembali ke `release-3.1.0`).

Bukti tampilan panel kesiapan (fixture QA, bukan data produksi):

![Panel kesiapan Kinerja](../design/2026-10-24-trouble-master/kinerja-readiness.png)

## Tindak lanjut 3.2.0 (aktivitas tim)

Commit `db3877b`, image `noc-manager2-app:release-3.2.0` (dasar `release-3.1.1`).

- Tab tim Kinerja menampilkan **Peringkat aktivitas bulan ini** dari data operasional nyata: tiket selesai (resolvedAt dalam bulan), komentar/respons (createdAt dalam bulan), dan poin ledger `TicketHistory.awardedScore` + `Ticket.awardedScore`.
- Ringkasan produksi Oktober saat rilis: 2.867 tiket selesai, 7.599 komentar, 23.361 poin ledger, 84 user aktif (seluruh cakupan; angka per user mengikuti scope akses).
- Tampilan tetap memisahkan aktivitas operasional dari evaluasi formal berbasis bukti. Panel kesiapan tetap menjelaskan mengapa nilai formal `null`.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.2.0-20261024T173333Z.dump` (20.5 MB).
- Verifikasi: container Up, `RestartCount=0`, `/login` 200, `/api/reports/kinerja/overview` 401, log start `@hendrax5/noc-manager2@3.2.0`.
- Rollback: `sudo /opt/noc-manager2/releases/ui-consistency-3.2.0/rollback.sh` (kembali ke `release-3.1.1`).

## Tindak lanjut 3.3.0 (skor aktivitas)

Commit `c45a9f3`, image `noc-manager2-app:release-3.3.0` (dasar `release-3.2.0`).

- Skor aktivitas 0-100 per anggota: **40% poin + 35% tiket selesai + 25% respons**, masing-masing dinormalisasi terhadap nilai tertinggi pada filter aktif. Tabel diurutkan berdasarkan skor.
- Skor ini operasional dan terpisah dari evaluasi formal berbasis bukti. Panel kesiapan tetap menjelaskan mengapa nilai formal masih `null`.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.3.0-20261024T173924Z.dump` (20.5 MB).
- Verifikasi: container Up, `RestartCount=0`, `/login` 200, API Kinerja 401, log start `@hendrax5/noc-manager2@3.3.0`.
- Rollback: `sudo /opt/noc-manager2/releases/ui-consistency-3.3.0/rollback.sh` (kembali ke `release-3.2.0`).

## Tindak lanjut 3.4.0 (peringkat per departemen)

Commit `4a6e346`, image `noc-manager2-app:release-3.4.0` (dasar `release-3.3.0`).

- Skor aktivitas dinormalisasi di dalam cohort **departemen + perusahaan**; peringkat memakai competition rank per cohort. Tabel tim diurutkan per departemen lalu peringkat, sehingga setiap departemen memiliki peringkat 1..n sendiri.
- Peringkat pribadi dihitung dari departemen anggota sendiri. Staf tetap tidak menerima daftar rekan; hanya peringkat dan skor dirinya. Manager melihat departemen yang granted; Admin melihat semua.
- Unit test `lib/reports/activityScore.test.mjs` (3 kasus: normalisasi per departemen, pemisahan perusahaan, seri) lulus.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.4.0-20261024T180106Z.dump` (20.5 MB).
- Verifikasi: container Up, `RestartCount=0`, `/login` 200, API Kinerja 401, log start `@hendrax5/noc-manager2@3.4.0`.
- Rollback: `sudo /opt/noc-manager2/releases/ui-consistency-3.4.0/rollback.sh` (kembali ke `release-3.3.0`).

## Tindak lanjut 3.5.0 (metrik timeline tiket)

Commit `88c2669`, image `noc-manager2-app:release-3.5.0` (dasar `release-3.4.0`).

- Metrik personal kini memakai timestamp tiket: `firstRespondedAt` (termasuk balasan internal), riwayat penugasan (`TicketHistory` berisi "assign"), `resolvedAt`, `responseDueAt`, `resolutionDueAt`, dan `slaBreaches`.
- Metrik baru: respons pertama setelah penugasan, waktu penanganan sejak penugasan, total waktu penyelesaian, tiket selesai, tiket dengan balasan internal, tiket selesai sesuai tenggat, tiket tanpa pelanggaran SLA, follow-up sesuai tenggat respons.
- Metrik review manual (kualitas/ketepatan waktu) hanya ditampilkan jika review tersedia; metrik fase hanya jika ada fase. Dengan demikian tiket internal tanpa balasan publik tetap punya bukti.
- Audit produksi: 2.858/2.867 tiket resolved memiliki `firstRespondedAt`; sampel user 133 memiliki 87 tiket resolved, 87 dengan riwayat penugasan dan respons; balasan internal bulan ini 0 (semua balasan publik).
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.5.0-20261024T180644Z.dump` (20.5 MB).
- Verifikasi: container Up, `RestartCount=0`, `/login` 200, API Kinerja 401, log start `@hendrax5/noc-manager2@3.5.0`.
- Rollback: `sudo /opt/noc-manager2/releases/ui-consistency-3.5.0/rollback.sh` (kembali ke `release-3.4.0`).

## Tindak lanjut 3.5.1 (perbaikan performa)

Commit `2b23d5d`, image `noc-manager2-app:release-3.5.1` (dasar `release-3.5.0`).

- Query timeline tiket (komentar tiket resolved + riwayat penugasan) hanya dijalankan untuk endpoint personal (`includeTicketTimeline:true`); overview tim tidak mengulang query tersebut per anggota.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.5.1-20261024T180859Z.dump` (20.5 MB).
- Verifikasi: container Up, `RestartCount=0`, `/login` 200, API Kinerja 401, log start `@hendrax5/noc-manager2@3.5.1`.
- Rollback: `sudo /opt/noc-manager2/releases/ui-consistency-3.5.1/rollback.sh` (kembali ke `release-3.5.0`).

## Tindak lanjut 3.6.0 (tabel terpadu, tiket, perbandingan)

Commit `72d0f5f`, image `noc-manager2-app:release-3.6.0` (dasar `release-3.5.1`).

- Tabel tim kini satu tabel per departemen: skor aktivitas, tiket selesai, respons, poin, dan kolom nilai/status formal bila sudah tersedia; tabel formal terpisah dihapus. Tombol Rincian membuka detail anggota.
- Detail personal menampilkan **Tiket yang dikerjakan** (PIC atau respons) dengan tautan tiket, status, tanggal selesai, waktu respons, dan poin.
- Perbandingan bulan berjalan vs bulan sebelumnya per departemen: skor rata-rata, poin/anggota, tiket/anggota, dan selisihnya, diurutkan dari kenaikan skor.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.6.0-20261024T182809Z.dump` (20.5 MB).
- Verifikasi: container Up, `RestartCount=0`, `/login` 200, API Kinerja 401, log start `@hendrax5/noc-manager2@3.6.0`.
- Rollback: `sudo /opt/noc-manager2/releases/ui-consistency-3.6.0/rollback.sh` (kembali ke `release-3.5.1`).

## Tindak lanjut 3.6.1 (kontras tema terang/gelap)

Commit `6db13dc`, image `noc-manager2-app:release-3.6.1` (dasar `release-3.6.0`).

- Top bar, tautan navigasi, tombol tema dan profil, menu dropdown, badge, serta overlay kini membaca token tema (`--heading-color`, `--text-color`, `--ui-subtle`, `--ui-line`, `--ui-on-accent`, `--ui-overlay`) dan tidak lagi memakai nilai putih tetap, sehingga dashboard terbaca di tema terang tanpa mengubah tampilan tema gelap.
- Switcher My Workspace/Sky View memakai `--ui-subtle`/`--ui-line`, bukan putih transparan.
- Kontras teks tema terang: heading 15.82:1, tautan nav 10.00:1, teks muted 6.05:1, label tombol aksen 5.12:1 (semua di atas WCAG AA 4.5:1).
- Perbaikan build: selector `.page-header` yang hilang pada commit `d449573` dipulihkan di commit `6db13dc`; `npm run build` lulus.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.6.1-20261026T015020Z.dump` (20.6 MB).
- Verifikasi: container Up, `RestartCount=0`, image `release-3.6.1`, `/login` 200, `/dashboard` 307, log start `@hendrax5/noc-manager2@3.6.1`, aturan CSS terkompilasi memakai token tema.
- Rollback: `sudo /opt/noc-manager2/releases/ui-contrast-3.6.1/rollback.sh` (kembali ke `release-3.6.0`).

## Tindak lanjut 3.6.2 (halaman tiket error pada tiket ber-routing)

Commit `270e9a8`, image `noc-manager2-app:release-3.6.2` (dasar `release-3.6.1`).

- Gejala: `/tickets/45923` (dan tiket lain hasil alur kerja) menampilkan halaman error. Log server: `Objects are not valid as a React child (found: object with keys {serviceId, customerId, orderCompany})`.
- Penyebab: blok **Attached Parameters** merender seluruh nilai `customData` apa adanya. Tiket yang dibuat lewat alur kerja menyimpan `serviceRouting` berupa array objek (`lib/tickets/workMetadata.js:20`), sehingga React menolak merendernya dan subtree halaman gagal.
- Dampak terukur: 18 tiket memuat `serviceRouting`; `serviceRouting` adalah satu-satunya nilai non-skalar di `customData` tiket. Tiket tanpa `serviceRouting` (mis. 45922, 45936) tidak terpengaruh.
- Perbaikan: nilai `customData` diubah ke teks (`formatCustomValue`) dan kunci internal `serviceRouting` disembunyikan dari daftar parameter; `routingStatus` tetap tampil sebagai informasi.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.6.2-20261026T072812Z.dump`.
- Verifikasi: container Up, `RestartCount=0`, image `release-3.6.2`, log start `@hendrax5/noc-manager2@3.6.2`; tiket 45923, 45766, 45696 → 200, 0 error React child baru, blok Attached Parameters tampil, label `serviceRouting` tidak dirender.
- Rollback: `sudo /opt/noc-manager2/releases/ticket-render-3.6.2/rollback.sh` (kembali ke `release-3.6.1`).

## Tindak lanjut 3.6.3 (hardening preventif render JSON)

Commit `7ffbcba`, image `noc-manager2-app:release-3.6.3` (dasar `release-3.6.2`).

- Helper bersama `lib/ui/customDataView.js`: `formatCustomValue` (semua nilai JSON → teks; objek/array diserialisasi, nilai tak terserialisasi jatuh ke `String()`), `displayableCustomEntries` (buang nilai falsy dan kunci internal), dan `INTERNAL_CUSTOM_KEYS` (`serviceRouting`).
- Dipakai di **detail tiket** dan **detail layanan** (tab parameter) — titik laten dengan pola render `{val}` yang sama.
- `app/error.js`: error boundary rute menampilkan layar "Halaman gagal dimuat" dengan tombol Coba lagi dan kode kesalahan (digest), sehingga kegagalan render berikutnya tidak mematikan halaman.
- Unit test `lib/ui/customDataView.test.mjs` (6 test): tipe skalar, objek/array/bersarang/circular, NaN/Infinity, daftar parameter, input non-objek, plus guard yang memastikan kedua titik render mengimpor dan memakai helper.
- Bukti uji probe: objek `{"nested":[1,2],"obj":{"k":"v"}}` disuntik sementara ke `customData` tiket 45923 → halaman 200, 0 error React, nilai tampil sebagai teks JSON, label tampil; data dipulihkan persis (`restored_equal=true`).
- Verifikasi: 18 tiket ber-`serviceRouting` → 0 gagal (200, blok parameter tampil), `/assets/872` 200, 0 error React child sejak deploy, boundary terkompilasi ke `.next`.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.6.3-20261026T073449Z.dump`.
- Rollback: `sudo /opt/noc-manager2/releases/preventive-json-3.6.3/rollback.sh` (kembali ke `release-3.6.2`).

Aturan untuk perubahan berikutnya: **jangan pernah merender nilai `customData` (atau JSON bebas lainnya) langsung sebagai child React** — selalu lewat `formatCustomValue`/`displayableCustomEntries`.

## Tindak lanjut 3.7.0 (subject instalasi otomatis)

Commit `807a62b`, image `noc-manager2-app:release-3.7.0` (dasar `release-3.6.3`).

- Subject tiket instalasi kini dibentuk otomatis dari jenis pekerjaan + CID + **Nama layanan/site**: `Instalasi Baru - <CID> - <Nama layanan/site>`. Nilai diperbarui setiap kali CID atau nama layanan diisi selama operator belum mengedit subject secara manual.
- Helper `lib/tickets/subject.js`: `installationSubject` (bagian kosong dilewati, duplikat teks dihapus, dipotong 500 karakter sesuai batas input) dan `serviceWorkSubject` untuk pekerjaan layanan non-instalasi.
- Unit test `lib/tickets/subject.test.mjs` (5 test): lengkap, sebagian terisi, kosong, duplikat, batas 500, dan bentuk subject pekerjaan layanan.
- Verifikasi: `/tickets/new?workType=ServiceWork&operation=Installation&serviceId=872` → 200 dan subject `Instalasi Baru - SAP-C-0006-0770 - ERIK CAHYONO (PERORANGAN) #LINK 2 JEMPUT DI CLOSURE ION -7.732225, 111.951258`; 0 error di log.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.7.0-20261026T074226Z.dump`.
- Rollback: `sudo /opt/noc-manager2/releases/installation-subject-3.7.0/rollback.sh` (kembali ke `release-3.6.3`).

## Tindak lanjut 3.7.1 (label CID/Site, nama perusahaan tidak diulang)

Commit `6a7dd00`, image `noc-manager2-app:release-3.7.1` (dasar `release-3.7.0`).

- Format subject menjadi `Instalasi Baru - CID: <CID> - Site <site>`. Nama customer/perusahaan tidak lagi masuk subject karena sudah punya field sendiri.
- `siteLabel()` membersihkan nama layanan dari prefix customer sebelum dipakai: bentuk legal di depan (`PT Vissie Cyber Data Site …`) maupun di belakang (`GASTRO BERKAT USAHA, PT Site …`), nama dengan catatan merek dalam kurung (`MEDIA AKSES DATA (MMD)` vs `MEDIA AKSES DATA, PT (AKSES NET) Site …`), sisa kurung penutup, dan penanda `Site :` yang berulang. Prefix hanya dipotong bila memang cocok dengan nama customer; selain itu nama hanya dirapikan.
- Nama yang sudah memuat kata “Site” tidak diberi label `Site` dua kali.
- Uji data produksi: 22 nama layanan terpanjang/ber-`site` dipreview; prefix perusahaan terpotong benar (mis. `PT TELKOM SATELIT INDONESIA (TELKOMSAT) Site …` → `Site PUSAT PENGENDALI SATELIT KLAPANUNGGAL`).
- Unit test `lib/tickets/subject.test.mjs` menjadi 11 test (tambah kasus legal terbalik, catatan merek, sisa kurung, dan kurung yang bukan bagian nama customer).
- Verifikasi produksi: service 872 → `Instalasi Baru - CID: SAP-C-0006-0770 - Site ERIK CAHYONO (PERORANGAN) #LINK 2 JEMPUT DI CLOSURE ION -7.732225, 111.951258`; service 868 → `… - Site POP Tulungagun`; service 844 → `… - Site One Satrio Mall`; 0 error.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.7.1-20261026T075234Z.dump`.
- Rollback: `sudo /opt/noc-manager2/releases/subject-site-label-3.7.1/rollback.sh` (kembali ke `release-3.7.0`).

## Tindak lanjut 3.8.0 (pencarian CID berdasarkan nomor tiket)

Commit `66b132b`, image `noc-manager2-app:release-3.8.0` (dasar `release-3.7.1`).

- Latar: operator mencari `HSK-…` di Penautan CID dan tidak menemukan baris, karena pencarian hanya mencocokkan CID dan nama sumber. Tiket `HSK-T879-YX6C` (CID `SAP-C-0006-0468`) sebenarnya ada sebagai baris `needs_mapping`.
- `buildCircuitCandidates` kini menyimpan seluruh tracking id tiket sumber (`trackingIds`), dan helper `matchesCircuitQuery` mencocokkan CID, nama sumber, atau tracking id. Dipakai kedua endpoint (`circuit-candidates` dan alias `sap-circuits`); `trackingIds` tetap tidak dikirim ke klien.
- UI Penautan CID: label/pencarian menjadi "Cari CID, nomor tiket, atau nama", nomor tiket pertama tampil di kolom Tiket (detail lainnya tetap ada), dan pesan kosong menjelaskan cakupan pencarian.
- Unit test `lib/services/circuitAssets.test.mjs` +2 (tracking id terkumpul; pencarian CID/nama/tracking, case-insensitive).
- Verifikasi: `q=HSK-T879-YX6C` → 1 (sebelumnya 0), `q=SAP-C-0006-0468` → 1, `q=KHOIRUL` → 3, query tak dikenal → 0; respons tanpa `trackingIds`; `/assets` 200; string UI baru ada di bundle `.next`.
- Backup sebelum switch: `/opt/noc-manager2/backups/pre-3.8.0-20261026T081951Z.dump`.
- Rollback: `sudo /opt/noc-manager2/releases/cid-search-tracking-3.8.0/rollback.sh` (kembali ke `release-3.7.1`).
