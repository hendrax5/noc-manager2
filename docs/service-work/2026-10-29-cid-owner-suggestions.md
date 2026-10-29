# Saran customer & perusahaan pada Penautan CID

Masalah: 8.986 CID di tab **Penautan CID** berstatus belum tertaut. Data tiket lama tidak menyimpan Customer ID, hanya nama customer/site sebagai teks bebas (mis. `PT JARINGAN TIANG INDONESIA GROUP-OFFICE KALIGELAN`), sehingga operator harus menebak customer dan berpindah tab untuk membuat customer baru.

## Perubahan

- **Ekstraksi nama PT** dari nama tiket lama: memotong penanda site/office/rack (`… site …`, `… -OFFICE …`), tag dalam kurung/kurung siku (`(COMIX)`, `[HUB]`), akhiran legal ganda (`…, PT`), dan mengambil nama setelah `to Rack` untuk tiket cross-connect. Hasil dinormalisasi menjadi nama PT yang terbaca (mis. **PT Jaringan Tiang Indonesia Group**) tanpa mengubah data sumber.
- **Pencocokan konservatif ke registry**: nama hasil ekstraksi dianggap cocok hanya bila (a) token nama sama persis, (b) nama tiket menyebut **seluruh** token customer terdaftar, atau (c) customer terdaftar hanya menambah kata pemasaran umum (`NUSANTARA`, `SOLUSI`, `MEDIA`, `NET`, …). Kesamaan sebagian kata — kota, kata umum, atau satu kata saja — **tidak** dianggap customer yang sama (mis. `PT Mega Data Akses` ≠ `PT Mega Data Net`; `PT Lintas Teknologi Solusindo` ≠ `PT Lintas Media Solusindo`).
- **Tabel Penautan CID** mendapat kolom **Customer (saran)** dengan tampilan:
  - `ION-CUST-… — nama customer` bila yakin cocok;
  - `Belum ada customer — usul nama: PT …` bila belum ada;
  - `Pilih manual` bila nama tidak bisa disimpulkan.
  - Saran perusahaan (ION/SDC) dari field `company`/`Order Origin` tiket ikut ditampilkan.
- **Dialog Tautkan customer & layanan**: customer terisi otomatis saat cocok; nama PT baru langsung terisi pada form **Tambah customer baru** (customer dibuat satu klik tanpa menutup dialog); perusahaan layanan ikut terisi dari saran tiket. Saran hanya prefill — operator tetap memeriksa dan menyimpan.
- Saran dihitung **per halaman** (25 baris) dengan satu query customer + satu query tiket per halaman, tidak memindai ulang seluruh data per baris.

## Cakupan data (snapshot 2026-10-29)

- Awal: 8.986 CID pending; 2.843 cocok ke customer existing, 5.989 usul nama PT baru, 154 pilih manual; 8.977 baris punya saran perusahaan (ION/SDC).
- Pembuatan customer dari usulan (perusahaan dengan ≥2 CID), dua batch:
  - Batch 1: **328 customer baru** dibuat, 10 nama sudah ada, 5 nama tertutup varian yang dibuat pada batch yang sama — audit `/opt/noc-manager2/releases/cid-owner-suggestions-3.17.0/customer-creation-2026-10-29.json`.
  - Batch 2 (setelah pencocokan diperketat): **21 customer baru** — audit `/opt/noc-manager2/releases/cid-owner-suggestions-3.17.0/customer-creation-batch2-2026-10-29.json`.
- Hasil akhir saat ini: **5.013 CID punya saran customer cocok** (55,8%), 3.819 usul nama baru, 154 pilih manual; 8.977 baris tetap punya saran perusahaan.
- Berkas review dihasilkan dari data produksi (read-only): `data/audit/cid-customer-suggestions-2026-10-29.csv` (per CID), `data/audit/cid-customer-proposals-2026-10-29.csv` (semua usulan), `data/audit/cid-customer-create-candidates-2026-10-29.csv` (calon PT/CV batch 1), `data/audit/customer-creation-2026-10-29.json` (audit batch 1), dan `data/audit/customer-creation-batch2-2026-10-29.json` (audit batch 2; keduanya bisa dipakai untuk rollback).

## Verifikasi

- `node scripts/test_customer_suggestion.cjs` — ekstraksi nama PT (site/rack/alias), contoh pengguna, penolakan false-positive (`SURABAYA`/`YAYASAN` tidak menyatukan perusahaan), usulan nama baru, saran perusahaan.
- `node scripts/test_circuit_candidates_api.cjs` — endpoint mengembalikan `customerSuggestion` (matched vs usulan), `companySuggestion` ternormalisasi, ACL, dan id internal tetap tersembunyi.
- `node scripts/test_sap_assets_ui.cjs` — kolom Customer (saran), prefill customer cocok, saran perusahaan, usul nama PT + buat customer satu klik, axe WCAG 2.2 AA, 320px.
- `npm run lint` dan `npm run changelog:check` PASS.
