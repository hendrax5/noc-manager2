# Redesign instalasi dan ringkasan kapasitas layanan

Status: rancangan + mockup interaktif; belum mengganti deployment bce258b. Scope mengikuti klarifikasi screenshot23Oct2026. Tidak mengubah routing sister company, Customer ID, scoring, Trouble, atau lifecycle BOD.

## Kontrak data dan alur
Customer (ION-CUST) memiliki banyak Service/Circuit. Satu circuit memiliki satu CID utama, satu produk/master layanan, satu bandwidth berlangganan, satu status. Tiket mereferensikan circuit; jumlah tiket tidak menambah jumlah CID. Alias circuit bukan circuit tambahan. Tipe produk milik layanan, bukan customer.

Instalasi baru: pilih/tambah Customer → isi satu Circuit ID → site → Produk/Layanan → satu Bandwidth Gbps → RFS → Subject/Message → Department/PIC → buat tiket. Reference SAP terpisah dihapus pada form baru karena pengguna mengonfirmasi identik dengan Circuit ID. Nilai historis sapReference tidak dihapus atau dipaksakan menjadi CID bila berbeda. Subject dapat disarankan dari CID dan tetap dapat diedit.

Input bandwidth tunggal memiliki preview konversi read-only, contoh0.1Gbps=100Mbps. Penyimpanan canonical tetap Mbps (customData.bandwidthMbps) agar kompatibel. Semua validasi dan laporan membaca canonical source yang sama. Field template Bandwith/Bandwidth/Kapasitas dan alias dikenali semantik, bukan sekadar regex nama exact. Field required bandwidth terpenuhi oleh canonical value tanpa meminta input kedua. Field lama tanpa unit tidak ditebak menjadi Mbps/Gbps dan tidak dihapus. Detail produk lain hanya ditampilkan jika relevan/wajib, bukan input bebas tambahan.

## Customer picker
Satu combobox: saat terbuka menampilkan maksimal10 saran, ketik nama PT/CustomerID untuk hasil maksimal10. Nama dan CustomerID ditampilkan terpisah. Input teks tidak sah sebagai ID sampai opsi dipilih. ArrowUp/Down, Enter, Escape, focus/blur, selected-invalidated-on-edit, loading, retry, kosong, tambah customer baru, dan duplikasi customer ditangani.

Definisi frekuensi: pilihan customer berhasil pada tiket oleh pengguna dalam30hari; jangan menyebut customer paling banyak circuit sebagai paling sering dicari. Sebelum ada histori pilihan, tampilkan saran fallback yang dilabeli sesuai sumber (terakhir digunakan), bukan angka pencarian rekaan. Simpan event pemakaian hanya bersama transaksi tiket berhasil; batal/validasi gagal tidak menambah hit. Endpoint picker terautentikasi, q dibatasi, debounce250ms, abort request lama, limit10, hanya id/name/code; jangan kirim seluruh registry ke browser untuk dropdown ini.

## Ringkasan layanan di Customer & Layanan
Tambahkan tab Ringkasan Layanan; pertahankan Daftar Circuit dan Customer Registry.
Kolom: Produk/Layanan, Customer unik, Circuit/CID unik, Total bandwidth Gbps, BW belum lengkap, Lihat Circuit. Default status Aktif; Pending/Terminated dipilih eksplisit. Filter perusahaan menggunakan metadata routing terverifikasi, bukan awalan ION-CUST/CID. Unknown punya bucket Belum dipetakan. Scope/RBAC sama dengan Inventory saat ini.

IP Transit (IPT) dan alias produk lain dipetakan melalui master produk canonical yang dikonfirmasi Admin; tidak menggabungkan tipe hanya karena nama mirip. Perubahan Layanan memindahkan circuit ke grup produk tujuan saat Resolve. Upgrade/Downgrade mengganti bandwidth canonical saat Resolve. Terminasi keluar dari default Aktif. Instalasi Pending masuk default Aktif setelah Resolve. BOD sementara tidak menambah kapasitas berlangganan: ambil normalBandwidthMbps saat BOD aktif; bila perlu kapasitas operasional ditampilkan sebagai metrik berbeda yang jelas.

Hitung COUNT circuit unik dari Service.id dengan CID valid, bukan COUNT tiket atau alias; customer unik COUNT customerId per grup, sehingga jumlah customer antar grup tidak dijumlahkan menjadi customer unik global. SUM canonicalMbps/1000 memakai numeric/decimal untuk menghindari float drift. Nilai unknown tidak dianggap0; tampilkan jumlah data unknown dan label total bandwidth diketahui. Circuit tanpaCID ditampilkan terpisah sebagai perlu penautan. Detail hasil memakai filter identik dan total dari seluruh hasil, bukan halaman10/25baris. Tidak menjumlahkan paginated rows untuk header.

## Langkah implementasi berurutan
1. RED regression dari template nyata Open Port yang memuat required Bandwith, lebih dari10customer, SAP/CID ganda, dan unit ambiguity. Tambahkan uji server round-trip0.1Gbps=100Mbps, required-field semantics, existing aliases conflict.
2. Shared field semantics/units helper dipakai InstallationFields, ServiceWorkFields, installation.js, serviceWork.js, dan capacity reader. Hapus SAP baru di TicketWorkClassification; pertahankan metadata historis. Tidak hard-delete field template lama.
3. Customer picker endpoint terautentikasi + ranking/histori penggunaan + combobox ID-bound. Registrasi customer/circuit tetap atomik. Uji stale responses, keyboard, queryPT/name, empty/error/retry, add-customer duplikat.
4. Report service portfolio selector/API ter-scope. Uji200CID IPT=500Gbps, multi-ticket satuCID, CIDaliases, unknownBW, mixedunits, Active/Pending/Terminate, Upgrade/Downgrade/Change, activeBODnormal, perusahaan terpisah, numeric precision, pagination totals.
5. Integrasikan tab ringkasan dan drilldown ke Assets yang ada; tabel rapat, tanpa kartu dekoratif berulang, form dua kolom desktop/satu kolom mobile. Semua controls minimal44px dan fokus terlihat. Bawa upload lama; mockup fokus bagian yang berubah.
6. Taste-code-review enam pass: behavior→structure→taste→security→performance→accessibility. Render Instalasi pada setiap template aktif, khususnya template dengan field legacy; screenshot desktop/mobile; axe dan keyboard. Jangan hanya screenshot BOD atau fixture fields kosong.
7. Setelah rancangan disepakati: additive migration bila diperlukan untuk histori picker/master mapping, rehearsal database terisolasi, Linux build, backup produksi, smoke read-only, compatible rollback mempertahankan BOD/privacy guard. Jangan mengganti image/database produksi sebelum rilis terverifikasi.

## Verifikasi mockup
Mockup terpisah sebagai artefak desain, tetap menampilkan layout menu NOC Manager. Bukan aplikasi baru/deployment baru. Data simulasi: IPT200CID/500Gbps; Metro80CID/100Gbps; COMIX40CID/120Gbps. Browser assertion untuk agregasi/filtercompany/top10/query/keyboard/empty/singleCID/singleBW/submit; axe dan375px tanpa overflow lolos. Ini tidak membuktikan API/data produksi sudah diperbaiki.
