# Deteksi CID lintas format — rancangan

Status: rencana saja; belum mengubah kode aplikasi, skema, atau data produksi.

## Kebutuhan

Subject kode pada tiket pekerjaan selain Trouble perlu dikenali sebagai referensi circuit, termasuk kode lama seperti `I-0275-021-01`. Customer mempunyai banyak layanan; satu layanan mempunyai satu CID utama dan dapat mempunyai kode lama/alias yang telah dikonfirmasi. Nomor pekerjaan/tiket tetap berbeda dari identitas layanan.

## Bukti audit produksi, 22 Oktober 2026

Snapshot: 28.372 tiket. Angka di bawah menghitung tiket, bukan jumlah circuit unik; data operasional dapat bertambah.

| Keluarga Subject lengkap | Jumlah tiket | Contoh |
| --- | ---: | --- |
| SAP | 3.517 | SAP-C-1243-0002 |
| I dengan tiga segmen numerik | 2.626 | I-0275-021-01; I-0039-0012-01 |
| C dengan tiga segmen numerik | 3.152 | C-0334-001-01; C-1213-03-01 |
| I dengan dua segmen numerik | 787 | I-0043-0305; I-0202-00101 |
| I diikuti angka pada prefix | 402 | I2-0026-0008 |
| C diikuti angka pada prefix | 163 | C2-0009-0017; C4-0001-0001 |
| C dengan dua segmen numerik | 100 | C-0043-0001; C-0013-001 |
| BH | 61 | BH-0468-001 |
| R / P / L | 24 / 7 / 4 | R-0011-002-01; P-0002-001-01; L-0315-001-01 |
| DCLAND-C / DCLAND-I | 3 / 2 | DCLAND-C-0003-0001; DCLAND-I-0005-0001 |

`/tickets/11952`: Subject `I-0275-021-01`, Job Category `Installasi`, workType `Unclassified`; isi menyebut GIGA DIGITAL NUSANTARA, OFFICE KEPANJEN, LOCAL LOOP 2 GBPS. Ini kandidat untuk layanan existing OFFICE KEPANJEN, bukan alasan membuat customer baru atau mengubah produk/kapasitas Inventory dari isi email.

Seluruh 2.626 tiket I tiga segmen pada snapshot masih Unclassified. Ada 2.600 kode unik; 26 kode berulang dan 25 kelompok mempunyai variasi nama sumber. Variasi nama merupakan sinyal review, bukan bukti otomatis berbeda customer. Kasus konflik SAP yang ditemukan sebelumnya membuktikan kode tidak selalu konsisten di data lama.

## Keputusan desain

1. Pisahkan **pengenalan format**, **kelayakan tiket sumber**, dan **penautan layanan**. Teks yang cocok pola baru menjadi kandidat CID; belum otomatis menjadi Asset.
2. Prioritas implementasi: SAP + I/C tiga segmen. Keluarga lain ikut terdeteksi sebagai kandidat review; status siap otomatis diaktifkan setelah keluarga tersebut divalidasi. Dukungan bukan regex umum yang menerima semua judul bertanda hubung.
3. Normalisasi NFKC, trim, uppercase; pertahankan nol di depan dan semua segmen. Jangan menghapus/menambah tanda hubung atau menyamakan `I-0202-00101` dengan `I-0202-001-01` tanpa konfirmasi. Prefix/angka tidak menentukan customer atau tipe layanan.
4. Cocokkan seluruh Subject. Judul `Link down - I-0275-021-01` tidak menjadi sumber CID. Referensi eksplisit pada Trouble boleh mencari layanan yang sudah ada, tetapi tidak membuat layanan/alias baru dari Subject Trouble.
5. `workType=Trouble` dan kategori legacy Troubleshoot/Troubleshoot IPT/Backbone dikeluarkan dari sumber penautan otomatis. Monitoring/Daily Report juga bukan sumber otomatis. `Unclassified` tidak berarti non-Trouble: gunakan kategori legacy sebagai bukti, dan tampilkan tiket ambigu pada antrean review.
6. Job Category Installasi, Upgrade/Downgrade, Terminate dan klasifikasi pekerjaan layanan yang eksplisit merupakan bukti pekerjaan layanan. Customer/General/BOD/CrossConnect/tanpa kategori tetap dapat dideteksi, tetapi belum otomatis diklasifikasikan sebagai instalasi atau circuit customer aktif.
7. Kode sudah dikenal pada tepat satu layanan: tautkan tiket sumber yang layak secara idempotent. Kode belum dikenal: cari usulan layanan existing; penautan otomatis hanya untuk bukti yang unik, terverifikasi, tanpa konflik. Nama customer saja, kecocokan samar, atau nama terpotong yang belum terbukti bukan cukup.
8. Kode belum dikenal dan metadata belum lengkap: tampilkan kandidat, bukan membuat customer/produk/layanan fiktif. Untuk instalasi baru yang datanya lengkap, gunakan alur Asset + tiket yang sudah ada.
9. Tambahkan registry identifier yang menghubungkan kode utama/alias dengan satu Service. Kode I lama dan SAP baru hanya digabung setelah terbukti circuit yang sama. CID utama tetap `Service.cid`; alias dapat dicari pada Assets, pilihan CID, dan pencarian tiket. Tidak ada penggabungan dari kesamaan angka.
10. Produk, bandwidth, status, owner, scoring, downtime, dan umur tiket tidak diubah oleh deteksi/penautan. Kategori lama dan nomor EWO dipertahankan. Upgrade/Downgrade tetap memakai produk yang sama; deteksi kode tidak menerapkan perubahan Inventory.

## Alur pengguna

Tiket EWO masuk → baca Subject → kenali keluarga kode → periksa kelayakan sumber → cari kode utama/alias → tautkan jika unik dan layak; selain itu masuk **Penautan CID** dengan status **Perlu konfirmasi**, **Belum ada layanan**, atau **Konflik**.

Di Assets: **Customer → Layanan → CID utama + kode lama**. Pada contoh KEPANJEN, user melihat usulan `I-0275-021-01 → GIGA DIGITAL / OFFICE KEPANJEN`, sumber tiket, dan bukti nama/site sebelum konfirmasi.

## Kriteria penerimaan

- I-0275-021-01 dikenali tanpa mengubah ejaannya menjadi SAP.
- Trouble tidak menghasilkan layanan/CID baru, termasuk tiket legacy Unclassified yang berkategori Troubleshoot.
- Dua tiket dengan kode sama tidak membuat dua layanan; dua customer/site berbeda dengan kode sama menghasilkan konflik.
- Alias I/SAP hanya menaut ke satu layanan setelah konfirmasi; canonical maupun alias tidak boleh direbut layanan lain.
- Semua pencarian relevan menemukan layanan melalui kode lama maupun kode utama.
- Penautan tidak memanggil jalur Resolve/scoring dan mempertahankan Ticket.updatedAt.
- Migrasi dan backfill punya dry-run, snapshot, persetujuan daftar massal, serta rollback terarah.
