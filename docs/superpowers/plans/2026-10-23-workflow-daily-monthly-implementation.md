# Workflow, Daily Report dan evaluasi bulanan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Menghubungkan pekerjaan, kontribusi personal, laporan dan evaluasi seluruh departemen yang eligible.
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

## Baseline dan status
Rencana saja; tidak ada perubahan aplikasi/database/deployment dari penyusunan ini.
Source sekarang: DailyReport hanya content/user/createdAt; JobCategory punya score, belum master fase; Reports membagi CS/non-CS dan total poin departemen; Manager/view_reports punya akses luas. Selector langsung sudah deploy436515c, tidak dikerjakan ulang.

## Urutan dan deliverable
1. [P1 Form dan workflow](2026-10-23-p1-ticket-workflows.md): 4 task, form operasi dan fase/kategori/routing.
2. [P2 Daily Report](2026-10-23-p2-personal-daily-reports.md): 3 task, scope/container/submission/UI.
3. [P3 Evaluasi bulanan](2026-10-23-p3-monthly-evaluation.md): 4 task, policy/evidence/score/review/Reports.
4. [P4 Rollout](2026-10-23-p4-workflow-reporting-rollout.md): 2 task. Audit/flags P4.1 disiapkan sebelum aktivasi P1.
Total13 task. Bagian dapat dirilis terpisah; P2 memakai fase P1, P3 memakai scope/evidence P1-P2.
Native execution disarankan karena kontrak routing/fase/evidence saling terkait. Review akhir memeriksa akses dan scoring.

## Matriks penerimaan
| Kebutuhan | Task |
|---|---|
| Form semua operasi, CID, produk tetap/ganti dan legacy | P1.2–P1.3 |
| Multi-company/EWO dan fase/category otomatis | P1.1–P1.4 |
| Monthly personal ticket dan daily reply terstruktur | P2.1–P2.3 |
| Personal/Manager/pimpinan scope | P2.1,P3.3–P3.4 |
| Tanpa poin ganda dan assignment tanpa poin | P1.3,P2.2,P3.2 |
| Pengecualian Administrasi, General, Admin-Teknis | P3.1–P3.4 |
| Fair target/peran/jadwal/evidence/Jakarta | P3.1–P3.2 |
| Review,lock dan UI ringkas | P3.3–P3.4 |
| Legacy,migrasi,pilot,rollback | P4.1–P4.2 |

## Sebelum official
Tidak menghalangi pembangunan engine/draft/simulasi:
- Petakan Manager/pimpinan ke scope user/tim/company yang sah.
- Validasi target,rubric kualitas,kompleksitas,waktu internal,hari wajib per departemen/peran. Tanpa konfigurasi tidak dinilai.
- Bobot40/30/20/10 masih usulan simulasi, bukan kebijakan final.
- Jangan mengarang absensi/cuti; coverage kurang terlihat eksplisit.
- Perpindahan role/departemen/company memakai periode efektif dan snapshot.

## Verifikasi
Unit/browser tiap task, npm run lint, Linux production build dan authenticated read-only smoke. Pengujian menulis memakai fixture lokal/DB isolated; production tanpa tiket uji. Counts customer/service/CID/company/BFI sebelum-sesudah; tiket dapat bertambah karena pengguna nyata. HTTP200 saja tidak membuktikan akses/score benar.

## Self-review
Semua kebutuhan spec ada pada matriks. Lima risiko Review Focus memiliki pemilik tes: replay P1.3/P2.2; scope P2.1/P3.4; legacy P1.2/P2.2/P4.1; snapshot P3.1/P3.3; waktu/target P3.2. Eksekusi menulis hasil/commit/blocker pada ledger baru tanpa mengedit rencana.
