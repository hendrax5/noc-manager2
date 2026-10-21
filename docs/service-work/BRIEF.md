# Klasifikasi Pekerjaan Layanan

Status: rancangan disetujui melalui “ok kerjakan”; implementasi lokal dan verifikasi berlangsung. Produksi belum diperbarui.

Goal: Tim dapat memilah Trouble dan pekerjaan perubahan layanan dalam NOC Manager yang sama.
User and task: Operator NOC memilih jenis pekerjaan dan layanan/CID terkait saat mencatat tiket.
Deliverables: Menu Pekerjaan Layanan menggantikan Instalasi, master jenis pekerjaan, pencarian CID/customer, aksi Buat Tiket dari layanan, riwayat tiket per layanan, filter daftar/global dashboard, serta penyesuaian laporan tanpa menghitung ulang pekerjaan lama.
Lead: Jenis pekerjaan dan layanan/CID yang sedang ditangani.
Content reality: Data produksi; daftar kosong memiliki pesan jelas; pencarian tetap tersedia untuk banyak layanan; nama panjang membungkus. CID kosong ditampilkan sebagai belum tersedia, tidak diganti ID internal.
Irreversible: Tidak ada penghapusan atau klasifikasi ulang massal. Resolve pekerjaan layanan menerapkan perubahan Inventory secara otomatis sesuai persetujuan pengguna; tampilkan ringkasan sebelum/sesudah, simpan audit dan pastikan transaksi atomik. Reopen tidak otomatis membatalkan perubahan Inventory.
Theme: Ikuti app/globals.css dan komponen NOC Manager yang ada, termasuk mode yang telah didukung.
Platform floor: Next.js/React yang ada; target lebar 320px dan akses keyboard serta WCAG AA pada komponen yang diubah.
Out of scope: Aplikasi terpisah, perubahan nomor EWO otomatis, billing, dan migrasi heuristik tiket lama.

## Usulan dan asumsi

