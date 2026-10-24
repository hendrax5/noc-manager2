# Kinerja Terpadu dan Analisis Bulanan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not edit this plan during execution; record completion and evidence in a separate progress ledger.

**Goal:** Menyatukan evaluasi, poin historis, analisis bukti kegiatan, dan peringkat personal dalam satu menu Kinerja dengan tampilan keseluruhan, departemen, dan individu.

**Architecture:** Perluas modul reports yang ada; jangan membuat aplikasi atau ledger poin pengganti. Kumpulkan bukti terstruktur, hitung metrik dengan denominator dan atribusi yang jelas, simpan snapshot evaluasi berversi, kemudian sajikan analisis dan peringkat melalui API yang menerapkan scope perusahaan/departemen. Pencatatan aktivitas baru bersifat additive dan transaksional.

**Tech Stack:** Next.js App Router, React, Prisma/PostgreSQL, node:test, harness UI/Playwright yang sudah tersedia, shared UI tokens.

**Spec:** Bagian “Spesifikasi dan keputusan desain” di dokumen ini merangkum percakapan dan usulan implementasi. Rincian yang ditandai “usulan” belum merupakan keputusan user.

## Spesifikasi dan keputusan desain

### Yang diminta dan sudah disepakati

- Satu menu Kinerja: evaluasi bulanan dan poin historis tidak menjadi dua menu terpisah.
- Keseluruhan → departemen → detail orang, filter bulan dan perusahaan mengikuti navigasi.
- Poin adalah bagian bukti kontribusi, bukan nilai akhir.
- Analisis mencakup respons, penyelesaian pekerjaan, kualitas laporan, kontribusi input/perbaikan data, dan kegiatan aplikasi yang relevan.
- Setiap user melihat nilai dan peringkatnya sendiri dalam satu departemen.
- Tetap mendukung Multi-Company Routing Identities. Jangan menyamakan perusahaan customer, penerima order, pelaksana, dan perusahaan penempatan pegawai.
- Administrasi, General, dan Admin-Teknis tetap dikecualikan dari evaluasi, sesuai konfigurasi eligibility departemen yang ada. Poin/riwayat pribadi tetap dapat dibaca.

### Usulan desain untuk implementasi

- Landing staf adalah “Kinerja saya”; manager/pimpinan berizin mendapat ringkasan sesuai scope, bukan otomatis semua perusahaan.
- Tab dalam menu: Ringkasan, Anggota (berizin), Aktivitas & Poin. Detail orang memuat analisis, metrik, bukti, serta review.
- User biasa menerima nilai sendiri, posisi, jumlah peserta yang memenuhi syarat, cakupan data, periode, dan status. Tidak menerima nama/nilai/bukti rekan melalui payload ranking.
- Ranking resmi hanya untuk periode/cohort yang dipublikasikan utuh setelah review dan penguncian. Simulasi dapat ditampilkan terpisah dengan label jelas, tanpa mencampur snapshot resmi dan simulasi.
- Cohort ranking: bulan + departmentId + perusahaan penempatan pegawai. Ranking lintas sister company hanya tampilan agregat berizin; bukan ranking pribadi default.
- Gunakan competition ranking atas nilai final dua desimal: 90,90,85 → 1,1,3. Identitas bukan pemecah seri. Tampilkan “3 dari 12 peserta yang dinilai; 4 belum cukup data”. Cohort <3 peserta: nilai sendiri tetap ada, peringkat disembunyikan dengan alasan.
- Nilai hanya comparable jika policy cohort menyatakan kebijakan peran sudah dikalibrasi. Bila belum, tampilkan nilai/analisis sendiri dan “Peringkat belum tersedia”; jangan menyusun ranking dari poin mentah atau mengarang target.
- Tidak ada bobot universal baru. Pertahankan evaluasi empat dimensi outcome/quality/timeliness/reporting dan kebijakan berversi yang ada. Metrik respons, data, kolaborasi menjadi bukti/rubrik di dalam dimensi yang relevan, bukan tambahan poin ganda.
- Nilai resmi tetap membutuhkan review manusia. Analisis awal menggunakan template berbasis fakta terukur; tidak membutuhkan LLM, pengiriman isi tiket keluar, atau inferensi sifat/kepribadian pegawai.
- Kelengkapan bukti dan status tiap dimensi tetap terlihat ketika nilai total belum dapat dihitung. Missing data bukan nol. Kualitas isi tidak disimpulkan dari panjang tulisan atau jumlah lampiran.
- Penempatan berubah di tengah bulan: simpan segmentasi konteks dan tampilkan kegiatan per segmen; ranking ditahan sampai kebijakan prorata disetujui. Jangan memasukkan satu orang dua kali dalam ranking bulanan.

