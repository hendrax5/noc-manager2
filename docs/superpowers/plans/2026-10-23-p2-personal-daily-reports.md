# P2 — Daily Report personal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Laporan harian terstruktur dalam arsip tiket bulanan dengan akses personal/tim.
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

### Task 1: Container dan akses
**Files:** Modify prisma/schema.prisma, lib/reports/performanceAccess.js; create lib/reports/reportScope.js, reportScope.test.mjs, monthlyContainer.js, monthlyContainer.test.mjs
**Interfaces:** getReportScope(actor,{period,kind}) -> {userIds,departmentIds,companyIds,all:false}; ensureMonthlyContainer(tx,{userId,monthKey}) -> ticket.

- [ ] Tulis failing test dengan assertions: Staf self-only; Manager explicit tim/company; tanpa grant tidak full access; concurrent user+month satu container; excluded departemen tetap melapor.
- [ ] Jalankan node --test lib/reports/reportScope.test.mjs lib/reports/monthlyContainer.test.mjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Tambah ReportAccessGrant efektif, MonthlyReportContainer unique(userId,monthKey), Ticket purpose defaultWork/PersonalMonthlyReport. DailyReport tambahkan date,state,container,submittedAt,revision nullable agar legacy aman. Permission lama view_reports harus diaudit dan dipetakan eksplisit sebelum rollout, bukan diam-diam memperluas/menghilangkan akses.
- [ ] Jalankan kembali node --test lib/reports/reportScope.test.mjs lib/reports/monthlyContainer.test.mjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: scoped monthly report containers.

### Task 2: Submission dan reply tanpa poin ganda
**Files:** Create lib/reports/dailySubmission.js, dailySubmission.test.mjs; modify app/api/reports/route.js, lib/integration/dailyReports.js, app/api/v1/reports/daily/route.js dan [id]/route.js; modify prisma/schema.prisma
**Interfaces:** submitDailyReport(tx,{actorId,reportDate,manualItems,activityRefs,idempotencyKey,revision}) -> {reportId,commentId,state}.

- [ ] Tulis failing test dengan assertions: Double click satu reply; invalid payload tanpa partial write; correction menyimpan revision; legacy DTO kompatibel; IDOR ditolak; ticket reference tidak memberi kredit baru.
- [ ] Jalankan node --test lib/reports/dailySubmission.test.mjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Tambah DailyReportItem source manual/ticket, sourceId, hasil,kendala,category snapshot; unique idempotency dan commentId. Simpan snapshot+reply transaction. Purpose monthly dikecualikan dari SLA/workload Resolve dan award create/reply. Manual work direview tersendiri; reply bulanan bukan tiket kerja baru.
- [ ] Jalankan kembali node --test lib/reports/dailySubmission.test.mjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: structured daily report submissions.

### Task 3: Laporan Saya/Tim
**Files:** Modify app/reports/new/ReportForm.js, app/reports/[userId]/page.js; create app/reports/daily/page.js, DailyReportClient.js, scripts/test_daily_report_ui.cjs; modify scheduler existing
**Interfaces:** GET /api/reports?month&userId selalu scoped; POST content legacy tetap didukung.

- [ ] Tulis failing test dengan assertions: Draft/submit/correction; Jakarta boundary; auto references tidak ganda; mobile/keyboard; manager drilldown scoped; arsip tidak meramaikan default Semua Tiket.
- [ ] Jalankan node scripts/test_daily_report_ui.cjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Lazy-create container saat buka/kirim dengan scheduler idempoten opsional untuk staf aktif. UI tanggal, aktivitas otomatis, pekerjaan manual, hasil/kendala/status. Arsip dapat dibuka/filter eksplisit; jangan parse reply lama menjadi pekerjaan scored.
- [ ] Jalankan kembali node scripts/test_daily_report_ui.cjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: personal and team daily reporting.

