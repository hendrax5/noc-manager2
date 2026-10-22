# Customer & layanan: redesign operasional

Status: usulan desain untuk direview. Baseline kode e5a364c; tidak ada perubahan produksi dalam pekerjaan perencanaan ini.

## Tujuan dan arah

Tim NOC harus dapat menemukan customer/CID, mengenali status layanan, dan membuat tiket tanpa membaca penjelasan panjang atau membuka banyak kotak. Arah: konsol operasional datar dan ringkas; tetap berada di NOC Manager.

Domain: operasi NOC. Pengguna: NOC/CS/Admin. Karakter: presisi dan tenang. Motion: perubahan hover/focus saja, tanpa lift/transform. Layout: judul singkat, navigasi Assets, toolbar pencarian/filter, daftar customer datar, detail layanan inline, pagination. Acuan: enterprise data console dengan identitas ION yang sudah ada; tidak membawa warna biru atau font baru dari contoh skill.

## Audit baseline

| Prioritas | Bukti pada kode | Dampak | Keputusan desain |
|---|---|---|---|
| Major | CustomerServiceInventory membungkus customer dalam .group dengan border/radius/margin, lalu tabel dan tombol tambahan di dalamnya | Banyak kotak yang serupa dan area vertikal terbuang | Satu permukaan daftar, customer berupa baris dengan pemisah netral |
| Major | aria-expanded dan render detail memakai `search || expanded[id]` | Detail tidak dapat ditutup selama pencarian aktif | Pencarian satu hasil membuka customer sekali; aksi tutup tetap berfungsi |
| Major | Ringkasan memakai matches.length bersama services.length global | Jumlah customer dan layanan berasal dari lingkup berbeda | Kedua jumlah berasal dari hasil query+filter, sebelum pagination |
| Major | Tidak ada filter terstruktur status/produk | Meninjau layanan Pending membutuhkan pencarian teks | Dua combobox terlabel Tipe layanan dan Status layanan |
| Minor | CID, nama site, kode lama, status dan beberapa link memiliki bobot mirip | Sulit memindai tabel layanan | CID monospace; site teks utama; alias teks sekunder; aksi ringkas |
| Minor | Header berisi kalimat instruksi dan beberapa tombol tab berbentuk kotak | Tampilan terasa seperti template | Judul Customer & layanan, tanpa paragraf pengantar; navigasi tab datar |
| Minor | CSS Modules berisi nilai berulang/inline dan efek translateY pada :active | Tidak konsisten dan menambah gerakan yang tidak membantu | Pakai token semantik bersama; feedback lewat warna/fokus |
| Enhancement | page.js masih memuat seluruh data, sedangkan pagination hanya membatasi render | Pagination bukan optimasi payload | Tetap client-side untuk rilis ini; jangan mengklaim pagination server. Backend pagination menjadi pekerjaan terpisah |

Audit ini berbasis kode lokal versi e5a364c dan screenshot fixture komponen dari rollout sebelumnya, bukan pemeriksaan visual baru pada sesi produksi terautentikasi. Tidak memberikan skor estetika/kontras/performa yang belum diukur.

## Susunan layar yang dituju

```text
Customer & layanan                                  Tambah layanan
Customer & layanan | Registry | Penautan CID | Produk | Analisis dampak

Cari nama customer, Customer ID, atau CID
[ pencarian                                      ] [Tipe layanan] [Status layanan] Reset
23 customer · 45 layanan

Nama customer                              Customer ID         Layanan    Pending
▸ Customer A                               ION-CUST-000040       8          3
▾ Customer B                               ION-CUST-000308      13          0
    CID                 Site             Tipe     Kapasitas   Status layanan   Aksi
    SAP-C-0049-0005     OFFICE BOGOR      INTERNET belum diisi Aktif            Detail  Buat tiket
    C-1262-01-01        SUNTER            INTERNET belum diisi Aktif            Detail  Buat tiket
▸ Customer C                               ION-CUST-000036       4          1

Menampilkan 1–25 dari 620 customer                   Sebelumnya  1/25  Berikutnya
```

Angka dan nama pada sketsa adalah ilustrasi, bukan baseline data untuk migration atau acceptance jumlah produksi. Pending adalah status layanan, bukan status tiket atau bukti gangguan.

## Perilaku rinci

