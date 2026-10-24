# Kinerja terpadu: implementasi dan verifikasi

Menu Kinerja menyatukan nilai evaluasi, peringkat pribadi dalam departemen/perusahaan, aktivitas dan poin, serta analisis bukti. Halaman tim mengikuti grant akses. Staf tidak menerima daftar nilai atau identitas rekan dari endpoint peringkat. Tidak mengubah ledger poin atau routing sister company.

## Perilaku

- Simulasi dipisahkan dari hasil resmi. Peringkat resmi memakai manifest publikasi dengan revisi terkunci, bukan draft terbaru.
- Seri menggunakan competition ranking; kelompok kurang dari tiga peserta tidak diberi peringkat. Perubahan penempatan masuk/keluar kelompok di tengah bulan menahan peringkat sampai kebijakan prorata ditetapkan.
- Detail lintas perubahan penempatan ditolak untuk manager sampai scope per interval tersedia; akses diri sendiri/Admin tetap berlaku.
- Bukti mencakup komentar public/internal, fase, ledger, daily report, perubahan Inventory/customer/CID, artikel, dan tugas rapat. Pengukuran RFS/BOD dipisahkan. Jam kalender tidak disebut jam kerja aktif.
- Kualitas laporan dapat direview melalui review evaluasi. Kontribusi data memerlukan validasi beralasan oleh pihak lain; perubahan berulang pada objek yang sama tidak menambah hitungan objek unik.
- Event baru dibuat dalam transaksi. No-op dan retry tidak menggandakan event. Kontak customer dan isi artikel tidak disalin ke audit; perubahan isi artikel dicatat melalui hash.
- Asal komentar baru dibedakan human/integration; histori unknown tetap indikator observasi. Asal tiket integrasi tidak otomatis membuat semua respons petugas dianggap bot.

## Batas data dan kebijakan

Audit salinan produksi Oktober 2026 sebelum fixture QA: 155 user, 0 penempatan valid satu bulan, 0 kebijakan published, 0 fase selesai, 7.562 komentar, 0 revisi laporan terstruktur submitted. Ini membuktikan kesiapan bahan historis, bukan nilai personal.

Karena itu aktivasi awal adalah simulasi. Penempatan perusahaan/peran, target kategori, rubrik, konteks jadwal/cuti, grant manager, dan kalibrasi antarperan harus ditetapkan oleh pihak berwenang sebelum nilai/peringkat resmi dapat diterbitkan. Tidak membuat nilai historis atau identitas perusahaan pegawai dari asumsi.

Follow-up bermakna, rework terverifikasi, dan waktu kerja dalam tanggung jawab masih ditandai belum cukup bukti: histori saat ini tidak memuat seluruh deadline/interval/alasan yang dibutuhkan. Tidak mengganti ukuran itu dengan jumlah klik, login, atau balasan. RFS observasional menggunakan tenggat yang tersimpan, belum arsip setiap perubahan tenggat. Riwayat aktivitas tanpa actor tidak di-backfill sebagai kontribusi personal.

## Bukti uji

- Node library suite: 131 tes, termasuk skor parsial, seri, cohort pindah, batas bulan WIB, policy, serta source dedup.
- UI fixture: tab pribadi/aktivitas/tim, filter departemen/perusahaan, drilldown anggota, submit publikasi, submit review data, refresh, empty/error/retry, keyboard. Enam kombinasi tema/viewport 320/768/1440, axe dan console bersih pada fixture yang diuji.
- QA runtime: nilai dan seri peringkat pribadi, IDOR staf403, manager sesuai grant200, lintas perusahaan403, overview staf hanya diri sendiri, excluded tanpa rank, bulan invalid400, review staf403, anonymous401. Empat render actual 320/1440 light/dark dengan axe; tab aktivitas dan link laporan harian.
- Database clone: additive migration, rollback transaksi, no-op, idempotency. Tidak menyentuh data produksi untuk fixture.
- Server regression: target tanpa izin ditolak sebelum query; overview resmi tetap memakai revisi terbit setelah draft baru.
- Kalibrasi UI: disclosure, enable/disable, validasi required, pilihan peran, empat input kebijakan, submit; axe light/dark dan mobile320 lolos. Overflow pada output JSON fixture diperbaiki pada fixture saja, bukan perubahan CSS produk.
- Shared UI contract: parser dan semantic token contrast; Linux build. Bukti angka final dan commit rilis disimpan dalam receipt server, bukan klaim audit semua kemungkinan state.

## Antislop Delivery Gate

Scope gate: UI Kinerja dan kontrol kalibrasi baru; CSS lama seluruh aplikasi bukan audit ulang menyeluruh. Mode during dipilih user. Arah ION operations, ENERGY1/RHYTHM2/MOTION1. Angka pada screenshot persona QA diberi nama [QA] dan hanya berada pada DB terisolasi.

