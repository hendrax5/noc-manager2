# P1 — Form dan workflow pekerjaan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Form per jenis pekerjaan, routing aman dan fase/kategori otomatis.
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

### Task 1: Master workflow berversi
**Files:** Modify prisma/schema.prisma; create lib/workflows/policy.js, policy.test.mjs; create docs/workflows/field-matrix.md
**Interfaces:** resolveWorkflow({workType,operation,originCompanyId,executorCompanyId,departmentId,roleId,at}) -> {policyVersionId,phases:[{key,label,jobCategoryId}]} | null.

- [ ] Tulis failing test dengan assertions: Override company tepat mengalahkan default; match ambigu ditolak; missing policy Perlu konfigurasi; kategori nonaktif tidak digunakan baru; custom type memakai operation.
- [ ] Jalankan node --test lib/workflows/policy.test.mjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Audit sumber routing, custom fields phase-like, assignment dan permission existing. Tambah WorkflowPolicyVersion, WorkflowPhaseDefinition, TicketPhaseExecution dengan versi/urutan/pelaksana/waktu. Gunakan ID routing master existing; jangan membuat company duplikat atau backfill fase lama otomatis.
- [ ] Jalankan kembali node --test lib/workflows/policy.test.mjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: version workflow policies.

### Task 2: Form berbeda per pekerjaan
**Files:** Modify components/TicketWorkClassification.js, ServiceWorkFields.js, app/tickets/new/TicketForm.js; create components/tickets/WorkPhasePanel.js, lib/workflows/transition.js, transition.test.mjs; extend scripts/test_service_work_ui.cjs dan test_ticket_classification_ui.cjs
**Interfaces:** validatePhaseTransition({currentPhase,nextPhase,actor,policy}) -> {allowed,reason}. Field matrix mendefinisikan create/edit/API.

- [ ] Tulis failing test dengan assertions: Semua operasi tampil field tepat; legacy tetap tersimpan; upgrade produk tetap; type tambahan master tampil; fase bukan status; override kategori harus izin+alasan.
- [ ] Jalankan node --test lib/workflows/transition.test.mjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Pertahankan selector langsung yang sudah deploy436515c. Pisah section pekerjaan, reuse validasi domain server. Fase aktif menyarankan kategori/assignment tanpa overwrite manual setiap render. Jalankan dua suite UI existing setelah unit.
- [ ] Jalankan kembali node --test lib/workflows/transition.test.mjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: work specific forms and phase controls.

### Task 3: Assignment dan Resolve atomik
**Files:** Modify app/api/tickets/route.js dan handler detail/comment/resolve existing hasil audit; create lib/workflows/ticketWorkflow.js, ticketWorkflow.test.mjs
**Interfaces:** initializeTicketWorkflow(tx,{ticketId,policyVersionId,actorId}); completeTicketPhase(tx,{executionId,actorId,idempotencyKey}); resolve memakai service existing.

- [ ] Tulis failing test dengan assertions: Assignment tanpa poin; replay Resolve tidak double apply; gagal Inventory rollback fase; stale bandwidth concurrent ditolak; order baru tidak menyalin routing diam-diam; reopen koreksi tidak double apply.
- [ ] Jalankan node --test lib/workflows/ticketWorkflow.test.mjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Sambungkan lifecycle existing, jangan buat Resolve kedua. Simpan policy/routing snapshot, before/after, revision dan actor. Transaksi dan unique idempotency menjamin satu penerapan; mapping tuple origin/executor eksplisit.
- [ ] Jalankan kembali node --test lib/workflows/ticketWorkflow.test.mjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: apply ticket workflow atomically.

### Task 4: Pengaturan dan QA workflow
**Files:** Create app/settings/workflows/page.js, WorkflowPolicyClient.js, app/api/workflows/route.js, scripts/test_workflow_ui.cjs; modify components/Navbar.js
**Interfaces:** GET/POST /api/workflows; draft editable, published immutable; permission manage_workflows.

- [ ] Tulis failing test dengan assertions: Admin preview/publish; operator403; kategori aktif; urutan lengkap; keyboard/mobile320 dan axe area baru; tiap operasi create/edit/resolve.
- [ ] Jalankan node scripts/test_workflow_ui.cjs; pastikan gagal pada perilaku baru sebelum implementasi.
- [ ] Implementasikan Buat tabel master ringkas, default dan override company; validasi ambiguity server. Uji EWO/routing existing dan audit tanpa mengubah importer.
- [ ] Jalankan kembali node scripts/test_workflow_ui.cjs; expected seluruh assertion PASS. Jalankan npm run lint untuk perubahan aplikasi.
- [ ] Review akses/error/kontrak dan commit terpisah: feat: manage workflow policies.