### Katalog metrik dan definisi

| Metrik | Definisi/denominator | Syarat penggunaan |
|---|---|---|
| Respons awal pelanggan | Respons public manusia pertama dari petugas setelah permintaan pelanggan; median dan P90 menit, jumlah sampel | Pisahkan internal/otomatis, pencipta tiket, dan jadwal tanggung jawab; firstRespondedAt lama bukan bukti cukup sendirian |
| Pengambilan tanggung jawab | Assignment/acceptance → tindakan relevan pertama oleh orang tersebut | Jangan hitung jam sebelum dialokasikan kepada orang itu |
| Follow-up tepat waktu | Follow-up relevan sebelum dueAt / follow-up yang memang jatuh tempo saat bertugas | Simpan deadline saat event terjadi, bukan konfigurasi terbaru |
| Penyelesaian fase | completedAt − startedAt, total elapsed dan accountable minutes terpisah | startedAt otomatis adalah awal fase, bukan bukti bekerja aktif; jangan menyebut accountable time sebagai jam kerja aktual |
| Ketepatan RFS | Pekerjaan selesai sebelum/saat RFS yang disepakati / pekerjaan dengan RFS valid | Simpan revisi RFS dan alasan; BOD gunakan start/finish/restoration, bukan durasi instalasi |
| Pekerjaan ulang | Pekerjaan dengan rework terverifikasi / pekerjaan selesai yang sudah melewati jendela observasi | Reopen karena EWO baru/upgrade bukan kegagalan; window ditetapkan policy sebelum periode resmi |
| Kualitas laporan | Checklist tindakan, hasil, bukti relevan, kendala/tindak lanjut bila diperlukan; reviewer menilai ketepatan | Tidak semua pekerjaan perlu blocker/lampiran; tidak menilai berdasarkan jumlah karakter |
| Ketepatan daily report | Laporan submitted tepat waktu / tanggal wajib laporan pada jadwal efektif | Deadline policy, WIB, cuti/off dikecualikan; pisahkan presence dari kualitas |
| Kontribusi data | Objek unik diperbaiki + validasi kualitas + kelengkapan sebelum/sesudah | Bukti actor dan perubahan field wajib; simpan nilai sensitif secara terbatas/redacted |
| Kontribusi pekerjaan/poin | Fase/hasil terverifikasi, kompleksitas sesuai policy, ledger poin asli | Satu source hanya dihitung sekali walau muncul dalam tiket dan daily report |
| Kolaborasi/pengetahuan | Bantuan/handover/artikel/tugas rapat dengan hasil terverifikasi | Jumlah komentar, hadir rapat, dan membuat artikel belum membuktikan manfaat |

## Global Constraints

- Semua periode menggunakan Asia/Jakarta dan rentang awal inklusif/akhir eksklusif; simpan timestamp UTC.
- Tidak mengubah poin historis, SLA downtime customer, routing sister company, atau workflow tiket untuk mengejar nilai.
- Tidak menghitung login, klik, pencarian, refresh, no-op save, dan waktu membuka halaman sebagai nilai kinerja.
- Perubahan otomatis/import/bot ditandai source terpisah; pelaksana job otomatis tidak menerima kredit personal otomatis.
- Perubahan data menghasilkan event hanya setelah transaksi berhasil. No-op/rollback/retry tidak menghasilkan kontribusi tambahan.
- Histori tanpa atribusi/interval tidak direkonstruksi sebagai fakta; tampilkan coverage dan tanggal mulai pencatatan.
- Staff tidak dapat menilai/mengunci diri sendiri; pertahankan revision locking dan audit review yang ada.
- Ranking, overview, export, dan deep link menerapkan izin di server. Menyembunyikan UI saja tidak cukup.
- Gunakan CSS/token bersama dari rilis 8feedb5; jangan membuat tema baru.
- Mode awal simulation; publikasi resmi memerlukan policy, target, coverage, kalibrasi, dan review yang valid.