- Keputusan: Trouble tetap menu sendiri; Instalasi menjadi Pekerjaan Layanan dengan jenis awal Instalasi Baru, Upgrade, Downgrade, Perubahan Layanan, Terminasi. Admin dapat mengelola master pilihan.
- Keputusan terbaru (menggantikan permintaan reopen sebelumnya): Setiap EWO/pekerjaan baru dibuat sebagai tiket baru, termasuk Upgrade, Downgrade, Perubahan Layanan dan Terminasi. Semua terhubung ke layanan/CID terkait; tidak membuka kembali tiket instalasi untuk pekerjaan baru.
- Keputusan: Setiap pekerjaan menyimpan kondisi sebelum/sesudah dan tanggal efektif.
- Rancangan: Cari CID/customer → buka layanan → Buat Tiket → pilih jenis pekerjaan → isi perubahan → simpan tiket EWO baru. Customer, relasi layanan dan kondisi saat ini terisi dari Inventory, tetap divalidasi server dan mengikuti hak akses.
- Rancangan: Form Buat Tiket umum tetap tersedia dengan pencarian layanan yang sama. Pekerjaan layanan dan Trouble memakai sumber relasi CID yang sama; riwayat layanan menampilkan keduanya.
- Rancangan: Tiap tiket menyimpan jenis/snapshot nama, kondisi sebelum/sesudah, tanggal efektif, status, waktu buka/selesai, pelaku, dan layanan terkait. Permintaan yang belum selesai tidak boleh dianggap sebagai kondisi Inventory yang sudah berlaku.
- Rancangan: Daftar tiket tetap satu baris per EWO. Detail layanan memperlihatkan seluruh tiket secara kronologis dan dapat difilter jenis/status.
- Asumsi: Reopen tetap untuk koreksi pekerjaan yang sama; bukan jalur membuat pekerjaan baru. Kebijakan poin untuk reopen lama tidak diubah diam-diam.
- Asumsi: Trouble tetap tiket gangguan tersendiri yang tertaut CID, bukan reopen tiket induk layanan; jika berbeda, pemisahan durasi gangguan dan laporan perlu dirancang ulang.
- Keputusan: Hasil perubahan layanan otomatis diterapkan ke Inventory saat Resolve, tanpa aksi penerapan terpisah. Resolve dan perubahan Inventory harus satu transaksi; gagal memperbarui Inventory berarti tiket belum Resolve dan poin belum diberikan.
- Keputusan: CID sudah tersedia saat tiket Instalasi Baru dibuat. Satu customer dapat memiliki beberapa CID, masing-masing mewakili circuit layanan.
- Asumsi: Nomor CID adalah identitas circuit yang tetap saat Upgrade/Downgrade; user belum menyatakan nomor dapat diganti oleh pekerjaan ini. Perubahan nomor CID tidak termasuk otomatisasi tahap ini.
- Rancangan: Saat membuat tiket Instalasi Baru, pilih customer lalu pilih layanan/CID yang sudah ada atau daftarkan circuit baru dengan CID unik dalam proses yang sama, mengikuti permission Inventory. Jangan menduplikasi layanan yang sudah terdaftar.
- Rancangan: Simpan kondisi sebelum dari server dan kondisi tujuan pada tiket; perubahan yang diterapkan hanya field layanan yang secara eksplisit diminta, bukan seluruh salinan objek. Rekam siapa, kapan, serta tiket sumber perubahan.
- Asumsi: Tanggal efektif untuk tahap ini adalah tanggal pelaksanaan aktual dan tidak boleh berada di masa depan saat Resolve. Jika aktivasi terjadwal dibutuhkan, perlu rancangan antrean penerapan tersendiri.
- Rancangan: Jika Inventory telah berubah sejak permintaan dibuat, blok Resolve dengan informasi konflik dan minta operator meninjau kondisi sebelum/sesudah. Jangan menimpa perubahan tiket lain diam-diam.
- Rancangan: Resolve berulang tidak menerapkan perubahan atau memberi poin kembali. Reopen tidak mengembalikan Inventory otomatis. Terminasi mengubah status layanan tanpa menghapus CID maupun riwayat tiket.
- Asumsi: Tidak ada pembatasan baru satu tiket per customer atau CID; relasi tiket multilayanan yang sudah ada dipertahankan. Jalur dari halaman CID memulai form dengan satu layanan terpilih.
- Keputusan: Scoring berdasarkan Job Category serta reply/respons. Jenis pekerjaan adalah klasifikasi operasional yang berbeda, tidak menggantikan Job Category atau memberi poin tambahan otomatis.
- Asumsi: Nilai dan penerima poin existing dipertahankan. Kode saat ini memberi poin Job Category kepada penulis reply terakhir, fallback assignee; perubahan aturan ini memerlukan pembahasan terpisah.
- Asumsi: Dashboard dan Semua Tiket tetap global; salah asumsi ini akan mengubah navigasi yang sudah disetujui sebelumnya.
- Asumsi: Nomor EWO otomatis dan referensi SAP manual tetap; jika berubah diperlukan aturan penomoran baru.
- Asumsi: CID tetap per layanan/link dari Inventory, satu customer dapat memiliki beberapa CID; jika berubah relasi dan validasi harus dirancang ulang.
- Asumsi: Data dan formulir historis tetap dipertahankan; tidak mengubah klasifikasi tiket lama secara otomatis.
- Asumsi: SLA gangguan tetap berlandaskan durasi per tiket Trouble dan kompatibilitas tiket historis; downtime pekerjaan terjadwal memerlukan keputusan terpisah sebelum mengubah aturan SLA.

## Sumber teks dan CID yang terverifikasi

Teks “Pilih minimal satu layanan dengan CID, gejala, dan penyebab. Gunakan ‘Belum diketahui’ bila penyebab belum diketahui.” adalah petunjuk statis pada components/TicketWorkClassification.js, muncul ketika workType Trouble dipilih, bukan teks dari master atau Inventory.

CID dibaca oleh lib/services/cid.js dari Service.cid terlebih dahulu, lalu customData dengan alias CID/SID/id layanan/service id/Circuit ID. Tidak berasal dari nomor EWO atau ID customer. Penyebab Belum diketahui adalah pilihan master awal dan dapat dikelola Admin.

## Risiko integrasi yang wajib diverifikasi

Kode reopen yang ada menyimpan customData.reopenedAt, dan laporan TTR memakai nilai ini sebagai awal siklus terakhir. Jalur pekerjaan baru tidak boleh memanggil reopen, menyalin reply/poin, atau mengubah tiket lama. Aturan resolve saat ini dapat memberi poin baru setelah reopen; jangan mengklaim sudah mencegah poin ganda tanpa perubahan dan pengujian khusus.

## Jawaban lanjutan grill-me

1. CID adalah circuit layanan customer; satu customer dapat memiliki beberapa CID. Ketetapan nomor saat upgrade dicatat sebagai asumsi, bukan jawaban eksplisit pengguna.
2. Inventory diperbarui otomatis saat Resolve.
3. CID sudah tersedia saat membuat tiket Instalasi Baru.

