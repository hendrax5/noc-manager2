# Lintas menu: audit dan perbaikan konsistensi UI

Tanggal: 2026-10-24
Cakupan: Pengaturan, Laporan, Tiket, Dashboard.
Metode: audit kode statis per area (pola tombol, tabel, form, feedback), render fixture untuk halaman master, tanpa database live.

Latar: perbaikan Master Data Trouble menemukan tiga pola yang bisa terulang di menu lain — tombol primer yang kalah oleh aturan CSS turunan, aksi/form yang jauh dari pemicunya, dan tabel lebar yang tidak terbaca di layar sempit. Audit ini mencari pola yang sama di seluruh menu lalu memperbaiki yang berdampak paling besar.

## Ringkasan perbaikan

### Fondasi (berlaku lintas halaman)

- `app/ui-foundation.css`: varian `.btn.btn-primary` (0-2-0) sekarang mengalahkan aturan turunan halaman seperti `.actions button` (0-1-1) yang sebelumnya membuat tombol primer tampil netral. Ditambah `.btn.btn-danger`, `.btn.btn-danger-ghost`, utilitas `.sr-only` dan `.table-region` (area scroll tabel yang bisa difokus keyboard).
- `app/globals.css`: `.secondary-btn` didefinisikan (sebelumnya dipakai di JSX tetapi tidak punya style), `.primary-btn.btn-fit` untuk keluar dari lebar 100%, dan aturan tombol di `.report-tabs` / `.report-pager` / `.report-filter-presets` / `.sla-filter-presets` diberi guard `:not(:where(...))` agar tidak lagi menimpa varian primer/sekunder. Guard memakai `:where()` supaya spesifisitas dasar tidak naik dan state aktif tetap menang.
- `.table-region` dipakai bersama oleh tabel laporan lebar.

### Pengaturan

- **Jenis Pekerjaan Layanan** ditulis ulang mengikuti pola Master Data Trouble: toolbar dengan pencarian dan tombol primer, form tambah/edit sebagai `<dialog>` dengan galat per field, aksi Edit + Hapus, switch Aktif/Nonaktif di baris, jumlah tiket pemakai, empty state terpisah, dan daftar kartu di bawah 56rem (tabel 6 kolom baru muat di 896px ke atas). API mendapat `DELETE` dengan penjagaan pemakaian tiket dan `usageCount` pada `GET`.
- Dua select native di halaman itu diganti **`MasterPicker`** (`components/MasterPicker.js`, CSS module sendiri): combobox select-only sesuai WAI-ARIA APG dengan tombol pemicu + listbox, navigasi panah/Home/End, Enter/Space, Escape yang tidak menutup dialog, typeahead, `aria-activedescendant`, penempatan listbox flip-up saat ruang bawah sempit, serta target 44px. Dipakai untuk Operasi dan Saran Job Category.
- **SettingsClient**: kegagalan POST/PATCH/DELETE kini diperiksa `res.ok` sehingga respons galat tidak lagi masuk ke array dan menjadi baris hantu. Hapus Job Category yang masih dipakai menampilkan pesan dan saran menonaktifkan. `alert()` pada simpan branding/dashboard diganti banner inline. Status 🟢/🔴 diganti badge teks. Dua API key memakai `type="password"`. Grid form tetap satu kolom di layar sempit (`repeat(auto-fit, minmax(min(100%, 13rem), 1fr))`). Label form field/kategori kini terhubung ke input (`htmlFor`/`id`), `colSpan` baris kosong diperbaiki.
- **Workflow**: daftar aturan dimuat saat halaman dibuka (tidak perlu klik), publikasi meminta konfirmasi, tombol draft/publikasi memakai varian, tabel diberi caption/scope dan empty state.
- **IntegrationsPanel**: error pada rotasi kunci, toggle status, dan hapus tidak lagi diabaikan; form punya nama aksesibel; tabel diberi caption/scope dan header tindakan; status memakai badge; tombol Delete memakai varian destruktif.

### Laporan

- Tabel lebar (SLA letter 8 kolom, Ops 7–8 kolom, Pemerataan shift 8 kolom) kini punya `min-width`, area scroll `role="region"` + `tabIndex` + label, caption, dan `scope="col"`.
- Tombol yang sebelumnya default/bare: "Aktualkan data" (sekunder), "Publikasikan peringkat resmi" (primer), "Bandingkan orang" (sekunder, tidak lagi memakai gaya `.logout-btn`), "Kirim laporan" (primer) dan "Simpan draft" (sekunder), serta aksi baris evaluasi ("Hitung dan simpan revisi", "Setujui evaluasi", "Kunci evaluasi") yang kini memakai varian.
- Umpan balik simpan laporan harian dipindah ke dalam baris aksi form, bukan hanya di atas halaman.
- "Cetak / PDF" pada filter SLA diturunkan menjadi sekunder agar "Terapkan" satu-satunya aksi utama; galat filter memakai `role="alert"`.
- Pratinjau laporan gangguan kini menggulir dan memfokuskan panel pratinjau setelah dibuka, sehingga klik tidak terasa mati.

