# P3 — Evaluasi bulanan dan Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Penilaian berbukti dan fair per departemen/peran, dengan pengecualian yang disepakati.
**Architecture:** Next.js/React dengan domain service server dan Prisma transaction. Skema additive, feature flag, serta kontrak legacy dipertahankan.
**Tech Stack:** Next.js, React, Prisma 5, PostgreSQL, node:test, Playwright.
**Spec:** ../specs/2026-10-23-workflow-performance.md

## Global Constraints
Semua kebutuhan spec berlaku. Jangan menebak company, KPI atau poin historis. Periode Asia/Jakarta. Jangan edit plan saat eksekusi; gunakan ledger terpisah. File baru di bawah adalah lokasi yang direncanakan.

## Review Focus
- Replay/concurrent Resolve atau submit harus satu perubahan/kredit.
- Company routing berbeda dari departemen pelaksana tidak membocorkan akses.
- Legacy, kategori nonaktif dan data kosong tetap terbaca tanpa rewrite.
- Perpindahan departemen/aturan tidak mengubah snapshot terkunci.
- Boundary bulan Jakarta dan target belum tersedia tidak memberi skor menyesatkan.

### Task 1: Kelayakan dan kebijakan
**Files:** Modify prisma/schema.prisma; create lib/reports/evaluationPolicy.js, evaluationPolicy.test.mjs, workEvidence.js, workEvidence.test.mjs
**Interfaces:** resolveEvaluationPolicy({departmentId,roleId,companyId,monthKey}) -> version|null; buildWorkEvidence({userId,from,to}) -> {activities,eligibleMinutes,coverage,missingReasons}.

- [ ] Tulis failing test dengan assertions: Administrasi/General/Admin-Teknis keluar numerator/denominator/ranking; rename tidak menghilangkan pengecualian; perpindahan memakai effective snapshot; missing target/jadwal insufficient_data.
- [ ] Jalankan node --test lib/reports/evaluationPolicy.test.mjs lib/reports/workEvidence.test.mjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Tambah EvaluationPolicyVersion, EvaluationDepartmentEligibility, EmployeeAssignmentPeriod, WorkEvidenceReference. Audit roster read-only dan resolve ID tiga pengecualian dari nama sekali, sesudahnya ID stabil. Seed40/30/20/10 sebagai draft simulation. Target/rubric tiap peran belum dikonfigurasi tidak diterbitkan otomatis.
- [ ] Jalankan kembali node --test lib/reports/evaluationPolicy.test.mjs lib/reports/workEvidence.test.mjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: version evaluation policies.

### Task 2: Mesin nilai dan periode
**Files:** Create lib/reports/monthlyEvaluation.js, monthlyEvaluation.test.mjs, monthPeriod.js, monthPeriod.test.mjs; modify lib/reports/leaderboard.js, performance.js
**Interfaces:** evaluateMonthly({policy,evidence}) -> {status,dimensions,total,coverage,explanations}; jakartaMonthRange(monthKey) -> {gte,lt}; status draft/insufficient_data/excluded/ready.

- [ ] Tulis failing test dengan assertions: Target100 hasil80=80; hasil120 capped100 pada template awal; weighted total; no target bukan0; duplicate source tidak double; spam reply tidak naikkan quality;31Jan17UTC masukFeb; besar tim tidak otomatis unggul.
- [ ] Jalankan node --test lib/reports/monthlyEvaluation.test.mjs lib/reports/monthPeriod.test.mjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Completion evidence berdasarkan phase actor/event date, bukan current assignee/updatedAt. Outcome weighted work unit/target prorata; kualitas/timeliness dari rubric dan evidence; waktu tunggu tervalidasi tidak overlap. Reporting hari wajib sah; metric hilang membuat total insufficient_data. Department mean ready dengan coverage; ranking personal peer role saja. Poin lama tetap terpisah.
- [ ] Jalankan kembali node --test lib/reports/monthlyEvaluation.test.mjs lib/reports/monthPeriod.test.mjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: evidence based monthly scoring.

### Task 3: Review dan lock
**Files:** Modify prisma/schema.prisma; create lib/reports/evaluationReview.js, evaluationReview.test.mjs, app/api/reports/evaluations/route.js dan [id]/route.js
**Interfaces:** reviewEvaluation({evaluationId,actorId,expectedRevision,decision,reason}); lockPeriod({monthKey,scope,actorId}).

- [ ] Tulis failing test dengan assertions: Self approve403; out-of-scope403; lock immutable walau category/department berubah; revision conflict409; correction wajib alasan dan preserves old.
- [ ] Jalankan node --test lib/reports/evaluationReview.test.mjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan MonthlyEvaluation unique user+month+revision; evidence snapshot immutable dan policy version; audit review. Pisahkan submit/review/lock permissions; koreksi Manager harus bukti/rubric, bukan angka bebas. Excluded/insufficient tidak ranking.
- [ ] Jalankan kembali node --test lib/reports/evaluationReview.test.mjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: review and lock evaluations.

### Task 4: Reports dan pengaturan ringkas
**Files:** Modify app/reports/page.js, LeaderboardClient.js, [userId]/page.js, API performance/leaderboard dan v1 integration existing; create app/reports/EvaluationTable.js, app/settings/evaluation/page.js, scripts/test_monthly_evaluation_ui.cjs
**Interfaces:** GET /api/reports/evaluations?month&departmentId&companyId memakai reportScope server.

- [ ] Tulis failing test dengan assertions: Staf self; Manager team; pimpinan explicit grants; excluded tetap daily; direct URL/export/v1 sama scope; empty target Belum dikonfigurasi; detail evidence; keyboard/mobile/axe.
- [ ] Jalankan node scripts/test_monthly_evaluation_ui.cjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Satu toolbar dan tabel Nama/Hasil/Kualitas/Waktu/Pelaporan/Nilai/Status; detail expandable bukti/rumus. Pisahkan tab Simulasi evaluasi dan Poin historis. Policy UI draft/preview/tanggal berlaku; tidak mencampur skor dua metode.
- [ ] Jalankan kembali node scripts/test_monthly_evaluation_ui.cjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: monthly performance report views.

