# Cross Connect dan Instalasi Rack dapat mendaftarkan CID baru

> Catatan: perilaku aktivasi diubah pada 3.21.0 — RFS menjadi tanggal target dan aktivasi Pending dijalankan sweep RFS, bukan Resolve. Lihat `2026-10-30-rfs-target-aktivasi-terjadwal.md`.

Masalah: jenis pekerjaan Data Center (Cross Connect, Instalasi Rack, dan jenis Data Center lain) hanya menerima CID yang sudah ada di Inventory. Form hanya menampilkan daftar CID existing, sehingga instalasi rack atau cross connect baru untuk customer/CID yang belum terdaftar tidak dapat dibuatkan tiket.

## Perubahan

- Form tiket jenis pekerjaan Data Center kini menampilkan pilihan **Sumber CID**: **Gunakan CID yang sudah terdaftar di Inventory** (perilaku lama) atau **Daftarkan layanan/CID baru**.
- Mode CID baru memakai field registrasi yang sama dengan Instalasi Baru: customer terdaftar atau customer baru, CID, nama layanan/site, produk/layanan, dan kapasitas. RFS mengikuti RFS pekerjaan Data Center sehingga hanya ada satu input tanggal.
- Server menerima registrasi untuk operasi `Installation` dan `DataCenter`. Layanan dibuat `Pending` dan ditautkan ke tiket dalam transaksi yang sama; snapshot pekerjaan mencatat `registration: 'new'` dengan `before.status = Pending` dan `after.status = Active`. Penanda `registration` hanya ditulis server: percobaan mengirimkannya via `serviceChange` ditolak, dan tiket tidak dapat memindahkan pekerjaan ke CID lain selama registrasi belum selesai.
- Saat Resolve, layanan hasil registrasi diaktifkan (`Pending` → `Active`) setelah RFS terlewati. Status yang sudah diubah operator lain tidak ditimpa dan aktivasi ganda tidak menghasilkan audit palsu. Pekerjaan Data Center pada CID existing tetap tidak mengubah produk, kapasitas, maupun status layanan, sesuai aturan sebelumnya.
- Registrasi memakai validasi produk yang sama dengan Instalasi Baru: field produk wajib dan keunikan CID tetap diperiksa server, bukan hanya browser.
- Detail pekerjaan Data Center (lokasi, endpoint, detail pekerjaan, detail teknis) dimuat kembali pada form edit agar tidak hilang saat tiket diperbarui. Mengganti mode ke CID existing membersihkan CID/site yang dibatalkan dari saran Subject.
- Catatan: perusahaan layanan (company/Order Origin) untuk layanan hasil registrasi tetap diisi melalui Assets, sama seperti alur Instalasi Baru. Perubahan produk/kapasitas lewat Assets pada layanan Pending tetap dipertahankan saat aktivasi; yang dijaga hanya status agar tidak ditimpa.
- Catatan: menghapus tiket sebelum Resolve meninggalkan layanan Pending tanpa tiket pengaktivasi, sama seperti alur Instalasi Baru; aktifkan atau hapus layanan melalui Assets.

## Verifikasi

- `node scripts/test_datacenter_registration.cjs` — registrasi customer/CID baru + audit, snapshot Pending→Active, edit mempertahankan registration dan menolak pindah CID/penanda client, CID existing tidak berubah tanpa tulis Inventory, guard RFS masa depan/detail kosong/operasi produk field/CID duplikat, dan guard balapan aktivasi.
- `node scripts/test_service_work_api.cjs` — regresi Upgrade, rollback atomik, Resolve berulang, konflik Inventory, ACL master.
- `node scripts/test_work_type_forms_v2.cjs` — form browser: mode CID existing vs baru, payload registrasi + workDetails, department otomatis NocDatacenter, reset Subject saat mode dibatalkan, axe WCAG 2.2 AA, dan reflow 320px.
- `npm run lint` dan `npm run changelog:check` PASS.
