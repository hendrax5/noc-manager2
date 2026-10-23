# P4 — Migrasi, pilot dan rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Rilis bertahap dengan data lama aman dan penilaian resmi setelah validasi.
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

### Task 1: Audit/flag/migrasi
**Files:** Create scripts/audit_workflow_reports.cjs, migrate_monthly_report_links.cjs, test_workflow_reports_migration.cjs; additive schema migration dan konfigurasi flags existing
**Interfaces:** Flags work_phase_enabled, structured_daily_enabled, monthly_evaluation_mode=off/simulation/official; audit counts/conflicts tanpa credential atau isi sensitif.

- [ ] Tulis failing test dengan assertions: Dry-run tanpa write; rerun idempoten; arsip ambigu tidak digabung; flag off mengembalikan perilaku lama; customer/service/CID/company counts stabil.
- [ ] Jalankan node scripts/test_workflow_reports_migration.cjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Audit pattern tiket bulanan,user,period,permissions,legacy ledger duplicate,roster dan coverage. Link arsip hanya mapping terkonfirmasi; jangan score hasil parsing reply bebas. Gunakan migration deploy tervalidasi, bukan db push destruktif.
- [ ] Jalankan kembali node scripts/test_workflow_reports_migration.cjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: chore: audit workflow reporting migration.

### Task 2: Pilot dan rilis
**Files:** Create docs/runbooks/workflow-reporting-release.md, scripts/verify_workflow_reporting.cjs, docs/workflows/pilot-results-template.md
**Interfaces:** Release ledger mencatat commit,image,backup,schema,flag,counts,health,rollback.

- [ ] Tulis failing test dengan assertions: Restore backup diuji isolated; negative access; replay; FK dan protected counts; domain/login200; authenticated assets/tickets/reports200; excluded denominator0; image sebelumnya tersedia.
- [ ] Jalankan node scripts/verify_workflow_reporting.cjs --read-only; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Audit/flags lebih dulu, lalu P1,P2,P3 simulation. Pilot bulan tersedia + periode berjalan; review target/shift/cuti/bias/company oleh Manager. Official hanya sesudah persetujuan kebijakan. Backup pg_dump terverifikasi sebelum migrasi; image immutable; rollback image+flag otomatis jika smoke gagal. Skema additive tetap saat rollback; restore DB hanya jika korupsi terverifikasi dan approval karena ada transaksi baru. Credential lokal tidak dicetak.
- [ ] Jalankan kembali node scripts/verify_workflow_reporting.cjs --read-only; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: docs: pilot and rollback rollout.

