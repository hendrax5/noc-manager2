# CID dari Subject tiket SAP

Status: scope dan arti CID dikonfirmasi pengguna; implementasi lokal dan pengujian berlangsung. Belum ada perubahan produksi.

Goal: CID pada Subject tiket SAP dapat ditautkan ke circuit dan ditampilkan pada Assets & Services tanpa mengetik CID ulang.
User and task: Operator mencari circuit dari tiket lama atau tiket EWO baru, lalu menggunakan circuit yang sama untuk Trouble dan pekerjaan layanan baru.
Lead: CID asli dari Subject, dengan riwayat seluruh tiket terkait.
Platform and theme: NOC Manager yang ada; pertahankan Dashboard, Semua Tiket, scoring, status dan nomor tiket.

## Scope dan aturan

- Hanya Subject SAP untuk tahap awal; contoh SAP-C-1243-0003. CID I-0666-004-01 dan non-SAP lain di luar scope.
- Untuk otomatisasi aman, terima Subject yang seluruh isinya merupakan token CID SAP (setelah trim dan normalisasi kapital). Subject SAP dengan teks tambahan memerlukan review, jangan dibuat sebagai circuit dengan nomor yang salah.
- Satu CID menjadi satu circuit; beberapa tiket dengan CID sama ditautkan ke circuit yang sama. Periksa field canonical dan alias CID legacy agar tidak duplikat.
- Jangan mengubah status, Job Category, scoring, downtime atau klasifikasi tiket lama sebagai efek impor Inventory.
- Nama reporter pada tiket sering menggabungkan customer dan site/link; jangan membuat satu customer untuk setiap teks gabungan tersebut.
- Produk, kapasitas dan status operasional layanan tidak boleh ditebak hanya dari Job Category/status tiket. Tiket SAP yang ditemukan juga mencakup Terminate dan Upgrade/Downgrade.

## Audit produksi read-only 2026-10-22

- Subject diawali SAP: 3509 tiket.
- Subject berbentuk token CID SAP lengkap: 3508 tiket.
- CID berbeda setelah normalisasi: 3395.
- Tiket kandidat yang sudah memiliki relasi Service: 0.
- Customer Inventory tersedia: 35; nama reporter kandidat yang cocok persis terhadap nama customer existing hanya 4 tiket.
- Katalog produk existing: IPLC, IEPL, METRO-E, IPT, OPEN PORT, DARKFIBER. Produk lain tetap dapat dikelola melalui katalog existing.

## Keputusan dan implementasi

Pengguna menegaskan angka SAP hanya urutan pekerjaan, bukan kode customer. Circuit customer adalah keseluruhan CID SAP. Satu customer dapat memiliki beberapa CID yang tidak berurutan.

- Assets menampilkan panel otomatis CID SAP dari tiket untuk Admin/manage_assets, dengan pencarian, pagination, sumber tiket, status pemetaan dan konflik.
- Customer dan produk dipilih eksplisit satu kali; tidak membuat customer/product placeholder atau menebak dari angka/nama prose. CID tidak diketik ulang.
- Pemetaan membuat Service hanya bila belum ada; CID canonical dan alias legacy diperiksa. Source tickets ditautkan atomik tanpa mengubah tanggal/status/poin tiket atau versi Inventory.
- Tiket baru dari web dan integrasi EWO ditautkan otomatis bila CID unik sudah memiliki Asset. CID yang belum dipetakan tetap terlihat pada daftar perlu dilengkapi; tidak membuat Asset tanpa owner/produk.
- Form Trouble sekarang menempatkan pencarian/pilihan CID paling awal, sebelum Gejala/Penyebab; pencarian gejala bersifat opsional, memiliki reset dan petunjuk ketika berisi CID.
- Pengelompokan lama ditampilkan read-only hingga pengelola menyimpan pemetaan. Tidak ada impor massal atau pengisian produk/customer yang tidak diketahui.

Done when: Pemetaan customer disepakati, preview dapat ditinjau, impor idempoten dengan audit/rollback, tiket baru SAP tertaut ke CID existing, non-SAP tetap utuh, serta hasil terlihat di Assets dan dapat dipakai membuat Trouble.