## Review Focus

1. Manipulasi userId/company/department pada ranking tidak boleh membocorkan detail rekan atau sister company (Task 5).
2. Reopen karena pekerjaan baru, perpindahan PIC, dan menunggu vendor tidak menjadi penalti kualitas personal otomatis (Task 3).
3. Retry, import, no-op save, dan bukti ganda tiket/daily report tidak menggandakan kredit (Tasks 2–3).
4. Seri, peserta sedikit, review belum lengkap, dan pergantian departemen tidak menghasilkan ranking menyesatkan (Task 5).
5. Bobot/revisi baru, batas bulan WIB, dan data historis parsial tidak mengubah nilai resmi terkunci secara diam-diam (Tasks 1,4,8).

## Pemetaan file dan tanggung jawab

- Existing: `prisma/schema.prisma`; `lib/reports/{evaluationServer,monthlyEvaluation,workEvidence,evaluationPolicy,evaluationReview,reportScope,reportScopeServer,monthPeriod,performance}.js`; `app/api/reports/evaluations/`; `app/api/settings/evaluation/route.js`.
- New metric modules: `lib/reports/performanceEvidence.js`, `performanceMetrics.js`, `performanceAnalysis.js`, `departmentRanking.js`, `performancePublication.js` (masing-masing memiliki `.test.mjs`).
- New events: `lib/activity/recordActivity.js`, `activityTypes.js`, `recordActivity.test.mjs`; `lib/reports/performancePolicy.js` untuk validasi konfigurasi tambahan.
- New API: `app/api/reports/kinerja/{overview,me,users/[userId],ranking}/route.js` dan `app/api/reports/kinerja/publications/route.js`.
- UI: reuse `app/reports/page.js`, `app/reports/[userId]/page.js`, `app/reports/evaluations/page.js`, `components/Navbar.js`; create `app/reports/KinerjaClient.js`, `app/reports/kinerja.module.css`, `components/reports/{PersonalPerformance,DepartmentPerformance,PerformanceEvidence,PerformanceAnalysis}.js`.
- Regression/integration: `scripts/test_performance_activity_db.cjs`, `test_kinerja_api.cjs`, `test_kinerja_ui.cjs`, `test_kinerja_migration.cjs`.

## Tasks

### Task 1: Additive schema dan kebijakan periode

**Files:** schema, new Prisma migration; `performancePolicy.js/.test.mjs`; settings evaluation route.
**Interfaces:** `validatePerformancePolicy(input) -> {metrics, deadlines, reworkWindowDays, minimumCoverage, calibratedRoles}`; invalid config throws existing WorkflowError. Extend policy with nullable versioned performanceRules JSON; no retroactive default official targets.

- [ ] Write failing policy tests: invalid/negative targets, incomplete calibration, WIB cutoff, existing policy without performanceRules remains readable but not rankable.
- [ ] Run `node --test lib/reports/performancePolicy.test.mjs` and confirm failure before implementation.
- [ ] Add ActivityEvent (actorId nullable, source human/system/import, type, entityType/id, ticketId nullable, occurredAt, idempotencyKey unique, redacted change summary, validation state/reviewer), accountable work intervals, and publication records with immutable member/revision manifest and cohort policy signature. Index actor/time and entity/time. Publication supersedes by new version, never rewrites old manifest.
- [ ] Validate schema and run migration against isolated cloned DB; `node scripts/test_kinerja_migration.cjs` must preserve customer/service/points/routing counts and support old app reads.
- [ ] Run tests PASS and commit only Task 1 files.

### Task 2: Catat kontribusi data dan aktivitas penting

**Files:** new `lib/activity/*`; asset customer/service routes, circuitRegistry, installation/serviceWork helpers, knowledge/action-item mutation handlers discovered before edits.
**Interfaces:** `recordActivity(tx,{actorId,source,type,entityType,entityId,ticketId,occurredAt,idempotencyKey,before,after}) -> event|null`; null for no-op, key retry returns existing event. Never log secrets/full customer contacts.

