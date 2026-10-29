# Bulk penautan CID

Masalah: 8.986 CID berstatus belum tertaut dan menautkan satu per satu tidak realistis. Dialog per CID sudah dipercepat dengan saran customer/perusahaan, tetapi operator tetap harus mengulang pemilihan produk/kapasitas untuk setiap CID.

## Perubahan

- Tabel **Penautan CID** mendapat checkbox per baris dan **pilih semua** untuk baris berstatus *Belum tertaut ke layanan* pada halaman aktif. Baris konflik dan sudah tertaut tidak dapat dipilih.
- Toolbar **“x CID dipilih — Tautkan terpilih…”** membuka dialog bulk: **customer, produk/layanan, kapasitas, perusahaan layanan, status layanan** diisi sekali untuk seluruh batch.
- Baris **“Asset tersedia”** (layanan sudah ada, tiket sumber belum tertaut) memakai tombol **“Tautkan tiket terpilih ke Asset”**: tidak membuat layanan/duplikat, hanya menautkan tiket ke layanan existing. Pilihan campuran dengan baris belum tertaut ditolak dengan pesan agar memilih satu jenis.
- Setiap CID dibuatkan **satu layanan**; nama layanan mengikuti nama sumber tiket (fallback ke CID). Tiket sumber ditautkan tanpa mengubah status, poin, atau isi tiket.
- Batas **50 CID per batch** dan duplikat CID dibuang otomatis. Setiap CID berjalan dalam transaksi sendiri: satu baris gagal (mis. kode tidak ditemukan) tidak membatalkan baris lain, dan hasil per baris ditampilkan (`mapped`, `failed`, `created`, `linkedTickets`).
- Baris **konflik** tetap harus diselesaikan satu per satu (memerlukan konfirmasi konflik/alias). Baris yang bertanda perlu konfirmasi klasifikasi/format menampilkan checkbox konfirmasi (mode buat) atau konfirmasi browser (mode link); batch tidak dapat dijalankan sebelum dikonfirmasi.
- Endpoint: `POST /api/assets/circuit-candidates/bulk` menerima `action: "link"` (tautkan tiket ke Asset existing) atau mode default pembuatan layanan — otorisasi sama dengan penautan per CID (Admin/manage_assets), maksimal 50 CID, validasi customer/produk sama dengan jalur tunggal.

## Rencana batch pertama (data produksi 2026-10-29)

- 8.805 CID *belum tertaut ke layanan*; **4.903** di antaranya sudah punya saran customer (734 customer, 236 di antaranya punya hint produk/kapasitas dari layanan existing).
- Rencana per customer (customer ID, jumlah CID, kata kunci pencarian, saran perusahaan/produk/kapasitas, contoh CID) ada di `data/audit/cid-batch-plan-2026-10-29.csv`. Contoh teratas: PT Indotel (204 CID, kata kunci `INDOTEL`), PT Lazada (156, `LAZADA`), PT Global Sarana Elektronika (79, `ELEKTRONIKA`), PT SWIFT SHIPMENT SOLUTIONS (78, `SHIPMENT`), VELO (73, `VELO`, saran METRO-E).
- Alur per batch: buka Penautan CID → cari kata kunci → centang CID (per halaman) → **Tautkan terpilih…** → isi customer/produk/kapasitas/perusahaan (pakai kolom saran di CSV bila ada) → jalankan. Ulangi per halaman bila CID customer lebih dari 25 (batas 50 per batch).

## Verifikasi

- `node scripts/test_bulk_circuit_mapping.cjs` — deduplikasi CID, pembuatan layanan massal dengan owner/produk/kapasitas yang sama, nama layanan dari sumber tiket, tautan tiket, kegagalan sebagian per baris, batas 50, input kosong, dan bulk link tiket ke Asset existing (tanpa layanan duplikat).
- `node scripts/test_sap_assets_ui.cjs` — pilih dua CID, dialog bulk, payload customer/produk/kapasitas/perusahaan, notifikasi hasil, axe WCAG 2.2 AA (termasuk target checkbox), dan seluruh regresi dialog per CID.
- `node scripts/test_circuit_mapping_assets.cjs`, `test_customer_suggestion.cjs`, `test_circuit_candidates_api.cjs` — regresi pemetaan per CID dan saran customer.
- `npm run lint` dan `npm run changelog:check` PASS.
