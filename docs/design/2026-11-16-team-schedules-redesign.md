# Desain Ulang Menu `/team` & `/team/schedules` (Perlindungan Jadwal Tgl 15, Offboarding Resign, & UI/UX Token `--ui-*`)

Tanggal: 2026-11-16  
Status: Disetujui ringkas — siap implementasi bertahap

---

## 1. Masalah & Akar Masalah di Kode Saat Ini

### 1.1 Mengapa Jadwal Terasa Tiba-Tiba Berubah Saat Tanggal 15 / Generate Manual
1. **Auto-generate tgl 15 (`POST /api/schedules/auto-generate`) menimpa total bulan target tanpa cek jadwal eksisting**:
   - `lib/schedules/generatePola.js` (`generateDepartmentMonth`) langsung menjalankan `tx.shiftSchedule.deleteMany(...)` untuk seluruh user departemen pada bulan target, walaupun departemen tsb **sudah punya jadwal** yang dibuat manual atau pernah di-generate sebelumnya.
   - Jika 1 departemen gagal saat cron tanggal 15 (`hardFails.length > 0`), `lastScheduleAutoGenerateKey` **tidak disimpan** (`app/api/schedules/auto-generate/route.js`), sehingga retry cron pada jam berikutnya mengulang generate **semua departemen** lagi — menimpa departemen yang sebelumnya sukses atau baru saja diedit manual.
2. **Tombol Generate Manual ambigu & rawan menimpa bulan berjalan**:
   - Di `app/team/schedules/SchedulesClient.js`, tombol **"Generate POLA Roster"** mengirim `year: calYear, month: calMonth + 1` (bulan yang **sedang dilihat** di kalender, yang saat tgl 15 hampir selalu bulan berjalan!), hanya dipagari `window.confirm("Generate roster ... untuk bulan ini?")` dan langsung menghapus seluruh editan manual, swap, lembur, stabilo, dan catatan.
   - Di tab lain ada **"Force run now (next month)"** yang menimpa bulan depan tanpa preview.
3. **Bug timezone fetch kalender di `SchedulesClient.js`**:
   - `new Date(calYear, calMonth, 1).toISOString()` & `new Date(calYear, calMonth + 1, 0, 23, 59, 59).toISOString()` bergantung pada timezone browser client, berisiko menggeser batas tanggal 1 / tanggal akhir bulan saat di-query ke kolom `@db.Date` (`YYYY-MM-DD`).

### 1.2 Mengapa User Resign / Keluar Perusahaan Tetap Masuk Jadwal & Sistem
1. **`model User` tidak punya status keaktifan (`active`, `resignedAt`, `scheduleEligible`)** di `prisma/schema.prisma`.
2. **`DELETE /api/users/[id]` gagal karena Foreign Key `Restrict` & riwayat operasional**:
   - Relasi `Ticket`, `MonthlyEvaluation`, `EmployeeAssignmentPeriod`, `WorkEvidenceReference`, `DailyReport`, `Comment`, `ShiftSchedule` mencegah hard delete — akibatnya user resign dibiarkan hidup di tabel `User`.
3. **Semua query memilih user tanpa filter keaktifan**:
   - `lib/schedules/generatePola.js` hanya memfilter `role.name !== "Manager"` & email tidak kosong, sehingga user resign terus masuk pool OR-Tools solver setiap bulan.
   - `app/api/auth/[...nextauth]/route.js`, `lib/tickets/routing.js`, `app/tickets/new/page.js`, `app/tickets/[id]/page.js`, `app/meetings/new/page.js`, `app/api/v1/meta/users/route.js`, dan `/team/schedules` ikut menarik user resign.

### 1.3 Masalah UI/UX & Konsistensi Token Desain
- `app/team/page.js`, `TeamAccessManager.js`, `UserTableClient.js`, `app/team/schedules/page.js`, dan `SchedulesClient.js` penuh kelas legacy `.ui-static-*` dan `style={{...}}` hardcoded (misal `#cbd5e1`, `#f59e0b`, `#0f172a`), form grid 6 kolom yang pecah di layar kecil, dropdown `Actions ▾` native select yang canggung, dan ringkasan fairness menyatu memanjang di atas tabel kalender.
- Tidak ada visibilitas jelas: siapa saja user yang **Aktif Shift**, **Non-Shift (Manager/Office)**, atau **Resign/Nonaktif**, dan bagaimana status eksekusi auto-generate tgl 15 per departemen.

