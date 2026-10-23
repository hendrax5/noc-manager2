# Rilis workflow, Daily Report dan evaluasi
## Urutan
1. npm run lint; unit dan fixture UI; build Linux image immutable.
2. Audit read-only master, counts, arsip dan scope. Semua credentials hanya lokal/root-only.
3. Jalankan integration test pada PostgreSQL terpisah, tidak memakai database produksi; uji concurrent submission, phase, rollback transaksi dan Foreign Key.
4. Backup produksi pg_dump -Fc, verifikasi pg_restore -l, lakukan restore pada database terpisah dan cocokkan protected counts.
5. Jalankan scripts/apply_workflow_reporting_migration.cjs tanpa argumen untuk dry-run. Setelah backup, --apply menjalankan SQL additive transaction satu kali, semua flags OFF.
6. Deploy image baru dengan compose release override --no-deps --no-build. Jangan menjalankan startup db push. Smoke authenticated dan anonymous harus lolos.
7. Aktifkan flags work_phase_enabled/structured_daily_enabled dan monthly_evaluation_mode=simulation hanya setelah gates lolos. Official tidak diaktifkan oleh rilis ini.
8. Admin memetakan kategori fase, company, pegawai, scope Manager dan aturan KPI. Identitas company harus dari routing existing, tidak ditebak dari prefix customer/CID.
9. Pilot satu periode berjalan berdampingan poin lama. Aktivasi official setelah review hasil dan persetujuan kebijakan.

## Restore / rollback
Simpan image sebelumnya dan compose override/rollback.sh executable sebelum deploy. Jika smoke gagal, kembalikan flags sebelumnya dan image lama. Skema additive tetap. Backup restore hanya setelah korupsi terbukti dan approval karena transaksi baru dapat hilang.
Periksa protected counts customer/service/identifier/BFI/company sebelum-sesudah, container image/restart, local/domain HTTP. Tiket dapat bertambah karena aktivitas nyata; bukan alasan restore database.

## Konfigurasi
Global feature flags disimpan di AppSetting workflow_reporting_flags.
Scope integrasi laporan baru: AppSetting report_integration_scope:<integrationAppId>, value JSON userIds. Tanpa grant eksplisit, akses laporan integrasi403 setelah structured daily aktif. Penetapan scope harus direview.
Scope Manager dan penempatan pegawai di /settings/evaluation. Dept exclusions stable IDs; rename tidak mengaktifkan kembali.
Arsip bulanan lama hanya dilink dari mapping JSON yang dikonfirmasi melalui scripts/migrate_monthly_report_links.cjs --mapping=PATH (default dry-run, --apply untuk apply).
Workflow published tidak diubah; replacement menutup periode versi sebelumnya secara atomik. Override kategori melalui penyelesaian fase membutuhkan izin dan alasan.
## Batas pilot
Bulan dengan perpindahan assignment di tengah periode ditandai belum cukup data. Schedule/cuti harus tervalidasi oleh reviewer selain pegawai. Target/rubric belum ada tidak menghasilkan0. Tidak ada recalculation poin historis/payroll.
