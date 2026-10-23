# Workflow pekerjaan dan evaluasi bulanan
Tanggal 23 Oktober 2026. Rancangan untuk review; belum implementasi.

## Kebutuhan
Tetap dalam NOC Manager; Dashboard, Semua Tiket, EWO, form instalasi lama dan riwayat dipertahankan. Jenis pekerjaan langsung dari master Admin, form dan fase mengikuti pekerjaan.
- Instalasi Baru: Customer, CID baru tersedia saat create, produk, kapasitas, jadwal, EWO dan hasil pengujian; aktifkan Inventory saat Resolve.
- Trouble: satu/beberapa CID, gejala/penyebab standar, mulai/pulih, tindakan/verifikasi. Durasi SLA per tiket; filter >10 jam tidak menjumlah kejadian berbeda.
- Upgrade/Downgrade: satu CID, produk tetap, kapasitas lebih besar/kecil. Perubahan Layanan dapat mengganti produk. Terminasi wajib alasan dan menonaktifkan layanan.
- Order pekerjaan baru mendapat tiket baru, bukan reopen instalasi. Reopen untuk koreksi pekerjaan sama tetap tersedia.
- Resolve menerapkan Inventory atomik, idempoten, before/after dan tanggal efektif tersimpan; cegah snapshot usang.
- Customer ID identitas customer; CID identitas circuit; produk milik layanan. Tidak menebak company dari prefix ION-CUST/CID.
- Order Origin dan Executing Vendor tetap terpisah memakai Multi-Company Routing Identities existing. Routing order baru tidak diam-diam menyalin tiket lama.
- Fase/Job Category otomatis mengikuti pekerjaan yang di-assign. Mapping Admin default dan khusus company; override berizin dengan alasan/audit. Assignment tidak menghasilkan poin.
- Daily Report memakai tiket bulanan per orang sebagai arsip; laporan harian terstruktur menjadi reply di tiket tersebut. Aktivitas tiket menjadi referensi otomatis; pekerjaan di luar tiket manual.
- Staf akses sendiri; Manager tim/company yang ditugaskan; pimpinan scope eksplisit. Nama role saja tidak membuka semua perusahaan.
- Penilaian semua departemen kecuali Administrasi, General, Admin-Teknis. Ketiganya tetap bekerja/melapor, tetapi tidak masuk nilai, ranking dan agregat evaluasi.
- Kontribusi milik pelaksana; tidak menggandakan kredit aktivitas tiket dalam Daily Report; kualitas tidak berdasarkan jumlah reply.
- UI ringkas berupa tabel/filter dan detail saat dibuka. Periode Asia/Jakarta.

## Keputusan rancangan
Template simulasi hasil40%, kualitas30%, ketepatan waktu20%, pelaporan10%; bukan bobot resmi yang telah disetujui. Target/rubric khusus departemen dan peran ditentukan dalam pilot. Tanpa target/data sah tampil Belum cukup data, bukan nilai0.
Fase terpisah dari status tiket. Fase awal: instalasi Persiapan/Pemasangan/Pengujian; Trouble Investigasi/Penanganan/Verifikasi; perubahan Persiapan/Pelaksanaan/Verifikasi; terminasi Validasi/Pemutusan/Penutupan.
Tiket laporan memakai purpose terpisah, bukan menambah workType yang mengganggu Trouble/ServiceWork.
Versi aturan dan hasil bulanan terkunci; koreksi beralasan menyimpan versi lama. Bulan pertama simulasi berdampingan poin lama; aktivasi resmi setelah review dan persetujuan kebijakan.
Cuti/jadwal efektif/waktu tunggu eksternal hanya dipakai bila tercatat dan tervalidasi, tidak ditebak dari reply.

## Batas
Tidak mengubah poin historis, ownership customer/CID/company, payroll atau menghapus data lama. Tidak mengirim notifikasi eksternal. Tidak otomatis menerbitkan KPI semua departemen.