---

## 2. Arsitektur Solusi

### 2.1 Perubahan Skema Prisma (`prisma/schema.prisma`)
1. Pada `model User`:
   - `active Boolean @default(true)` — status akun aktif/nonaktif (resign).
   - `resignedAt DateTime?` — tanggal nonaktif/keluar perusahaan.
   - `inactiveReason String?` — alasan singkat (mis. `"Resign"`, `"Mutasi"`, `"Nonaktif sementara"`).
   - `scheduleEligible Boolean @default(true)` — kontrol eksplisit keikutsertaan roster shift (memisahkan staff office aktif yang non-shift dari crew shift).
2. Pada `model ShiftSchedule`:
   - `manualEdited Boolean @default(false)` — diset `true` setiap kali sel diubah/diswap secara manual via `PATCH /api/schedules`.

### 2.2 Perlindungan Jadwal Tanggal 15 & Regenerate (`lib/schedules/`)
1. **Helper murni yang mudah diuji (`lib/schedules/protection.js`)**:
   - `isManuallyProtectedCell(cell)`: mengembalikan `true` jika `cell.manualEdited === true` **atau** `cell.isLembur === true` **atau** `cell.noteUpdatedBy != null` **atau** `(cell.note && cell.note !== STANDBY_NOTE)` **atau** `(cell.highlightColor && cell.note !== STANDBY_NOTE)` **atau** `(cell.generatedShiftTypeId !== null && cell.shiftTypeId !== cell.generatedShiftTypeId)`.
   - `partitionDepartmentMonthRows({ existingRows, generatedRows, activePoolUserIds, overwriteMode })`:
     - `overwriteMode = "preserve_manual"` (default aman): sel yang `isManuallyProtectedCell(cell)` tetap dipertahankan; sel non-manual pada bulan target diperbarui dari output solver; sel non-manual milik user yang sudah resign/tidak eligible di bulan baru dibersihkan.
     - `overwriteMode = "force_all"`: timpa seluruh sel departemen pada bulan target (hanya jika dikonfirmasi eksplisit oleh admin).
2. **Idempoten per departemen di `generateDepartmentMonth` & `auto-generate`**:
   - Parameter baru: `{ departmentId, year, month, polaOverride = null, skipIfExists = false, overwriteMode = "preserve_manual" }`.
   - Jika `skipIfExists === true` dan jumlah jadwal non-kosong departemen tsb di bulan target `> 0`, departemen di-skip (`skipped: true, reason: "already_exists"`) sehingga jadwal yang sudah ada tidak pernah berubah tiba-tiba.
   - `POST /api/schedules/auto-generate`:
     - Default selalu memanggil `generateAllDepartmentsMonth` dengan `skipIfExists: true` & `overwriteMode: "preserve_manual"` pada `nextMonthPartsJakarta()`.
     - Menyimpan laporan eksekusi terakhir per departemen ke `AppSetting` (`lastScheduleAutoGenerateReport`) dan menandai `lastScheduleAutoGenerateKey` ketika semua departemen selesai (`ok` atau `skipped: "already_exists"` / `"no_eligible_users"`). Jika satu departemen gagal, retry berikutnya otomatis meng-skip departemen yang sudah berhasil karena `skipIfExists: true`.
3. **Preview Dampak Generate (`GET /api/schedules/generate/preview`)**:
   - Sebelum mengeksekusi generate/regenerate manual, UI memanggil preview untuk mengetahui per departemen / target bulan:
     - `existingCount` (total sel terisi di bulan target),
     - `manualProtectedCount` (jumlah sel edit manual / lembur / stabilo / catatan),
     - `eligibleUserCount` (user `active && scheduleEligible && role !== Manager`),
     - `excludedResignedCount` (user nonaktif yang otomatis tidak ikut roster).
