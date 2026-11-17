# Menu `/reports` (Kinerja): KPI Operasional Jelas, Perbandingan Periode & Tren Tim

Tanggal: 2026-11-16  
Status: Draft untuk review (belum ada perubahan kode implementasi)  
Cakupan: `/reports`, `KinerjaClient`, API `/api/reports/kinerja/*`, helper metrik & perbandingan di `lib/reports/`.  
Referensi terkait: [`2026-10-24-kinerja-release.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/service-work/2026-10-24-kinerja-release.md), [`2026-10-24-ui-consistency-pass.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/design/2026-10-24-ui-consistency-pass.md), [`ui-tokens.css`](file:///home/antigravity/hendrax5/noc-manager2/app/ui-tokens.css).

---

## 1. Latar Belakang & Temuan Aktual di Codebase

Audit terhadap implementasi `/reports` saat ini menunjukkan mengapa KPI terasa kabur, perbandingan naik/turun per anggota sulit dibaca, dan alur UI membingungkan bagi manager maupun anggota tim:

### A. Arah Masuk (*Landing*) & Navigasi Tidak Sesuai Peran
1. **Manager/Admin selalu mendarat di `"Kinerja saya"` bukan Ringkasan Tim**  
   - Pada [`app/reports/page.js`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/page.js#L17-L20), saat `unified_performance_ui` aktif, `initialTab` dikunci ke:
     `params.tab === 'activity' || params.legacy === '1' ? 'activity' : 'self'`.  
   - Akibatnya, Admin dan Manager yang membuka `/reports` untuk memantau tim tetap masuk ke tab pribadi dan harus menekan tab `"Keseluruhan & Departemen"` terlebih dahulu.
2. **Penamaan tab & mojibake karakter**  
   - Label tab `"Keseluruhan & Departemen"` kurang intuitif dibanding `"Performa Tim"`.  
   - Di [`KinerjaClient.js`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/KinerjaClient.js#L33), teks peringkat mengandung karakter rusak UTF-8 (`Â·` pada ``Skor aktivitas ${number(detail.ranking.score)} Â· ``).

### B. Perbandingan Periode Per Anggota Dibuang oleh API
1. **Endpoint `overview` sudah menghitung data bulan lalu, namun hanya mengagregasi level departemen**  
   - [`app/api/reports/kinerja/overview/route.js`](file:///home/antigravity/hendrax5/noc-manager2/app/api/reports/kinerja/overview/route.js#L31-L66) sudah memuat `previousMonth`, `previousMetrics`, `previousRows`, dan `previousById`.  
   - Namun data itu hanya dipakai untuk array `comparison` per pasangan `(departemen, perusahaan)` (baris 43–66) dan **tidak pernah ditempelkan ke baris per anggota** di `payloadRows`.  
   - Karena itu, manager tidak bisa melihat apakah performa individu A atau B naik atau turun dibanding bulan sebelumnya, apalagi melacak tren 3–6 bulan terakhir.
2. **Detail personal (`loadPersonalKinerja`) tidak memiliki perbandingan bulan lalu maupun seri tren**  
   - [`loadPersonalKinerja`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/kinerjaServer.js#L36-L66) hanya mengembalikan snapshot tunggal untuk 1 bulan terpilih (`month`). Tidak ada `previousMonth`, delta KPI, ataupun riwayat historis multi-bulan.

### C. Ketidakjelasan KPI & Kebisingan Visual di UI
1. **Skor relatif `0–100` bergantung pada max cohort yang berubah tiap bulan**  
   - [`scoreActivity`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/activityScore.js#L38-L41) menghitung `40% poin + 35% tiket selesai + 25% respons` yang dinormalisasi terhadap `max` cohort di bulan tersebut.  
   - Jika seluruh tim melambat, skor seseorang bisa naik ke `100` padahal tiket selesai dan kecepatan responsnya turun. Mengandalkan skor relatif ini sebagai indikator utama membuat penilaian naik/turun menyesatkan.
2. **KPI kecepatan & kepatuhan SLA belum hadir di tabel tim**  
   - [`loadActivityMetrics`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/activityScore.js#L4-L19) hanya mengambil 3 hitungan volume (`resolved`, `responses`, `points`).  
   - KPI operasional penting seperti **median waktu respons pertama (`firstRespondedAt`)** dan **persentase tiket tepat SLA / tenggat (`resolutionDueAt` / `slaBreaches`)** hanya dihitung di [`calculatePerformanceMetrics`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/performanceMetrics.js#L5-L45) untuk view detail satu user, bukan di tabel perbandingan tim.
3. **Blok `"Nilai formal belum dapat dihitung"` mendominasi layar saat kalibrasi nonaktif**  
   - [`KinerjaClient.js`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/KinerjaClient.js#L25) merender blok `.setup` besar berisi 4 kolom hitungan + daftar alasan + 3 tautan aksi tepat di atas tabel tim setiap kali `readiness.ready === 0` (kondisi umum ketika mode masih simulasi atau kalibrasi belum lengkap).
   - Selain itu, detail anggota di [`KinerjaClient.js`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/KinerjaClient.js#L36) membuang 18+ baris metrik sekaligus dalam 1 tabel datar tanpa pengelompokan pilar KPI, kartu ringkasan atas, atau highlight arah tren.
4. **Styling masih minimalis & legacy fallback masih memakai `.ui-static-*`**  
   - [`kinerja.module.css`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/kinerja.module.css) belum memiliki kartu KPI terstruktur, badge delta semantik (`--ui-success`, `--ui-danger`, `--ui-warning`), sorotan `"Paling Meningkat"` / `"Perlu Perhatian"`, atau gaya sparkline SVG.  
   - Jalur fallback lama di [`app/reports/page.js`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/page.js#L43) dan [`LeaderboardClient.js`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/LeaderboardClient.js#L100) masih memakai class `.ui-static-*`.

---

## 2. Tujuan & Keputusan Desain (Terkonfirmasi)

Berdasarkan sesi klarifikasi bersama pemilik produk, redesain `/reports` mengunci keputusan berikut:

1. **Default Landing Mengikuti Peran (Role-Aware)**  
   - Pengguna dengan akses tim (`Admin`, `Manager`, atau pemilik permission/grant `view_team_reports` yang memiliki anggota dalam scope) otomatis mendarat di tab **Performa Tim** (kecuali URL eksplisit menyertakan `?tab=self` atau `?tab=activity`).  
   - Staff tanpa akses tim tetap mendarat langsung di tab **Kinerja Saya** tanpa melihat daftar/skor rekan kerja.
2. **Dua Mode Perbandingan Periode dalam Satu Alur**  
   - **Perbandingan Utama (MoM)**: Bulan terpilih dibanding **Bulan sebelumnya** (atau bulan pembanding lain dalam rentang wajar bila dipilih operator) dengan **delta absolut dan persentase**.  
   - **Tren Multi-Bulan (3–6 Bulan Terakhir)**: Seri historis per anggota dan rata-rata tim (pilihan jendela `3 bulan` atau `6 bulan`, default `6 bulan`) ditampilkan sebagai sparkline tren naik/turun pada baris tim dan grafik tren pada detail anggota.
3. **Fokus ke KPI Operasional Nyata + Pengurangan Kebisingan UI**  
   - Utamakan 4 KPI operasional konkret yang langsung dipahami pimpinan & staf: **Tiket Selesai**, **Poin Terakumulasi**, **Median Respons Pertama**, dan **% Tepat SLA / Tenggat** (ditambah konteks skor cohort & nilai formal sebagai informasi sekunder).  
   - Panel `"Nilai formal belum dapat dihitung"` diringkas menjadi **banner status satu baris yang dapat diperluas (`<details>`)** ketika `readiness.ready === 0`, agar data performa operasional langsung terlihat di *above-the-fold*.  
   - Tambahkan **Sorotan Otomatis Tim**: kartu ringkas `"Paling Meningkat"` (*Top Improvers*) dan `"Perlu Perhatian"` (*Needs Attention*) di atas tabel tim dengan ambang sampel minimum agar fluktuasi 1 tiket tidak memicu sinyal palsu.
4. **Invarian Keamanan, Privasi & Integritas Data Tetap Utuh**  
   - Seluruh batasan pada [`2026-10-24-kinerja-release.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/service-work/2026-10-24-kinerja-release.md) wajib dipertahankan:  
     - Staff tidak pernah menerima data/identitas/tren rekan dari `/api/reports/kinerja/overview`, `ranking`, maupun `users/[userId]`.  
     - [`canReadReport`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/reportScope.js#L19) dan [`canReadPerformanceDetails`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/performanceEvidence.js#L3) tetap menjadi gerbang keras sebelum query detail/tren dijalankan.  
     - Tidak memalsukan atau menebak nilai evaluasi formal; data tidak cukup tetap `null` (`Belum tersedia`), dan mode `simulation` vs `official` (`PerformancePublication`) tetap terpisah tegas.  
     - Semua batas bulan menggunakan [`jakartaMonthRange`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/monthPeriod.js#L2-L7) (zona waktu Asia/Jakarta / WIB).

---

## 3. Model KPI Operasional Terpadu & Logika Perbandingan Periode

### A. 4 KPI Operasional Utama Per Anggota
Seluruh KPI dihitung dari data operasional aktual (non-relatif terhadap performa rekan), sehingga naik-turun antarbulan mencerminkan kinerja individu yang sebenarnya:

| # | KPI | Definisi & Sumber Data | Arah Lebih Baik | Format Tampilan |
|---|---|---|---|---|
| 1 | **Tiket Selesai (`resolved`)** | Jumlah tiket dengan `assigneeId = userId` dan `resolvedAt` dalam rentang WIB bulan tersebut. | **Lebih tinggi lebih baik** | Angka bulat (`24 tiket`) + delta (`+6 / +33%`) |
| 2 | **Poin Kontribusi (`points`)** | Total `TicketHistory.awardedScore` (ledger pada periode) + `Ticket.awardedScore` (tiket resolved di periode). | **Lebih tinggi lebih baik** | Angka (`185 poin`) + delta (`+35 / +23%`) |
| 3 | **Median Respons Pertama (`medianResponseMinutes`)** | Persentil ke-50 (median) selisih menit dari `assignedAt` (riwayat assign pertama atau `createdAt` bila belum ada) hingga `firstRespondedAt` pada tiket yang selesai di periode tersebut (mempertahankan aturan [`performanceMetrics.js`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/performanceMetrics.js#L19-L26)). | **Lebih rendah lebih baik** (makin cepat makin baik) | Menit/jam (`14 mnt` atau `1j 20m`) + delta terbalik makna (`-8 mnt · Lebih cepat` hijau; `+12 mnt · Lebih lambat` merah) |
| 4 | **Kepatuhan SLA / Tepat Waktu (`slaCleanPct` / `onTimePct`)** | Persentase tiket selesai tanpa pelanggaran SLA (`slaBreaches === 0`), serta `onTimePct` untuk tiket yang memiliki `resolutionDueAt` (`resolvedAt <= resolutionDueAt`). Bila `dueCount === 0`, `onTimePct` bernilai `null`. | **Lebih tinggi lebih baik** | Persentase (`94,5%`, `18/19`) + delta poin persentase (`+4,2 pp`) |

**Catatan Sekunder (Konteks):**
- **Skor Aktivitas Cohort (`score`)** dan **Peringkat (`rank`)** tetap tersedia di kolom sekunder/detail agar transisi dengan histori versi 3.4–3.6 tetap terjaga, disertai keterangan jelas bahwa nilai tersebut relatif terhadap kelompok saat itu.
- **Nilai Evaluasi Formal (`total`)** dan status review (`status`, `reviewState`) tetap muncul bila kalibrasi/evaluasi aktif (`readiness.ready > 0`), atau diringkas pada detail anggota.

---

### B. Helper Murni Perbandingan & Tren (`lib/reports/performanceComparison.js`)
Untuk menjaga konsistensi antara overview tim, detail personal, dan pengujian unit tanpa DB, logika perbandingan ditempatkan pada modul murni baru `lib/reports/performanceComparison.js`:

1. **`computeMetricDelta(current, previous, { higherIsBetter = true, unit = 'count', minPercentBase = 1 })`**  
   - Jika `current == null` atau `previous == null`: kembalikan `{ delta: null, percentDelta: null, polarity: 'neutral', status: 'unavailable' }`.  
   - `delta = round1(current - previous)`.  
   - Untuk metrik persen (`slaCleanPct`, `onTimePct`), gunakan selisih *percentage points* (`delta` dalam `pp`) dan jangan membagi persen dengan persen secara membingungkan (`percentDelta: null`).  
   - Untuk metrik volume/durasi, hitung `percentDelta` hanya jika `previous >= minPercentBase` (menghindari lonjakan `+900%` palsu saat bulan lalu hanya `0` atau `1`). Jika `previous === 0` dan `current > 0`, tandai `isNewActivity: true` dengan label `"Baru aktif"`.  
   - `polarity`:  
     - Jika `higherIsBetter === true`: `delta > 0` → `'improved'`, `delta < 0` → `'declined'`.  
     - Jika `higherIsBetter === false` (mis. `medianResponseMinutes`): `delta < 0` (waktu turun/makin cepat) → `'improved'`, `delta > 0` (makin lambat) → `'declined'`.  
     - Toleransi zona datar (*deadband*): perubahan sangat kecil (mis. `< 5%` untuk volume/durasi atau `< 2 pp` untuk SLA, atau `Math.abs(delta) < 1` pada hitungan) diberi `'flat'` (*Stabil*) agar warna merah/hijau hanya menandai pergeseran yang bermakna.

2. **`classifyMemberTrend({ current, previous, history })`**  
   - Menentukan label arah komposit per anggota: `'up'` (*Naik*), `'down'` (*Turun*), `'flat'` (*Stabil*), `'new'` (*Baru Aktif*), atau `'inactive'` (*Belum Ada Aktivitas*).  
   - Dihitung dari kombinasi perubahan KPI operasional utama (bobot sinyal: `points` & `resolved` naik bermakna, didukung tidak turunnya `slaCleanPct` dan tidak melonjaknya `medianResponseMinutes`), ditambah konfirmasi kemiringan tren 3–6 bulan (`history`) untuk membedakan lonjakan satu kali vs kenaikan/penurunan konsisten.

3. **`selectTeamHighlights(rows, { maxPerGroup = 3 })`**  
   - **Paling Meningkat (`topImprovers`)**: anggota dalam filter aktif yang memiliki perbaikan terkuat dibanding bulan pembanding (minimal salah satu: `resolved >= 3` atau `points >= 15`, dan `trendDirection === 'up'` atau skor perbaikan operasional positif). Diurutkan dari peningkatan poin/tiket & perbaikan kecepatan terbesar.  
   - **Perlu Perhatian (`needsAttention`)**: anggota dalam scope yang memenuhi salah satu sinyal risiko nyata:  
     - Penurunan output signifikan dibanding bulan lalu (mis. `resolved` atau `points` turun `>= 25%` dengan basis bulan lalu `>= 3` tiket atau `>= 15` poin), **atau**  
     - `slaCleanPct < 85%` (dengan minimal 3 tiket selesai), **atau**  
     - `medianResponseMinutes` melambat `>= 30%` dan melampaui ambang wajar (dengan minimal 3 sampel respons).  
   - Setiap item highlight menyertakan `reasons: string[]` spesifik berbahasa Indonesia (mis. `"Tiket selesai naik +8 (+44%)"`, `"SLA turun dari 95% ke 78%"`, `"Respons melambat +18 mnt"`), bukan label generik.

4. **`buildRollingMonthKeys(monthKey, count = 6)`**  
   - Helper tanggal murni memakai UTC year-month stepping dari `monthKey` (`YYYY-MM`), menghasilkan urutan kronologis `[oldest ... monthKey]` sepanjang `count` bulan (divalidasi rentang `3..6`).

---

## 4. Kontrak API, Performa Query & Batas Keamanan

### A. Perluasan Batch Metrik di `lib/reports/activityScore.js` (atau `lib/reports/teamMetricsBatch.js`)
Saat ini [`loadActivityMetrics`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/activityScore.js#L4-L19) hanya menjalankan 4 `groupBy`. Jika untuk setiap user dan setiap 6 bulan kita memanggil [`collectPerformanceEvidence`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/performanceEvidence.js#L7) satu per satu, jumlah query akan meledak ($N \text{ users} \times 6 \text{ months} \times 10 \text{ queries}$).

**Solusi Batch Berkinerja Tinggi (Konstan $O(1)$ Query per Rentang Window)**:
1. Ambil seluruh rentang waktu gabungan `[rangeStart(oldestMonth), rangeEnd(selectedMonth)]` dalam **satu set query batch** untuk `userIds`:
   - `resolvedTickets`: `db.ticket.findMany({ where: { assigneeId: { in: ids }, resolvedAt: windowRange }, select: { id, assigneeId, createdAt, resolvedAt, firstRespondedAt, responseDueAt, resolutionDueAt, slaBreaches, awardedScore } })`
   - `assignmentHistory`: hanya untuk `resolvedTickets.map(t => t.id)` (ambil timestamp `action` mengandung `assign` terawal per tiket dalam 1 query `ticketHistory.findMany` terurut `createdAt: 'asc'`).
   - `comments`: `db.comment.findMany({ where: { authorId: { in: ids }, createdAt: windowRange }, select: { authorId, createdAt } })` (atau agregasi per bulan di aplikasi dari kolom `authorId, createdAt` yang ringan).
   - `ledger`: `db.ticketHistory.findMany({ where: { actorId: { in: ids }, createdAt: windowRange, awardedScore: { not: null } }, select: { actorId, awardedScore, createdAt } })`.
   - `dailyReports`: opsional ringkas (`select: { userId, reportDate, state, submittedAt }`, untuk menghitung `submittedReportDays` per bulan).
2. Di memori (JavaScript), kelompokkan setiap record ke bucket `monthKey` menggunakan konversi WIB (`Asia/Jakarta` offset `+07:00` atau [`jakartaMonthKey`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/monthPeriod.js#L8)) sehingga **satu batch query melayani sekaligus bulan aktif, bulan pembanding, dan seluruh tren 3–6 bulan** tanpa loop N+1!
3. Hitung metrik operasional per `(userId, monthKey)` menggunakan rumus identik dengan [`performanceMetrics.js`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/performanceMetrics.js#L1-L32) (median via `Math.ceil(len * 0.5) - 1`, durasi non-negatif, `slaCleanPct` dari `slaBreaches === 0`, `onTimePct` dari `resolvedAt <= resolutionDueAt`).

### B. Kontrak `GET /api/reports/kinerja/overview`
Query params baru (opsional, backwards-compatible):
- `month` (`YYYY-MM`, default bulan WIB sekarang)
- `compareMonth` (`YYYY-MM`, default `previousMonthKey(month)`)
- `trendMonths` (`3` atau `6`, default `6`, di-clamp aman ke `3..6`)
- `departmentId`, `company` (filter existing)

Perubahan struktur JSON respons:
- **Top-level**:
  - `month`, `compareMonth`, `previousMonth` (pertahankan `previousMonth` untuk kompatibilitas), `trendMonths: string[]` (array `YYYY-MM` terurut kronologis).
  - `teamSummary`: ringkasan tim sesuai filter aktif untuk 4 KPI utama (current, previous, delta, percentDelta, polarity) — mis. total tiket selesai, total poin, median respons tim, % SLA tim.
  - `highlights`: `{ topImprovers: [...], needsAttention: [...] }`.
  - `trendSeries`: rata-rata / total tim per bulan di `trendMonths` (untuk grafik ringkas tim).
- **Setiap item di `rows`**:
  - Mempertahankan field lama (`userId`, `name`, `departmentId`, `department`, `company`, `total`, `status`, `reviewState`, `reasons`, `resolved`, `responses`, `points`, `score`, `rank`).
  - **Field operasional baru (bulan terpilih)**:
    - `medianResponseMinutes`, `responseSampleCount`, `onTimePct`, `onTimeDueCount`, `slaCleanPct`, `submittedReports`.
  - **Field perbandingan (`compareMonth`)**:
    - `previous`: `{ resolved, responses, points, score, rank, medianResponseMinutes, onTimePct, slaCleanPct }`
    - `deltas`: `{ resolved: DeltaObj, points: DeltaObj, responses: DeltaObj, score: DeltaObj, medianResponseMinutes: DeltaObj, slaCleanPct: DeltaObj, onTimePct: DeltaObj }`
    - `trendDirection`: `'up' | 'down' | 'flat' | 'new' | 'inactive'`
  - **Field tren 3–6 bulan (`trend`)**:
    - Array sepanjang `trendMonths`: `[{ month, resolved, points, responses, medianResponseMinutes, slaCleanPct, score }]`.

**Catatan Invarian Scope & Filter**:
- Filter `rows` (termasuk `teamSummary`, `highlights`, `trendSeries`) tetap hanya mencakup `selected = a.users.filter(u => canReadReport(a.scope, u.id))`.
- Jika `actor` adalah Staff (`!canViewTeam`), `selected` hanya berisi dirinya sendiri (`[self]`), `highlights` dikosongkan / tidak membocorkan rekan mana pun, dan `trend` hanya berisi data dirinya.
- **Penting tentang cohort comparison**: Jika `departmentId` / `company` di-filter pada UI, `scoreActivity` dihitung sebelum atau per `(departmentId, company)` secara konsisten (sebagaimana perilaku existing) sehingga peringkat cohort tidak berubah hanya karena filter tampilan.

### C. Kontrak `GET /api/reports/kinerja/me` dan `GET /api/reports/kinerja/users/[userId]`
Kedua endpoint memanggil [`loadPersonalKinerja`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/kinerjaServer.js#L36) (dan `ranking` mengambil properti `.ranking` darinya).
- Query params baru opsional: `compareMonth` (default `previousMonthKey(month)`), `trendMonths` (default `6`, clamp `3..6`).
- Field tambahan pada respons `loadPersonalKinerja`:
  - `compareMonth`: bulan pembanding.
  - `kpiHeadline`: 4 KPI operasional utama (`resolved`, `points`, `medianResponseMinutes`, `slaCleanPct`) lengkap dengan nilai `current`, `previous`, dan `delta`.
  - `comparison`: peta delta untuk setiap `metric.key` utama dari `calculatePerformanceMetrics` (mis. `first_response`, `accountable_time`, `tickets_resolved`, `ticket_ontime`, `ticket_no_breach`, `submitted_reports`, `data_contribution`).
  - `trend`: array 3–6 bulan terakhir `{ month, resolved, points, responses, medianResponseMinutes, slaCleanPct, score, rank }` untuk user tersebut.
- **Penjagaan Keamanan**: `canReadReport(scope, userId)` dan `canReadPerformanceDetails(actor, userId, own.assignmentStable)` tetap dieksekusi **sebelum** query `collectPerformanceEvidence` maupun query tren multi-bulan dijalankan (mencegah kebocoran data lintas-penempatan atau IDOR lewat parameter `trendMonths`).

---

## 5. Arsitektur UI `/reports` yang Disederhanakan & Mudah Dibaca

Seluruh UI mengikuti token tema di [`app/ui-tokens.css`](file:///home/antigravity/hendrax5/noc-manager2/app/ui-tokens.css) (`--ui-*`) agar mendukung Light/Dark mode, kontras WCAG 2.1 AA, target sentuh minimal `44px`, dan bebas overflow pada viewport `320px`.

### A. Perubahan Entry Point (`app/reports/page.js`)
- Hitung `hasTeamAccess` di server menggunakan [`loadReportScope`](file:///home/antigravity/hendrax5/noc-manager2/lib/reports/reportScopeServer.js#L2) (`scope.all || scope.userIds.some(id => id !== Number(session.user.id))`).
- Tentukan `defaultTab = hasTeamAccess ? 'team' : 'self'`.
- `initialTab`: baca `?tab=team|self|activity` (dengan dukungan kompatibilitas `?legacy=1` → `'activity'`); jika tidak ada, gunakan `defaultTab`.
- Dengan ini, Manager/Admin langsung masuk ke **Performa Tim** sejak render pertama, sedangkan Staff tetap langsung ke **Kinerja Saya**.

### B. Tata Letak 4 Lapisan pada Tab **Performa Tim**
Menggantikan tampilan daftar panjang yang bercampur panel setup besar:

1. **Toolbar Kontrol & Pembanding Periode (Atas)**  
   - **Bulan Utama** (`<input type="month">`, default bulan WIB berjalan) + **Bandingkan dengan** (select: `Bulan sebelumnya` sebagai default, atau 1–5 bulan sebelumnya) + **Jendela Tren** (`3 bulan` / `6 bulan`).  
   - Filter **Departemen**, **Perusahaan**, **Cari nama anggota**, dan **Filter cepat arah performa** (`Semua`, `Naik`, `Turun`, `Perlu Perhatian`).  
   - Tombol sekunder `"Aktualkan data"` dan tautan `"Isi laporan harian"`.

2. **Ringkasan Eksekutif Tim & Status Evaluasi Kompak**  
   - **Banner Status Evaluasi Formal (1 baris, collapsible)**:  
     - Jika `readiness.ready === 0`, tampilkan satu baris info kompak dengan link ekspansi `<details>`:  
       *"Mode Simulasi Operasional — Nilai evaluasi formal belum aktif (0/N penempatan penuh). [Lihat detail kesiapan & kalibrasi]"*  
     - Saat `<details>` dibuka, barulah 4 hitungan `readiness` dan tautan `/settings/evaluation` serta `/reports/evaluations` tampil. Layar tidak lagi tertutup kotak 4 kolom besar sejak awal.
   - **4 Kartu KPI Tim (Sesuai Filter Aktif)**:  
     1. *Tiket Selesai* (total + rata-rata/anggota + badge Δ MoM)  
     2. *Poin Kontribusi* (total + rata-rata/anggota + badge Δ MoM)  
     3. *Median Respons Pertama* (median menit + badge Δ lebih cepat/lambat)  
     4. *Kepatuhan SLA* (% bersih + badge Δ dalam `pp`)
   - **Strip Sorotan Tim (2 kartu sejajar di desktop, bertumpuk di mobile)**:  
     - **Paling Meningkat** (badge `--ui-success-bg` / `--ui-success`): maksimal 3 anggota terbaik beserta alasan delta singkat + tombol klik langsung ke detail anggota.  
     - **Perlu Perhatian** (badge `--ui-warning-bg` / `--ui-warning` atau `--ui-danger-bg` / `--ui-danger`): maksimal 3 anggota dengan penurunan tajam atau SLA/respons bermasalah beserta alasan spesifik + tombol lihat rincian.

3. **Tabel Performa Anggota (Utama, Mudah Dipindai)**  
   - Urutan default yang dapat di-sort lewat tombol header ber-`aria-sort`: **Arah Tren**, **Poin**, **Tiket Selesai**, **Median Respons**, **SLA %**, atau **Skor Cohort**.  
   - Kolom dirancang ringkas tanpa membuat scroll horisontal berlebihan di desktop:
     1. **Anggota & Tim** (`Nama` + subteks `Departemen · Perusahaan`, tidak lagi duplikasi kolom berlebih)
     2. **Arah** (badge teks + simbol jelas: `▲ Naik`, `▼ Turun`, `● Stabil`, `★ Baru`, memakai kombinasi teks + ikon agar tidak bergantung warna semata)
     3. **Tiket Selesai** (angka utama + baris kecil `vs bln lalu: +5 (+25%)`)
     4. **Poin** (angka utama + baris kecil `+32 (+18%)`)
     5. **Median Respons** (angka `18 mnt` + baris kecil `-6 mnt (lebih cepat)`)
     6. **Tepat SLA** (`94%` + baris kecil `+3 pp`)
     7. **Tren 6 Bln** (inline **SVG Sparkline** murni CSS/SVG tanpa library berat; menampilkan titik 3–6 bulan terakhir dengan `aria-label` deskriptif dan tooltip `<title>` nilai per bulan)
     8. **Nilai** *(hanya bila `readiness.ready > 0`)* atau **Skor Cohort** (konteks sekunder + peringkat `#2`)
     9. **Aksi** (`Lihat rincian` → membuka tab detail anggota tersebut dengan tetap menjaga filter & bulan aktif).
   - Pada viewport sempit (`< 720px`), selain region tabel berfokus keyboard (`.tableWrap`), pertimbangkan tampilan kartu per anggota yang ringkas atau layout responsif agar informasi inti tetap terbaca pada `320px` tanpa kepotong.

4. **Ringkasan Perbandingan Antar-Departemen (Collapsible / Bagian Bawah)**  
   - Tabel perbandingan antar departemen/perusahaan tetap dipertahankan di bawah tabel anggota (diperkaya kolom Δ Tiket Selesai & Δ Median Respons selain Δ Skor dan Δ Poin/anggota), plus kontrol `PublishCohort` untuk Admin/pemilik `lock_evaluations` saat mode `official`.

### C. Tata Letak Tab **Kinerja Saya / Detail Anggota**
Saat user memilih anggota dari tabel tim (tampilkan tombol jelas `← Kembali ke Performa Tim` agar tidak bingung posisi navigasi) atau saat Staff melihat kinerjanya sendiri:

1. **Header Profil & 4 Kartu KPI + Delta MoM**:  
   - Perbaiki bug mojibake `Â·` menjadi pemisah tengah standar `·`.  
   - Ganti `<dl>` 3-item lama dengan **4 Kartu KPI Operasional + Delta MoM** (*Tiket Selesai*, *Poin*, *Median Respons Pertama*, *Kepatuhan SLA*) plus **Kartu Konteks Cohort/Evaluasi** (Peringkat departemen, Skor cohort, dan Nilai Evaluasi Formal bila tersedia).
2. **Panel Grafik Tren 3–6 Bulan**:  
   - Grafik tren ringan (inline responsive SVG line/bar chart bertoken `--ui-accent` & `--ui-line`) yang memungkinkan toggle metrik yang digrafikkan (`Tiket Selesai`, `Poin`, `Median Respons`, `SLA %`), lengkap dengan tabel mini aksesibel di bawah/sampingnya untuk pembaca layar dan pembacaan angka persis.
3. **18+ Metrik Rincian Dikelompokkan Menjadi 4 Pilar Terstruktur**:  
   Alih-alih 1 tabel panjang 18 baris sekaligus, kelompokkan `detail.metrics` ke 4 kelompok logis (tab/accordion atau sub-bagian rapi):
   - **Pilar 1 — Kecepatan & Ketepatan SLA**: `first_response`, `accountable_time`, `resolution_total`, `followup`, `ticket_ontime`, `ticket_no_breach`.
   - **Pilar 2 — Output & Penyelesaian Pekerjaan**: `tickets_resolved`, `completed_phases`, `phase_elapsed`, `rfs`, `bod_restoration`, `internal_responses`.
   - **Pilar 3 — Disiplin Laporan & Kontribusi Data**: `submitted_reports`, `report_ontime`, `data_contribution`, `data_pending`.
   - **Pilar 4 — Penilaian & Bukti Review**: `quality`, `timeliness`, `report_content`, `rework`, plus blok `Analisis bulanan` dan form `DataReview`.
   - Setiap baris metrik kini juga menampilkan kolom **`vs Bulan Lalu`** jika metrik perbandingan tersedia pada `detail.comparison`.
4. **Tiket yang Dikerjakan & Tab Aktivitas & Poin**:  
   - Tetap dipertahankan di bawahnya dengan struktur aksesibel existing (`scope="col"`, tautan `/tickets/[id]`, dan badge peran `PIC`/`Respons`).

### D. Token UI, Aksesibilitas & Kebersihan CSS
- Semua gaya baru di [`app/reports/kinerja.module.css`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/kinerja.module.css) wajib merujuk token `--ui-*` dari [`app/ui-tokens.css`](file:///home/antigravity/hendrax5/noc-manager2/app/ui-tokens.css):
  - Naik / Membaik: `--ui-success` di atas `--ui-success-bg`
  - Turun / Melambat: `--ui-danger` di atas `--ui-danger-bg`
  - Perhatian / Peringatan: `--ui-warning` di atas `--ui-warning-bg`
  - Netral / Stabil: `--ui-muted` di atas `--ui-subtle`
- Tidak menambah animasi dekoratif, gradien, glow, atau class `.ui-static-*`.
- Sekalian bersihkan class `.ui-static-46dc7cdb01` di [`app/reports/page.js`](file:///home/antigravity/hendrax5/noc-manager2/app/reports/page.js#L43) pada jalur fallback legacy agar konsisten dengan kontrak style UI repo.

---

## 6. Tahapan Implementasi yang Direkomendasikan

| Fase | Fokus Perubahan | File Utama Terdampak |
|---|---|---|
| **Fase 1: Pure Helpers Perbandingan & Tren** | Buat `lib/reports/performanceComparison.js` (`buildRollingMonthKeys`, `computeMetricDelta`, `classifyMemberTrend`, `selectTeamHighlights`) + unit test lengkap untuk edge case (`0` bulan lalu, metrik durasi terbalik, ambang volume minimum, skor cohort vs volume). | `lib/reports/performanceComparison.js`, `lib/reports/performanceComparison.test.mjs` |
| **Fase 2: Batch Query & Kontrak API** | Perluas `activityScore.js` (atau helper batch di `lib/reports/`) untuk mengambil metrik operasional & tren 3–6 bulan dalam query window terbatasi. Perbarui `GET /api/reports/kinerja/overview` dan `loadPersonalKinerja` (`me`, `users/[userId]`, `ranking`) sambil mempertahankan seluruh guard scope & IDOR. | `lib/reports/activityScore.js`, `lib/reports/kinerjaServer.js`, `app/api/reports/kinerja/overview/route.js`, unit & contract tests |
| **Fase 3: Refactor UI `/reports`** | Role-aware `initialTab` di `app/reports/page.js`; perbarui `KinerjaClient.js` & `kinerja.module.css` (Toolbar pembanding, Banner kesiapan kompak, 4 Kartu KPI + Strip Sorotan Tim, Tabel dengan delta MoM & Sparkline SVG, Detail anggota ber-4 pilar & grafik tren 3–6 bulan, perbaikan `Â·`). Pertimbangkan pemecahan sub-komponen bersih (`TeamPerformanceView.js`, `MemberDetailView.js`, `TrendSparkline.js`) agar file tetap modular. | `app/reports/page.js`, `app/reports/KinerjaClient.js`, komponen pendukung di `app/reports/`, `app/reports/kinerja.module.css` |
| **Fase 4: Verifikasi & Smoke Test** | Jalankan seluruh suite test `lib/reports/*.test.mjs`, cek kontrak style UI, lint, dan uji rendering fixture 320px/768px/1440px di Light & Dark mode serta verifikasi WCAG 2.1 AA. | `lib/reports/*.test.mjs`, `scripts/test_*.cjs` |

---

## 7. Rencana Verifikasi

1. **Unit Tests (Node Test Runner — tanpa perlu DB live)**:
   - `node --test lib/reports/*.test.mjs`
   - Skenario wajib untuk modul baru `performanceComparison.test.mjs`:
     - Delta KPI volume (`resolved`, `points`): kenaikan, penurunan, basis `0` (`isNewActivity`), perubahan kecil masuk zona `'flat'`.
     - Delta metrik durasi (`medianResponseMinutes`): waktu turun berarti `'improved'`, waktu naik berarti `'declined'`.
     - Delta SLA (`slaCleanPct`, `onTimePct`): selisih dalam `pp`, kasus `null` saat tidak ada tiket bertenggat.
     - `selectTeamHighlights`: tidak memilih user dengan 1 tiket menjadi `"Paling Meningkat"`, alasan terisi akurat dalam bahasa Indonesia.
     - `buildRollingMonthKeys`: pergantian tahun (mis. `2026-02` mundur 6 bulan menjadi `2025-09`..`2026-02`).
     - Regresi existing (`reportScope.test.mjs`, `performanceMetrics.test.mjs`, `activityScore.test.mjs`, `monthlyEvaluation.test.mjs`).
2. **Security, Scope & API Contract Verification**:
   - Staff tetap hanya mendapat data dirinya di `overview` (`canViewTeam === false`, `highlights` kosong), `403` saat akses `users/[peerId]`.
   - Manager hanya melihat anggota dalam grant aktifnya untuk bulan tersebut dan ditolak `403` saat `assignmentStable === false` untuk detail rekan lintas-penempatan.
   - Mode `official` tetap mempertahankan snapshot publikasi terkunci dan tidak menimpa metrik resmi dengan draft/simulasi.
3. **UI, Aksesibilitas & Token Contract**:
   - Verifikasi visual & keyboard (Light + Dark mode, `320px` / `768px` / `1440px`, 0 horizontal overflow, focus ring terlihat, target sentuh `>= 44px`, SVG sparkline memiliki label teks alternatif untuk screen reader).
   - `node scripts/test_ui_style_contract.cjs` & `npm run lint` (pada environment dengan `node_modules`).

---

## 8. Hal di Luar Cakupan (Disengaja)

- **Ekspor Excel/PDF otomatis dari halaman `/reports` Kinerja**: belum ditambahkan pada gelombang ini; fokus pada keterbacaan & perbandingan langsung di UI.
- **Pengubahan rumus bobot evaluasi formal (`EvaluationPolicyVersion`)**: rumus evaluasi formal dan publikasi resmi tetap mengikuti kebijakan yang sudah ada di `/settings/evaluation` dan `/reports/evaluations`.
- **Perhitungan jam kerja aktif berbasis *timesheet* / absensi**: durasi yang diukur tetap waktu kalender respons/penanganan sesuai aturan transparansi pada [`2026-10-24-kinerja-release.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/service-work/2026-10-24-kinerja-release.md).
