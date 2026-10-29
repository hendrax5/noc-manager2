# Penautan CID dalam satu dialog: customer, layanan, kapasitas, perusahaan

Masalah: menyelesaikan penautan CID memerlukan perpindahan tab. Customer baru harus dibuat di tab **Customers Registry**, produk baru di tab **Produk layanan**, sedangkan kapasitas dan perusahaan layanan baru hanya bisa diisi di halaman detail Asset. Dialog **Tautkan customer & layanan** sendiri hanya mengisi customer, produk, nama, dan status, sehingga operator bolak-balik dan kehilangan konteks pencarian CID.

## Perubahan

- Dialog **Tautkan customer & layanan** (Assets → Penautan CID) sekarang menuntaskan satu penautan penuh:
  - **Tambah customer baru inline** (nama, email/telepon opsional). Customer langsung dipilih, dialog tetap terbuka, fokus kembali ke tombol setelah simpan, dan daftar customer di halaman Assets ikut diperbarui. Email yang tidak valid ditolak sebelum request.
  - **Layanan baru** meminta produk, nama, **perusahaan layanan**, **kapasitas** (Gbps atau pair mengikuti produk), dan status dalam dialog yang sama.
  - **Layanan existing** menampilkan produk/status sekaligus kapasitas dan perusahaan saat ini; keduanya dapat diubah langsung dari dialog. Nilai yang tidak diubah (termasuk kapasitas 0 atau angka yang diketik ulang sama) tidak dikirim, jadi menautkan CID saja tidak menulis ulang Inventory.
- Server `mapCircuitCandidate` menormalisasi perusahaan (alias lama seperti `PRODC` → `SDC`), menerapkan aturan produk yang sama dengan halaman Asset (`OPEN PORT` minimal 10 Gbps, `DARKFIBER` memakai jumlah pair), menolak satuan kapasitas yang salah/overflow, menyelaraskan field satuan lama (`bandwidthGbps`/`bandwidthMbps`), serta hanya memperbarui layanan existing bila nilai benar-benar berubah.
- Guard yang dipertahankan: konfirmasi alias CID, konfirmasi sumber/konflik, larangan edit Inventory saat BOD aktif (penautan CID saja tetap boleh), validasi status/nama/panjang field, dan audit `service.updated` (termasuk perubahan perusahaan saja).
- Tetap di luar dialog (tidak diminta): pembuatan produk/layanan (template) baru; tombol **Kelola produk** masih membuka tab Produk layanan. Mengosongkan kapasitas/perusahaan berarti tidak diubah, bukan menghapus nilai.

## Verifikasi

- `node scripts/test_circuit_mapping_assets.cjs` (baru) — create layanan baru dengan kapasitas + perusahaan, normalisasi alias perusahaan, aturan OPEN PORT/DARKFIBER, layanan existing dilengkapi tanpa penulisan berlebih, kapasitas 0 tetap tertaut, guard satuan/overflow, sinkron field satuan lama, audit perubahan perusahaan, guard BOD aktif, konfirmasi alias tetap.
- `node scripts/test_sap_assets_ui.cjs` — dialog browser: tambah customer inline (fokus form, validasi email, notifikasi status di dalam dialog) tanpa menutup dialog/berpindah tab, isi perusahaan + kapasitas layanan baru, prefill dan edit kapasitas/perusahaan layanan existing, layanan existing berkapasitas 0 tidak memblokir submit, penautan tanpa perubahan tidak mengirim kapasitas/perusahaan, axe WCAG 2.2 AA (light/dark, termasuk form customer inline), keyboard focus di dialog, reflow 320px.
- `node scripts/test_customer_inventory_redesign_ui.cjs` — regresi tab Daftar circuit/Inventory.
- `npm run lint` dan `npm run changelog:check` PASS.