4. **Fix Query Tanggal Kalender Bebas Timezone (`app/api/schedules/route.js` & `SchedulesClient.js`)**:
   - `GET /api/schedules` mendukung parameter `month=YYYY-MM` atau `start=YYYY-MM-DD&end=YYYY-MM-DD` menggunakan `dateOnlyToUtcDate` (UTC midnight tanpa pergeseran TZ browser).

### 2.3 Offboarding & Status User Resign (`active`, `resignedAt`, `scheduleEligible`)
1. **`app/api/users/[id]/route.js` & `/api/users/route.js`**:
   - `POST /api/users`: mendukung `scheduleEligible` (default `true` kecuali role Manager, atau sesuai input), `locationId`, `scheduleFlag`.
   - `PATCH /api/users/[id]`:
     - Mendukung `active`, `resignedAt`, `inactiveReason`, `scheduleEligible`, `locationId`, `scheduleFlag`, plus data profil/role/dept (update parsial aman tanpa wajib mengisi ulang semua field).
     - Proteksi diri: tolak menonaktifkan akun sendiri (`400`).
     - Saat `active` berubah menjadi `false`, set `resignedAt = resignedAt || new Date()` dan opsional bersihkan jadwal masa depan yang belum pernah diedit manual jika diminta (`cleanupFutureSchedules: true` — default opsional di modal offboard, mis. mulai tanggal efektif resign atau bulan berikutnya, sementara jadwal lampau tetap utuh!).
     - Saat `active` diaktifkan kembali (`true`), reset `resignedAt = null, inactiveReason = null`.
   - `DELETE /api/users/[id]`:
     - Cek histori (tiket, jadwal, laporan, komentar, evaluasi); bila ada histori atau `P2003`, return `409` `{ code: "HAS_HISTORY", error: "...Gunakan Nonaktifkan/Resign agar riwayat tetap utuh." }`.
2. **Penerapan Filter `active: true` di Seluruh Titik Kritis**:
   - `lib/schedules/generatePola.js`: `where: { departmentId, active: true, scheduleEligible: true, role: { name: { not: "Manager" } }, NOT: { email: "" } }`.
   - `app/api/auth/[...nextauth]/route.js`: blokir login di `authorize()` jika `!user.active`, dan di `session()` kembalikan `null` bila `dbUser?.active === false` sehingga sesi lama user resign langsung ter-revoke.
   - `lib/tickets/routing.js`: `where.active = true` di `pickLeastBusyAssignee`.
   - `app/tickets/new/page.js`, `app/tickets/[id]/page.js`, `app/meetings/new/page.js`, `app/meetings/[id]/page.js`: query `where: { active: true }` untuk pilihan assignee/peserta aktif (pada halaman detail tiket/meeting, assignee/peserta lama tetap tampil bila terikat data historis).
   - `app/api/v1/meta/users/route.js`: default `active: true` (kecuali `?includeInactive=true`).

### 2.4 Perapihan UI/UX `/team` & `/team/schedules` (CSS Modules + Token `--ui-*`)
1. **CSS Modules Bebas `.ui-static-*`**:
   - `app/team/team.module.css` untuk `/team`, `TeamAccessManager.js`, `UserTableClient.js`.
   - `app/team/schedules/schedules.module.css` untuk `/team/schedules`, `SchedulesClient.js`.
   - Memakai 100% token `app/ui-tokens.css` (`--ui-surface`, `--ui-bg`, `--ui-ink`, `--ui-text`, `--ui-muted`, `--ui-line`, `--ui-accent`, `--ui-danger-*`, `--ui-warning-*`, `--ui-success-*`), responsif mobile-first, dan mendukung light/dark mode.
