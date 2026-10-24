# Perbaikan kontras status tiket dan indikator aplikasi

Penyebab: style dropdown Resolved memakai `var(--ui-success)` sekaligus untuk latar dan tulisan. Pengujian halaman sebelumnya tidak menjamin state Resolved terbuka, dan axe tidak selalu menilai select disabled. Palet status Live Ops juga masih memakai warna literal lama.

## Perubahan

- Dropdown detail dan badge daftar tiket menggunakan helper `statusStyle()` dengan pasangan foreground/background semantik. Normalisasi dan nilai status tetap sama.
- Closed/On Hold memakai warna netral, Finish/Resolved memakai pasangan success, status lain mengikuti peran warna masing-masing.
- Warna option native ditetapkan dan penghapusan outline pada dropdown dibuang. Label Status terhubung ke select.
- Label role/departemen Dashboard, WFH, overlay foto profil, kategori/durasi Live Ops, kartu Ops Report, serta teks dan blok timeline TeamWorkHours diperbaiki dengan token yang sama.
- Tidak mengubah status tiket, skor, SLA, routing, atau data pengguna.

## Verifikasi

- 132 library tests PASS, termasuk regresi pasangan status dan alias.
- 8 status dalam light/dark, badge dan select aktif/nonaktif, computed text contrast minimal4.5:1. Opacity1 dan text-fill native sama dengan foreground diperiksa eksplisit. Perubahan pilihan fixture, axe dan reflow320/1440 PASS.
- 139 pasangan warna statis CSS pada masing-masing tema:0 temuan setelah perbaikan. Audit kini mengembalikan gagal jika pasangan bermasalah muncul lagi.
- Audit46 tampilan aktual pada clone produksi: dashboard, tiket/detail Resolved, assets/tab/circuit, team/jadwal, profil, settings/master, laporan, meeting, knowledge. Empat label Ops Report dark mode ditemukan lalu diperbaiki dan diuji ulang terarah; receipt final46 tampilan tanpa temuan. Receipt dan screenshot berada di workspace QA tugas ini; hasil final disimpan dalam receipt rilis server.
- Native popup option mengikuti background surface dan teks theme. Tidak mengubah status di database untuk menguji visual, sehingga autosave/notifikasi tidak dipicu oleh audit.

## Antislop Delivery Gate (scope perbaikan ini)

- R-02 PASS: tidak menambah em dash pada copy UI; pesan pengguna tidak ditulis ulang.
- R-03 PASS: fixture320/1440 tidak overflow; kontrol status mempertahankan target44px.
- R-17/R-18/R-36/R-38 PASS: tidak menambah statistik/testimonial/identitas/claim produk; hasil ukur berasal dari tes dan receipt.
- R-23/R-24 PASS: tidak membuat aset atau navigasi baru.
- R-25 PASS: pasangan warna diukur, termasuk disabled select yang bisa dilewatkan axe.
- R-26 PASS: handler status existing dipertahankan; fixture menguji perubahan pilihan semua status.
- R-27/R-28 PASS: state loading/empty/error existing tidak diubah; tidak menambah FAQ.
- R-32 PASS: label terhubung, outline fokus global dipertahankan, select native tetap keyboard-operable.
- R-33 PASS: source/CSS diedit langsung, script hanya menjalankan audit dan tes.
- R-34 PASS: light/dark diuji untuk setiap status dan halaman aktual dalam audit.
- R-35 PASS: build Linux, browser fixture dan audit runtime; screenshot status dan halaman aktual direkam. Native option styling diperiksa di kode, bukan klaim pengujian popup OS.
- R-37 PASS: arah NOC Manager existing, ENERGY1/RHYTHM2/MOTION1. Warna membawa arti status dan hierarki, bukan dekorasi.
- Purpose gates PASS: tanpa icon/asset/glow/blur/pola baru. Background foto dibuat opaque agar warna foto tidak memengaruhi kontras caption. Gradient timeline diganti role solid agar teks kecil tetap terbaca.
- Liveliness PASS: fokus tetap isi tiket; aksen status fungsional dan motif tabel/spacing existing dipertahankan.
- C-1..C-5/quality locks PASS: perubahan terbatas pada keterbacaan, tidak menambah layout generik, CTA, animasi, radius atau klaim baru; alasan perubahan dan bukti terukur tercatat di atas.

## Rollback

Rilis ini hanya kode/CSS, tanpa migrasi dan tanpa perubahan flag. Backup database serta override Compose untuk image sebelumnya disimpan di `/opt/noc-manager2/releases/status-contrast/`. Rollback tidak menghapus data/volume dan tetap mempertahankan fitur Kinerja pada rilis sebelumnya.