### Tiket

- Daftar tiket: area scroll diberi `role="region"` + `tabIndex` + label, tabel diberi caption/`scope`, empty state menawarkan "Reset filter".
- Detail tiket: tombol Edit menjadi primer dan Delete menjadi ghost destruktif (sebelumnya Delete yang paling menonjol), perubahan status ke `Closed` meminta konfirmasi, dan kegagalan kirim komentar tampil sebagai `role="alert"` di dekat tombol kirim (teks tidak hilang).
- Form tiket baru: pesan galat dipindah ke atas form, dekat pemilih CID/gejala/penyebab yang dirujuk pesannya.
- Form tiket: **Jenis pekerjaan**, **Department**, dan **PIC** kini memakai `MasterPicker` (bukan select native). Harness `test_work_type_forms_v2.cjs` diperbaiki dengan stub `node:crypto` sehingga alur Upgrade/Installation/Terminate/BOD + axe + 320px benar-benar dijalankan, dan `test_service_work_detail_ui.cjs` juga dijalankan untuk memastikan form klasifikasi di halaman detail tetap berfungsi.

### Dashboard

- Tombol "Create Ticket" dan "Inspect Log Matrix" keluar dari lebar 100% legacy dan tidak lagi memakai kelas yang menimpa warna primer.
- Live Operations Board: area scroll diberi region + fokus keyboard, tabel diberi caption/`scope` dan `min-width` 64rem, header yang bisa diurutkan menjadi `<button>` di dalam `<th>` dengan `aria-sort`, tombol simpan/batal catatan punya `aria-label`, dan pemicu tambah catatan bisa dijangkau keyboard dengan target 44px.

## Verifikasi

```sh
npm run lint                                     # exit 0
node scripts/test_trouble_master_ui.cjs          # PASS
node scripts/test_service_work_master_ui.cjs     # PASS (dialog, combobox keyboard/typeahead, axe WCAG 2.1 AA)
node scripts/test_work_type_forms_v2.cjs          # PASS (Upgrade/Installation/Terminate/BOD, axe, 320px)
node scripts/test_service_work_detail_ui.cjs     # PASS (detail + klasifikasi pekerjaan)
node scripts/test_service_work_master_ui.cjs     # PASS (dialog, combobox keyboard/typeahead, axe WCAG 2.1 AA)
node scripts/test_workflow_ui.cjs                # PASS (termasuk axe WCAG 2.1 AA)
node scripts/test_outage_report_ui.cjs           # PASS (320/414/768px)
node scripts/test_service_work_ui.cjs            # PASS (rewritten to the current work-v2 form)
node scripts/test_ticket_classification_ui.cjs   # PASS (rewritten; axe WCAG 2.1 AA)
```

`test_work_type_forms_v2`, `test_service_work_detail_ui`, `test_service_work_ui`, dan `test_ticket_classification_ui` sebelumnya gagal di tahap bundling karena `lib/activity/recordActivity.js` mengimpor `node:crypto`. Keempatnya kini memakai stub khusus test (bukan mengubah kode aplikasi), dan dua tes yang masih memakai label form lama ditulis ulang mengikuti UI work-v2 saat ini. Dengan begitu seluruh verifikasi form tiket bisa dijalankan kembali.

Dua skrip terakhir gagal di tahap bundling esbuild (`node:crypto` tanpa `platform: 'node'`, dan impor CSS module tanpa `outdir`). Kegagalan itu sudah ada sebelum perubahan ini (skrip tersebut juga berstatus termodifikasi di working tree sebelum sesi ini) dan tidak terkait komponen yang diubah.

Render fixture Jenis Pekerjaan Layanan: overflow horizontal 0px pada 1280/768/390/390×600, dialog muat di viewport, kartu mobile terbaca, dan listbox combobox tidak keluar dari viewport. Screenshot: `service-work-types.png`, `service-work-types-dialog.png`, `service-work-types-mobile.png`, `service-picker.png`, `service-picker-dark.png`, `service-picker-mobile.png`.

## Yang belum dikerjakan (disengaja)

- Tabel tiket dan Live Operations Board belum punya versi kartu penuh di bawah 640px; saat ini memakai area scroll berlabel. Konversi ke kartu memerlukan perubahan markup besar dan sebaiknya disertai uji data nyata.
- Evaluation Settings masih membuat grant/assignment yang tidak pernah dirender dan API-nya belum punya `DELETE`, sehingga belum bisa dicabut dari UI.
- Hapus Job Category masih hard delete; penjagaan penuh butuh endpoint baru yang menolak `P2003` dengan pesan ramah.
- Tab Pengaturan belum memakai pola tab ARIA/URL dan belum punya pencarian.
- Hapus aturan workflow belum tersedia karena API belum menyediakan `DELETE`/unpublish.
- Select native masih dipakai di filter laporan/tiket, `ServiceWorkFields`/`InstallationFields`, dan beberapa form lain; form master jenis pekerjaan serta form tiket (jenis pekerjaan, Department, PIC) sudah memakai `MasterPicker`. Penggantian menyeluruh perlu gelombang tersendiri.