- [ ] Write failing tests for successful change, transaction rollback, repeated key, no-op, bulk import, multi-field single object edit, and actor impersonation.
- [ ] Run `node --test lib/activity/recordActivity.test.mjs`; verify failure.
- [ ] Implement events inside each successful mutation transaction; derive actor from session/server identity. Track creation/linking/data correction separately; automatic Resolve inventory update links original work evidence and is not extra personal credit.
- [ ] Run unit tests and `node scripts/test_performance_activity_db.cjs`: rollback produces zero events, accepted change exactly one, original routing unchanged. PASS then commit.

### Task 3: Bukti terpadu dan metrik kontekstual

**Files:** `performanceEvidence.js/.test.mjs`, `performanceMetrics.js/.test.mjs`, workEvidence/evaluationServer, comments and assignment handlers, phase/BOD operations.
**Interfaces:** `collectPerformanceEvidence(db,{userId,monthKey,assignmentSegments}) -> EvidenceBundle`; `calculatePerformanceMetrics(bundle,policy) -> [{key,value,numerator,denominator,coverage,status,evidenceRefs}]`. Each reference has source + sourceId + contributionType canonical key.

- [ ] Write failing tests: same phase in daily report counted once; first public staff reply distinct from internal/self/bot; PIC rotation; blocked interval outside shift; RFS revision; new-work reopen vs verified rework; BOD restoration; legacy incomplete logs.
- [ ] Run `node --test lib/reports/performanceEvidence.test.mjs lib/reports/performanceMetrics.test.mjs` and confirm failures.
- [ ] Implement read collectors and event attribution, record reasoned waiting/resume/assignment intervals going forward. Customer downtime remains unchanged; unverified waiting periods stay unknown rather than silently deducted.
- [ ] Return raw elapsed and accountable time separately, sample counts, median/P90 with documented nearest-rank quantile, and denominator for every ratio; missing sample returns null.
- [ ] Run tests PASS; compare a fixed fixture against independently computed expected numbers; commit.

### Task 4: Rubrik, analisis personal, dan snapshot

**Files:** `performanceAnalysis.js/.test.mjs`; evaluationServer/monthlyEvaluation/evaluationReview and settings evaluation API/UI.
**Interfaces:** `buildPerformanceAnalysis({metrics,evidence,policy,previousSnapshot}) -> {strengths,improvements,context,coverage,evidenceRefs}`. Snapshot retains policy version, source cutoffs, inputs, derived metrics, reviewer reasons, final dimensions/total, and analysis.

- [ ] Write failing tests for missing quality review, unknown baseline, factual-only analysis, points not treated as total, contradictory evidence, and edits after lock.
- [ ] Run targeted node:test files to verify failure, then implement rule/template analysis and rubric review. Keep complete/incomplete/not-applicable distinct; explicit prospective policy controls denominator applicability.
- [ ] Add review of report correctness, data validity, and contribution evidence. Manager adjustments require criterion, reason, evidence, previous/new values and identity; no self-review or direct unexplained total override.
- [ ] Verify null total on insufficient evidence with partial dimensions still visible; stale revision returns409; locked values unchanged after policy edit. Run old evaluation tests plus new tests PASS; commit.

### Task 5: Ranking pribadi dan publikasi cohort

**Files:** `departmentRanking.js/.test.mjs`, `performancePublication.js/.test.mjs`; new ranking/me/publications routes; reportScope helpers.
**Interfaces:** `rankDepartment(rows,{monthKey,departmentId,company,mode,publication}) -> ranks`; `getMyDepartmentRank(db,{actor,monthKey}) -> {score,rank,rankedCount,eligibleCount,unratedCount,tied,mode,publicationId,reason}`. Public response contains no peer records. Scope resolver uses historical assignment, not customer company.

- [ ] Write failing tests: scores90/90/85 =>1/1/3; two-person cohort hides rank; excluded and null excluded from rankedCount; staff requests another user/company =>403; manager without grant denied; mixed draft/official revisions cannot publish; changed department/calibration absent => no rank.
- [ ] Run node:test ranking/publication tests, confirm failure.
- [ ] Implement atomic publication manifest after all eligible members are ready/reviewed/locked; deliberate exclusions need recorded reasons, no selective cherry-picking. Aggregate counts reflect whole cohort server-side without exposing peer identity to staff.
- [ ] Publish corrected period as new explicit publication; old ranking reproducible by publicationId. Draft ranking labelled simulation and never presented as official.
- [ ] Run tests and `node scripts/test_kinerja_api.cjs` with staff/manager/admin/company fixtures; expect zero cross-scope leaks. Commit.

