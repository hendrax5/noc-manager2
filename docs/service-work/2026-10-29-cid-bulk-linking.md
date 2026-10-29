# Bulk penautan CID

Masalah: 8.986 CID berstatus belum tertaut dan menautkan satu per satu tidak realistis. Dialog per CID sudah dipercepat dengan saran customer/perusahaan, tetapi operator tetap harus mengulang pemilihan produk/kapasitas untuk setiap CID.

## Perubahan

- Tabel **Penautan CID** mendapat checkbox per baris dan **pilih semua** untuk baris berstatus *Belum tertaut ke layanan* pada halaman aktif. Baris konflik, sudah tertaut, atau *asset tersedia* tidak dapat dipilih untuk pembuatan layanan.
- Toolbar **“x CID dipilih — Tautkan terpilih…”** membuka dialog bulk: **customer, produk/layanan, kapasitas, perusahaan layanan, status layanan** diisi sekali untuk seluruh batch.
- Setiap CID dibuatkan **satu layanan**; nama layanan mengikuti nama sumber tiket (fallback ke CID). Tiket sumber ditautkan tanpa mengubah status, poin, atau isi tiket.
- Batas **50 CID per batch** dan duplikat CID dibuang otomatis. Setiap CID berjalan dalam transaksi sendiri: satu baris gagal (mis. kode tidak ditemukan) tidak membatalkan baris lain, dan hasil per baris ditampilkan (`mapped`, `failed`, `created`, `linkedTickets`).
- Baris **konflik** tetap harus diselesaikan satu per satu (memerlukan konfirmasi konflik/alias). Baris yang bertanda perlu konfirmasi klasifikasi/format menampilkan checkbox konfirmasi; batch tidak dapat dijalankan sebelum dicentang.
- Endpoint baru: `POST /api/assets/circuit-candidates/bulk` — otorisasi sama dengan penautan per CID (Admin/manage_assets), maksimal 50 CID, validasi customer/produk sama dengan jalur tunggal.

## Verifikasi

- `node scripts/test_bulk_circuit_mapping.cjs` — deduplikasi CID, pembuatan layanan massal dengan owner/produk/kapasitas yang sama, nama layanan dari sumber tiket, tautan tiket, kegagalan sebagian per baris, batas 50, dan input kosong.
- `node scripts/test_sap_assets_ui.cjs` — pilih dua CID, dialog bulk, payload customer/produk/kapasitas/perusahaan, notifikasi hasil, axe WCAG 2.2 AA (termasuk target checkbox), dan seluruh regresi dialog per CID.
- `node scripts/test_circuit_mapping_assets.cjs`, `test_customer_suggestion.cjs`, `test_circuit_candidates_api.cjs` — regresi pemetaan per CID dan saran customer.
- `npm run lint` dan `npm run changelog:check` PASS.
