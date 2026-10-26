# Laporan gangguan per tiket

Lokasi: **Laporan → Gangguan & SLA → Gangguan per tiket** (`/reports/sla`).
Tab **SLA periodik** mempertahankan laporan SLA sebelumnya. Fitur ini menggunakan
login dan hak akses laporan yang sama: Admin, Manager, atau `view_reports`.
Tidak memerlukan migrasi database.

## Penggunaan

1. Pilih rentang tanggal **mulai gangguan**, dalam WIB.
2. Isi nama customer, kata penyebab, atau nomor tiket/nama layanan/link bila perlu.
3. Pilih operator durasi dan jumlah jam **per tiket**, serta status gangguan.
4. Tekan **Terapkan filter**. Tombol **Isi kriteria FO CUT >10 jam** mengisi
   kriteria; tekan Terapkan untuk menjalankannya.
5. Gunakan **Ekspor CSV**, atau **Pratinjau laporan → Cetak / Simpan PDF**.

Perubahan kriteria belum diterapkan sampai tombol Terapkan ditekan. Hasil, CSV,
dan laporan cetak selalu menggunakan kriteria hasil pencarian terakhir.

## Aturan data

- Satu baris adalah satu tiket. Tiket 4 jam dan 7 jam tidak digabung menjadi
  11 jam untuk filter >10 jam. `>10` mengecualikan tepat 10 jam; `≥10` memasukkannya.
- **Filter Customer atau CID memecah tiket multi-CID menjadi satu baris per CID yang cocok.** Baris hanya menampilkan layanan/CID tersebut, sehingga laporan per customer/CID tidak pernah menampilkan circuit pelanggan lain atau CID lain pada tiket yang sama. Tanpa filter, tiket tetap satu baris dengan semua CID-nya.
- Filter **CID / layanan** mencocokkan kode CID atau nama layanan; hasilnya satu baris untuk CID itu saja.
- Laporan tidak menampilkan kolom pengguna/PIC; isinya hanya tiket, customer, layanan/CID, waktu, penyebab, tindakan, dan status.
- Durasi memakai helper downtime tiket yang sama, dari `customData.startDowntime`
  sampai `endDowntime`. Durasi penuh tetap dipakai jika kejadian selesai di luar
  periode terpilih. Tiket tanpa waktu mulai/selesai valid dilewati dengan catatan.
- Tanpa waktu selesai, durasi dihitung sampai satu waktu pembuatan laporan
  (`generatedAt`). Status gangguan berbeda dari status alur tiket.
- Customer berasal dari layanan terkait atau field customer tiket lama. Tiket
  tanpa customer tetap tampil pada semua customer, tetapi tidak menambah jumlah
  customer tercatat. Satu tiket dengan beberapa layanan tetap satu baris.
- Penyebab memprioritaskan field `causeCode`, `rootCause`, `problemCause`,
  `Penyebab`, `Penyebab Gangguan`, `Problem Cause`, atau `Root Cause`.
  Jika belum ada, pencarian memakai judul/deskripsi dan ditandai demikian.
  Pencarian teks ini bukan klasifikasi penyebab terverifikasi; FO-Cut dan FO CUT
  dianggap sama, tetapi arti isi teks tetap perlu diperiksa pada tiket sumber.
- Tindakan memakai `correctiveAction`/`correctiveActions`, atau komentar publik
  terakhir. Catatan internal tidak disertakan ke laporan cetak.
- Laporan ini tidak menghitung availability SLA dari daftar yang difilter.
  Availability tetap berada di tab laporan SLA periodik yang sudah ada.
- API membaca tiket dengan flag `hasDowntime=true`, lalu memeriksa timestamp
  JSON menggunakan parser WIB yang sama. Tidak memakai tanggal dibuat/update
  tiket untuk memilih kejadian. Pada volume sangat besar, pertimbangkan kolom
  timestamp terindeks dan paginasi server untuk mengurangi pembacaan data.

## Verifikasi

```powershell
node --test lib/reports/outageReport.test.mjs
node scripts/test_outage_report_api.cjs
node scripts/test_outage_report_ui.cjs
```

Dua skrip terakhir membutuhkan esbuild dan Playwright pada lingkungan pengujian;
pengujian browser memakai Chrome lokal. Dependensi tersebut tidak diperlukan
oleh fitur di produksi. Tes API menggunakan dependency terisolasi, dan tes UI
merender komponen sesungguhnya dengan data simulasi. Keduanya tidak menggantikan
uji E2E dengan login dan database deployment.