### Task 6: Satu menu Kinerja dan detail pribadi

**Files:** mapped reports pages/components/CSS, Navbar; new overview/users routes; existing performance endpoint access alignment.
**Interfaces:** overview returns scoped aggregates and coverage; users route returns authorized detail; me route joins own points, metrics, snapshot, analysis, rank. Filters: month, company, department; staff identity/company are server-derived.

- [ ] Write failing UI/API checks for staff landing “Kinerja saya”, score/rank/sample counts, simulation badge, excluded state, insufficient data, empty month, manager drilldown, and filter persistence.
- [ ] Implement one Navbar entry “Kinerja”; keep daily report entry/function intact. Old evaluations URL and legacy links resolve into same shell/tab without bypassing authorization or breaking old bookmarks. Preserve historical point detail, do not expose legacy all-user leaderboard to staff.
- [ ] Show factual summary first; expandable response/speed/report/data metrics; per-metric evidence and calculations; manager view includes approved cohort table, staff only own detail/rank.
- [ ] Verify `node scripts/test_kinerja_ui.cjs`: keyboard and Escape/focus, loading/error/retry, 320/768/1440 widths, light/dark, axe, no client errors; screenshot and visually inspect against existing shared UI. PASS then commit.

### Task 7: Audit cakupan dan simulasi satu periode

**Files:** create `scripts/audit_performance_coverage.cjs`, fixtures and release evidence document.
**Interfaces:** read-only audit accepts month + scope and outputs aggregate coverage/missing sources; no credentials or raw private message content in exported summary.

- [ ] Test audit against known incomplete fixtures, then run on cloned recent period. Report event coverage, historical assignment gaps, policies, duplicate evidence, unknown blockers, denominator eligibility, rework validity and roster coverage.
- [ ] Reconcile at least one reviewed sample per represented role/company and all identified edge-case classes. Metrics align with underlying tickets and activity logs; record discrepancies before accepting.
- [ ] Calibrate role targets with manager, publish future policy only after approval; simulation is usable even if official scoring remains blocked by missing evidence.
- [ ] Deliver simulation report with actual counts and explicit unavailable metrics; commit audit/test/doc files. Do not fabricate history or silently assign zeros.

### Task 8: Release bertahap, rollback, dan verifikasi operasional

**Files:** workflow flags, migration test, deployment receipt/runbook under `docs/service-work/`.
**Interfaces:** separate feature switches `unified_performance_ui`, `performance_activity_capture`, `performance_ranking_publication`; existing monthly_evaluation_mode stays authoritative for simulation/official behavior. All flags default safe until deployed config enables them.

- [ ] Test old/new app against expanded schema; disable new UI/publication and ensure previous routes stay accessible with existing authorization. Migration is additive, no destructive down migration required for app rollback.
- [ ] Run 118 baseline library tests or current enumerated baseline, new unit/integration suites, production build, scope/API tests, responsive/accessibility UI checks. Report exact actual counts, not a preclaimed total.
- [ ] Back up DB, verify restore listing and image/commit labels; deploy capture + simulation first. Record previous image, override Compose file and executable rollback command. Keep uploads/database volumes intact.
- [ ] Verify deployed HEAD/image/source integrity, app/db health, local/domain HTTP, unauthenticated401, permissioned staff self-view, company scope, point totals unchanged, event idempotency and no notification side effects.
- [ ] Enable publication only after policy/coverage/cohort review acceptance. Rollback switches previous app image and flags, preserves new event history and all original data. Record evidence and remaining limitations.

## Self-review and handoff

- Coverage: unified menu Task6; all three views Task6; metrics Tasks2–4; personal rank Task5; multi-company/access Tasks1/5/6; exclusions Tasks4/5; historical integrity/rollback Tasks7/8.
- Review-focus mapping: scope Task5; contextual speed/reopen Task3; duplicate/import Tasks2/3; rank edge cases Task5; period/revisions Tasks1/4/8.
- Suggested execution order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8, native execution in this session when authorized. No product code changed by writing this plan.
- Decisions to review before official ranking: same department+company cohort, minimum3, competition ties, role calibration, private self-rank payload, publish full reviewed cohort. These are explicit implementation proposals, not prior user commitments.