1. Pencarian case-insensitive atas nama customer, Customer ID, CID utama, alias CID, nama site, dan tipe layanan. Tidak mencocokkan customer dari angka/prefix CID.
2. Jika nama/Customer ID cocok, seluruh layanan customer menjadi kandidat; jika hanya CID/site/tipe cocok, hanya layanan cocok yang tampil. Filter produk/status diterapkan sesudah pencarian. Customer tanpa layanan tetap terlihat pada pencarian customer ketika filter Semua aktif.
3. Tipe layanan memakai ID template dengan opsi Semua tipe. Status layanan memakai nilai asli Active, Pending, Suspended, Terminated serta Semua status. Label Indonesia: Aktif, Pending, Ditangguhkan, Terminasi. Tidak mengubah nilai database. Badge tidak selalu berbentuk pill dan tidak hanya mengandalkan warna.
4. Semua customer awalnya tertutup. Maksimal satu customer terbuka. Saat query/filter berubah dan tepat satu customer cocok, buka customer itu; pengguna tetap dapat menutupnya. Jika hasil lebih dari satu, jangan otomatis membuka semuanya. Klik ulang customer menutupnya.
5. Pagination customer 25 per halaman. Query/filter/reset mengembalikan page=1. Perubahan data yang membuat page di luar rentang harus clamp. Customer yang terbuka di luar halaman/filter ditutup. Ringkasan selalu memakai total filtered customers dan filtered services, bukan jumlah pada halaman atau jumlah global.
6. Reset mengosongkan query, mengembalikan tipe/status Semua, page=1, dan menutup detail; fokus tetap pada tombol Reset. Empty state menawarkan Reset filter. Belum ada layanan menjelaskan bahwa customer valid tetapi belum punya circuit.
7. Aksi layanan terdiri dari link Detail dan disclosure Buat tiket berisi Trouble dan Pekerjaan layanan. URL memakai service.id yang tepat; CID alias tetap menuju canonical service yang sama. Tidak membuat tiket saat sekadar memilih link. Layanan tanpa CID menampilkan CID belum tertaut dan, hanya untuk canManage, Tautkan CID; tidak menyediakan shortcut pembuatan tiket sampai CID tersedia.
8. Tidak menyimpulkan status Active dari tiket Resolved. Tidak mengubah Pending hasil impor. Tidak menebak tipe, kapasitas, customer pemilik, atau routing company. Kapasitas kosong berlabel Belum diisi, bukan nol.
9. Company ION/SDC/Sistercompany/Indotel/PRODC tetap mengikuti Multi-Company Routing Identities dan metadata tiket. Tidak menambahkan filter company semu ke data Service yang belum mempunyai relasi tersebut. Executing Vendor bukan customer pemilik.
10. Detail/history, /assets/new, Registry, produk, analisis dampak, #sap-circuits/#circuit-candidates, dialog penautan yang sudah bekerja, Dashboard, Semua Tiket, form instalasi lama, scoring dan SLA tetap tersedia. Tidak mendesain ulang subsistem itu pada rilis ini.

## Visual dan aksesibilitas

- Satu permukaan daftar, tanpa kartu per customer, kartu ringkasan/KPI dekoratif, gradient, emoji, ilustrasi, atau bayangan pada baris.
- Judul halaman 28px pada mobile, 32px pada desktop. Font isi mengikuti --font-sans aplikasi; ID mengikuti --font-mono. Teks isi/aksi minimal 14px, metadata minimal 12px. Jangan unduh font atau paket ikon baru.
- Customer row desktop memiliki tinggi minimum 52px; tingginya bertambah untuk nama panjang. Kontrol utama minimal 44px. Batas radius kontrol 6px; pemisah tabel netral 1px. Tidak memakai border aksen pada satu sisi.
- Mobile-first: di bawah 768px customer menjadi baris bertumpuk tanpa frame kartu; kolom site/CID/produk/status tetap terbaca. Detail menggunakan daftar semantik bertumpuk pada mobile dan tabel pada desktop; render salah satunya sesuai CSS tanpa membuat ID duplikat/fokus ke elemen tersembunyi. Pada >=768px gunakan tabel layanan.
- Semua warna, spacing, radius, ukuran, dan durasi baru berasal dari token bersama di app/globals.css. Tema light/dark menggunakan data-theme aplikasi. Scoped CSS hanya var(token), layout unitless, atau media breakpoint 48rem yang didokumentasikan.
- Fokus tombol customer terlihat; aria-expanded sesuai state nyata dan aria-controls menunjuk panel yang ada/hidden. Pengguna keyboard dapat membuka, menutup, memilih filter, membuka aksi tiket, Escape menutup disclosure dan mengembalikan fokus.
- Delapan state sesuai komponen: default, hover, focus, active, disabled, loading jika async, error jika input/fetch, selected jika selectable. Data awal sudah server-loaded; tidak membuat loading animasi palsu pada filter lokal.
- QA target: contrast light/dark dan hover/focus nyata, axe tanpa serious/critical serta kegagalan AA, tanpa overflow halaman pada 280/320/414/768/1440, keyboard, reduced motion. Screen reader dan 400% zoom manual dicatat terpisah, tidak diasumsikan lulus dari axe.

## Batas teknis dan rilis

Next.js/React, CSS Modules, Prisma/PostgreSQL yang sudah ada. Tidak ada dependensi baru. Tidak ada schema migration, backfill, merge customer, perubahan service/customer ID, atau perubahan payload API lama. Pure selector memberi semantik pencarian/filter/count; komponen presentasi kecil menangani customer row, service list, dan disclosure aksi.

Rilis terpisah setelah rencana disetujui: build image dari baseline aktif yang diperiksa ulang, pg_dump terverifikasi, simpan image/compose rollback, smoke read-only terautentikasi lokal/domain, cek data dan routing. Jangan restore database untuk rollback UI; rollback adalah pergantian image aplikasi. Jangan menjalankan startup schema push yang mengizinkan kehilangan data.
