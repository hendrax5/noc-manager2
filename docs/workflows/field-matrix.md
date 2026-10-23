# Form dan workflow pekerjaan
Semua form mempertahankan EWO/referensi, PIC, department, Order Origin, Executing Vendor, lampiran dan audit.
| Operasi | Wajib | Resolve |
|---|---|---|
| Instalasi baru | Customer/CID terdaftar Pending, produk/kapasitas, tanggal efektif, hasil uji di fase Pengujian | Active |
| Trouble | minimal1 CID valid, gejala/penyebab, outage timestamps untuk SLA, tindakan/verifikasi | tutup outage per tiket |
| Upgrade/Downgrade | 1CID, produk tetap, kapasitas naik/turun, tanggal efektif | update kapasitas |
| Change | 1CID, produk tujuan/field wajib, tanggal efektif | update produk/data |
| Terminate | 1CID, alasan, tanggal efektif | Inactive |
Instalasi format lama tetap dibaca tanpa backfill fase. Fase bukan status; completion tidak otomatis Resolve.
Routing memakai identitas konfigurasi persis; tidak menebak perusahaan dari CID/customer.
Kategori fase otomatis, override memerlukan izin dan alasan. Assignment tidak memberi kredit.