2. **Navigasi & Halaman `/team`**:
   - Sub-nav konsisten antara **Anggota & Akses (`/team`)** dan **Jadwal Shift (`/team/schedules`)**.
   - Ringkasan status tim di atas tabel (Total Aktif, Ikut Shift, Non-Shift/Manager, Resign/Nonaktif).
   - Filter **Status** (`Aktif` / `Semua` / `Resign`), **Departemen**, **Sort**, dan **Pencarian** dalam satu toolbar rapi.
   - Form tambah user responsif (`grid-template-columns: repeat(auto-fit, ...)` atau modal/panel collapsible agar tidak sesak 6 kolom).
   - Tabel anggota jelas: menampilkan badge status (`Aktif · Shift`, `Aktif · Non-Shift`, `Resign · DD MMM YYYY`) + tombol aksi langsung (**Edit** & **Resign / Aktifkan**) alih-alih dropdown `Actions ▾`.
   - Dialog **Offboard / Tandai Resign** (`<dialog>` / modal aksesibel): input alasan resign, opsi tanggal efektif, opsi bersihkan jadwal belum-jalan di bulan berikutnya, dan penjelasan bahwa data tiket/laporan/jadwal lama tetap terjaga.
3. **Halaman `/team/schedules`**:
   - **Header & Status Bar Ringkas**:
     - Status Solver OR-Tools (`Online` / `Offline`).
     - Banner **Auto-Generate Tgl `{autoDay}` (01:00 WIB)**: menjelaskan secara eksplisit bahwa sistem men-generate **bulan berikutnya** hanya untuk departemen yang **belum punya jadwal** (tidak menimpa bulan berjalan atau sel edit manual), plus ringkasan hasil run terakhir per departemen.
   - **Toolbar Kalender & Tombol Generate Jelas**:
     - Kontrol bulan (`< Prev` | Bulan & Tahun | `Next >`), Filter Departemen, Filter Lokasi.
     - Tombol **Generate Bulan Depan (`NamaBulan`)** (utama, aman — membuka modal preview) dan **Regenerate Bulan Ini (`NamaBulanCal`)** (sekunder — membuka modal konfirmasi dengan pilihan `Pertahankan Edit Manual` vs `Timpa Semua`).
   - **Collapsible Ringkasan Fairness**: ringkasan jumlah shift/lembur/jam kerja per departemen dapat di-expand/collapse agar tidak mendorong tabel kalender terlalu jauh ke bawah.
   - **Grid Jadwal**:
     - Sticky kolom Nama + Total Jam yang kontras & bersih di light/dark mode.
     - User resign hanya muncul di bulan historis yang memang masih memiliki jadwal mereka (dengan badge `Resign`), dan otomatis tidak muncul di bulan mendatang.
     - Indikator sel edit manual (`dot` catatan, icon/badge `Lembur`, stabilo bertoken).
   - **Tab User Preferences**: filter default user aktif (`active: true`) + toggle tampilkan nonaktif, serta toggle cepat `Ikut Roster Shift (scheduleEligible)` langsung terlihat sehingga admin paham mengapa seseorang masuk atau tidak masuk ke generator POLA.

---

## 3. Rencana Implementasi & Verifikasi
1. Tambah helper murni `lib/schedules/protection.js` + unit test lengkap `lib/schedules/protection.test.mjs` & perluas test jika perlu (`node --test`).
2. Update `prisma/schema.prisma` (`User.active`, `User.resignedAt`, `User.inactiveReason`, `User.scheduleEligible`, `ShiftSchedule.manualEdited`).
3. Update logika backend: `lib/schedules/generatePola.js`, `app/api/schedules/route.js`, `app/api/schedules/generate/route.js`, `app/api/schedules/generate/preview/route.js`, `app/api/schedules/auto-generate/route.js`, `app/api/schedules/preferences/route.js`, `app/api/users/route.js`, `app/api/users/[id]/route.js`, `app/api/auth/[...nextauth]/route.js`, `lib/tickets/routing.js`, serta filter user aktif di pickers & `/api/v1/meta/users`.
4. Rombak UI `/team` dan `/team/schedules` dengan `team.module.css` & `schedules.module.css` berbasis `--ui-*` token tanpa `.ui-static-*`.
5. Jalankan verifikasi: `node --test lib/schedules/*.test.mjs`, syntax check JS/MJS (`node --check`), audit CSS variable/token dan tidak adanya sisa `.ui-static-*` pada komponen `/team`.