Status persetujuan: pengguna menyetujui rancangan dan meminta implementasi melalui “ok kerjakan”, lalu “lanjutkan”.

## Rancangan input tiket

Satu form dengan bagian umum dan bagian sesuai jenis pekerjaan, menggunakan form lama serta custom fields yang ada. Masuk dari detail layanan mengisi relasi customer/CID otomatis; masuk dari Buat Tiket umum menyediakan pencarian yang sama.

1. Layanan dan pekerjaan: pilih/cari CID atau customer, tampilkan customer, CID, nama layanan dan kondisi Inventory saat ini; pilih jenis pekerjaan dari master. Instalasi Baru dapat mendaftarkan CID baru yang sudah diketahui, sesuai permission.
2. Detail sesuai jenis: Trouble menampilkan Gejala, Penyebab, waktu mulai/pulih dan durasi; Upgrade/Downgrade menampilkan kapasitas saat ini (baca saja), kapasitas tujuan, satuan serta tanggal efektif; Perubahan Layanan menampilkan field yang hendak diubah dan nilai sebelum/sesudah; Terminasi menampilkan alasan dan tanggal efektif; Instalasi Baru memakai template layanan dan data awal.
3. Penanganan umum: Subject, Message/Deskripsi, Priority, Department/Queue, PIC, Job Category, lampiran, referensi SAP opsional, serta custom fields yang relevan. Subject boleh disarankan dari jenis + CID tetapi dapat diedit; nama customer tidak diminta ulang sebagai field relasi kedua.
4. Resolve: ringkasan perubahan, hasil pekerjaan dan tanggal efektif aktual; perubahan Inventory serta poin disimpan hanya sekali setelah semua validasi lulus.

Asumsi: Ticket type ITIL lama tetap tersedia pada bagian lanjutan; tidak menghapus atau mengartikan ulang field tersebut sebagai jenis pekerjaan.
Asumsi: Custom fields lama dan nilainya tetap tersimpan. Penentuan tampil/wajib per jenis pekerjaan tidak boleh merusak validasi form lama; pemetaan baru harus eksplisit.
Asumsi: Kapasitas memakai nilai numerik dan satuan yang dinormalisasi; field kondisi awal diambil server, tidak dipercaya dari browser. Field Inventory yang dapat ditulis dibatasi daftar yang disepakati.
Asumsi: Input downtime tetap dipertahankan pada data historis; UI baru memusatkan input gangguan di Trouble dan tidak otomatis memasukkan pekerjaan layanan ke laporan downtime.

Keputusan input dari pengguna:
- Produk/layanan mencakup METRO-E, IPT, COMIX, HSPIX, IPLC dan pilihan lainnya, selain kapasitas bandwidth.
- Job Category disarankan otomatis melalui pengaturan Admin dan tetap dapat diganti user berizin. Nilai poin tetap bersumber dari Job Category, bukan jenis pekerjaan.
- Upgrade/Downgrade/Perubahan Layanan/Terminasi menangani tepat satu CID per tiket; Trouble tetap mendukung beberapa CID.

Rancangan produk: gunakan katalog/template layanan yang telah ada (ServiceTemplate) sebagai sumber pilihan; evaluasi data aktual sebelum menyimpulkan nama produk sudah tersedia. Jangan membuat katalog produk kedua secara otomatis. Bedakan label Jenis Pekerjaan, Produk/Layanan, dan Job Category pada form.
Rancangan perubahan produk: tampilkan produk saat ini dan pilihan produk tujuan; bila template tujuan memiliki field wajib berbeda, minta isian field tersebut sebelum Resolve. Pertahankan snapshot data lama dalam histori, jangan menghapus customData yang tidak dipetakan secara diam-diam.
Asumsi: Produk/layanan dan kapasitas merupakan lingkup perubahan awal. IP, VLAN, perangkat, lokasi dan biaya tidak diubah otomatis tanpa kebutuhan serta pemetaan eksplisit.
Asumsi: Mapping saran Job Category diatur per jenis pekerjaan, tanpa menimpa pilihan manual operator saat CID/produk diperbarui. Jika kategori nonaktif/tidak tersedia, minta pilihan yang valid sesuai aturan existing.

Done when: Kompatibilitas tiket dan EWO terverifikasi; pengujian reopen berulang, histori sebelum/sesudah, master nonaktif, ACL, filter, poin dan SLA serta build lulus; render desktop/mobile dan critique dilakukan terhadap layar yang berubah. Hasil aktual dan kendala build dicatat dalam ledger implementasi.
