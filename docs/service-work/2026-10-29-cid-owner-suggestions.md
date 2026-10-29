# Saran customer & perusahaan pada Penautan CID

Masalah: 8.986 CID di tab **Penautan CID** berstatus belum tertaut. Data tiket lama tidak menyimpan Customer ID, hanya nama customer/site sebagai teks bebas (mis. `PT JARINGAN TIANG INDONESIA GROUP-OFFICE KALIGELAN`), sehingga operator harus menebak customer dan berpindah tab untuk membuat customer baru.

## Perubahan

- **Ekstraksi nama PT** dari nama tiket lama: memotong penanda site/office/rack (`… site …`, `… -OFFICE …`), tag dalam kurung/kurung siku (`(COMIX)`, `[HUB]`), akhiran legal ganda (`…, PT`), dan mengambil nama setelah `to Rack` untuk tiket cross-connect. Hasil dinormalisasi menjadi nama PT yang terbaca (mis. **PT Jaringan Tiang Indonesia Group**) tanpa mengubah data sumber.
- **Pencocokan konservatif ke registry**: nama hasil ekstraksi hanya dianggap cocok bila seluruh kata pembeda customer ada di nama tiket, atau minimal dua kata pembeda yang sama, atau customer satu kata yang cocok persis. Kata umum/kota (`INDONESIA`, `JARINGAN`, `MEDIA`, `SURABAYA`, `YAYASAN`, `DINAS`, …) diabaikan agar **dua perusahaan berbeda tidak tergabung**.
- **Tabel Penautan CID** mendapat kolom **Customer (saran)** dengan tampilan:
  - `ION-CUST-… — nama customer` bila yakin cocok;
  - `Belum ada customer — usul nama: PT …` bila belum ada;
  - `Pilih manual` bila nama tidak bisa disimpulkan.
  - Saran perusahaan (ION/SDC) dari field `company`/`Order Origin` tiket ikut ditampilkan.
- **Dialog Tautkan customer & layanan**: customer terisi otomatis saat cocok; nama PT baru langsung terisi pada form **Tambah customer baru** (customer dibuat satu klik tanpa menutup dialog); perusahaan layanan ikut terisi dari saran tiket. Saran hanya prefill — operator tetap memeriksa dan menyimpan.
- Saran dihitung **per halaman** (25 baris) dengan satu query customer + satu query tiket per halaman, tidak memindai ulang seluruh data per baris.

## Cakupan data (snapshot 2026-10-29, read-only)

- 8.986 CID pending: **2.843 cocok** ke customer existing (Customer ID langsung tampil), **5.989** mendapat usul nama PT baru, **154** perlu pilih manual.
- **4.340** nama PT usulan unik; terbesar: RPTRA (154 CID), Lazada (98), DISKOMINFO Kota Tangerang (61), PT Indosat (51).
- **8.977** baris mendapat saran perusahaan (ION/SDC) dari tiket.
- Berkas review dihasilkan dari data produksi (read-only): `data/audit/cid-customer-suggestions-2026-10-29.csv` (per CID) dan `data/audit/cid-customer-proposals-2026-10-29.csv` (nama PT usulan + jumlah CID).

## Verifikasi

- `node scripts/test_customer_suggestion.cjs` — ekstraksi nama PT (site/rack/alias), contoh pengguna, penolakan false-positive (`SURABAYA`/`YAYASAN` tidak menyatukan perusahaan), usulan nama baru, saran perusahaan.
- `node scripts/test_circuit_candidates_api.cjs` — endpoint mengembalikan `customerSuggestion` (matched vs usulan), `companySuggestion` ternormalisasi, ACL, dan id internal tetap tersembunyi.
- `node scripts/test_sap_assets_ui.cjs` — kolom Customer (saran), prefill customer cocok, saran perusahaan, usul nama PT + buat customer satu klik, axe WCAG 2.2 AA, 320px.
- `npm run lint` dan `npm run changelog:check` PASS.
