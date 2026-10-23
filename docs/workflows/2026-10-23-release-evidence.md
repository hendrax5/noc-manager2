# Bukti rilis workflow dan laporan —23 Oktober2026
## Produksi
- Aplikasi: commit82dbcfb, image noc-manager2-app:release-82dbcfb.
- Verifier standalone: commitc3e7e7b (startup readiness dan default OFF); disimpan dalam release folder.
- Skema: workflow_reporting_schema_v1, migrasi additive; official evaluation tidak aktif.
- Flags: work_phase_enabled=true, structured_daily_enabled=true, monthly_evaluation_mode=simulation.
- Container running, restarts0; domain login HTTP200.
- Smoke authenticated local/domain: halaman tiket, Assets, workflow/evaluation settings, Daily Report/evaluations dan API PASS; anonymous API401.
- Counts terlindungi: customer620, service853, identifier747, BFI13; companyNames ION/SDC/Sistercompany/Indotel/PRODC tetap.
- Tiket28516→28518 selama operasi berlangsung; tidak diubah oleh smoke read-only.

## Verifikasi
- Unit61/61 dan validator migrasi2/2 PASS.
- Fixture browser: form tiket/service lama, workflow, Daily Report, evaluation dan setting Admin PASS; area baru diuji WCAG dan320px.
- PostgreSQL isolated: concurrent init/complete, kredit tunggal, rollback transaksi, single daily container/reply, review/lock PASS.
- API isolated: archive take/notes/watchers/snooze/reply ditolak, laporan private scoped, phase Resolve ditolak, flagsOFF menjaga guards dan assignment PASS.
- Backup produksi restore isolated dan migrasi rehearsal PASS; rerun migration tidak menulis.
- Review independen: temuan akses/migrasi/concurrency ditutup, regression tests PASS.
- Windows local build terhalang junction Turbopack; Linux production build PASS.

## Rollback
Folder root-only /opt/noc-manager2/releases/82dbcfb berisi predeploy.dump terverifikasi, compose.release.yml, compose.rollback.yml, rollback.sh dan log.
Rollback kompatibel release-058f11b-compat telah diuji real API dan dijalankan saat smoke awal gagal; privacy dan workflow existing tetap terlindungi.
Jangan memakai image436515c mentah setelah data baru dibuat. Rollback mematikan pembuatan fitur baru dan memakai image kompatibel; skema additive tetap.
Tidak ada restore database produksi.

## Konfigurasi sebelum nilai resmi
Admin menetapkan mapping fase/Job Category di /settings/workflows; penempatan pegawai, cakupan Manager, target/rubrik per peran/company di /settings/evaluation.
Aturan belum dikonfigurasi atau bukti kurang menampilkan Belum cukup data, bukan0.
Administrasi ID10, General ID4, Admin-Teknis ID11 dikecualikan dari evaluasi; tetap dapat bekerja/melapor.
Poin lama tidak dihitung ulang. Pilot dan penetapan kebijakan resmi masih diperlukan.