- R-02 PASS: copy baru tidak memakai em dash; teks histori milik user tidak ditulis ulang.
- R-03 PASS: fixture 320/768/1440 dan actual 320/1440 tidak overflow dokumen; tabel panjang di region scroll berlabel; kontrol baru memiliki target44px.
- R-17/R-18 PASS: statistik dari API/bukti, tanpa testimonial atau angka pemasaran.
- R-23 PASS: struktur menu diminta user; logo/font/palette existing dipertahankan, tidak membuat aset.
- R-24 PASS: Kinerja, laporan harian, detail tiket dan review memakai route yang ada.
- R-25 PASS: axe WCAG AA pada render fixture/actual yang diuji dan semantic token contrast gate.
- R-26 PASS: tab/filter/drilldown/review/publikasi/refresh/retry diuji; link harian diuji di runtime.
- R-27 PASS: loading, empty, dan error/retry ada serta diuji.
- R-28 PASS: tidak ada FAQ generik.
- R-32 PASS: tombol/select native, field berlabel, focus terlihat, region tabel dapat difokuskan; tidak membuat dialog custom.
- R-33 PASS: perubahan UI ditulis langsung di source, tidak memakai script string-replacement.
- R-34 PASS: tema light/dark diuji pada fixture dan aplikasi QA.
- R-35 PASS: production build Linux, interaksi fixture dan actual runtime receipt; screenshot desktop/mobile diperiksa langsung.
- R-36/R-38 PASS: tidak ada klaim compliance/performa atau identitas orang rekaan yang dipresentasikan sebagai data produksi.
- R-37 PASS: mengikuti arah NOC Manager yang disetujui; dials dinyatakan sebelum implementasi.
- R-01/R-04/R-07/R-08/R-10/R-13/R-19/R-22 PASS: tidak menambah gradient, icon dekoratif, grid latar, panah dekoratif, blur, glow, motion, atau ilustrasi.
- R-06 PASS: font sistem existing untuk keterbacaan tabel operasional; angka nilai memiliki hirarki lebih kuat.
- R-09 PASS: status simulasi/resmi berupa keterangan fungsional, bukan badge promosi.
- R-12/R-14 PASS: ringkasan berupa definition list dan tabel bukti, tanpa grid kartu bershadow.
- Liveliness PASS: nilai/rank sebagai focal point; whitespace memisahkan ringkasan dan bukti; aksen teal pada tab aktif; tipografi/tabel mengikuti motif aplikasi existing; dials konsisten.
- C-1/C-2/C-3 PASS: hirarki untuk membaca hasil lalu bukti, kontrol berfungsi, tidak menambah section pemasaran.
- C-4/C-5 PASS: state/tema/ukuran teruji, kesimpulan dapat ditelusuri ke bukti, data tidak cukup tetap null.
- R-05/R-11/R-15/R-16/R-20/R-21/R-29/R-30/R-31 PASS: layout operasional sesuai isi, radius/tokens existing, label aksi spesifik, tanpa buzzword atau clone produk lain, kedua tema berfungsi, warna semantik existing; alasan visual tercatat di ledger.

## Rollout dan rollback

Gunakan `scripts/apply_performance_migration.cjs` dry-run lalu `--apply` setelah backup valid. Pertahankan default flag aman, aktifkan `unified_performance_ui` dan `performance_activity_capture` dalam mode simulation, biarkan `performance_ranking_publication=false` sampai kebijakan siap.

Rollback menggunakan image sebelumnya dan pemulihan nilai flag sebelumnya. Kolom/tabel additive tetap disimpan agar event dan manifest tidak hilang. Jangan menjalankan destructive down migration, jangan mengganti volume uploads/database. Fixture, sesi QA dan tunnel dibersihkan setelah verifikasi.

Rilis produksi: `777674696327b5e9e7850d5884b09e8561f3f199`, image `noc-manager2-app:release-7776746`. Source integrity383 file PASS, login local/domain200, endpoint Kinerja tanpa sesi401, flags simulasi terverifikasi. Image sebelumnya berhasil membaca schema additive di DB QA. Backup dan rollback berada di `/opt/noc-manager2/releases/unified-performance/`; volume uploads dipertahankan.

## Tindak lanjut 3.1.1

Tab tim Kinerja kini menampilkan panel kesiapan ketika belum ada nilai formal: jumlah anggota dengan penempatan sebulan penuh, kebijakan published, konteks jadwal, bukti yang direview, dan alasan penghambat teratas, dengan tautan ke pengaturan evaluasi, review bukti, dan laporan harian. API overview menyertakan ringkasan `readiness` dan `reasons` per anggota.

Audit produksi 2026-10: 0 penempatan, 0 kebijakan published, 0 konteks, 0 bukti direview, 0 laporan harian submitted, 0 fase selesai. Nilai tetap `null` sampai penempatan disinkronkan, kebijakan simulasi dipublikasikan per departemen/peran/perusahaan, konteks jadwal divalidasi, dan bukti aktivitas direview. Bulan yang tidak memiliki aktivitas terverifikasi tidak dapat menghasilkan nilai.

## Tindak lanjut 3.2.0

Tab tim Kinerja sekarang menampilkan **Peringkat aktivitas bulan ini** yang dihitung dari data operasional yang sudah ada: tiket selesai, komentar (respons), dan poin ledger. Ringkasan dan tabel per anggota tersedia tanpa menunggu kalibrasi evaluasi formal.

Data produksi Oktober 2026: 2.867 tiket selesai, 7.599 komentar, 23.361 poin ledger, 84 user aktif. Ini menjawab kebutuhan penilaian operasional harian; nilai evaluasi formal tetap memakai model bukti dan memerlukan penempatan, kebijakan, konteks, serta review bukti.

## Tindak lanjut 3.3.0

Skor aktivitas 0-100 dihitung dari data operasional nyata: 40% poin ledger, 35% tiket selesai, 25% komentar/respons, masing-masing relatif terhadap nilai tertinggi pada filter. Ini memberi penilaian operasional langsung tanpa menunggu kalibrasi evaluasi formal; nilai formal tetap memakai model bukti dengan kebijakan dan target per peran.
