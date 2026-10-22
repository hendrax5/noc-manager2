# Customer & layanan redesign: QA implementasi

Baseline: e5a364c. Implementasi sesuai spec dan plan 2026-10-22-customer-services-redesign, dengan ledger terpisah; plan tidak diedit.

## Bukti pengujian target

- `node --test lib/customers/serviceInventoryView.test.mjs lib/customers/identity.test.mjs lib/services/cidLookup.test.mjs`: 10/10 PASS.
- `test_customer_inventory_redesign_ui.cjs`: PASS pencarian alias/Customer ID, filter, hitungan scope, single disclosure/collapse, Reset termasuk fokus dari empty state, page clamp setelah props berubah, role/no-CID guard, URL tiket, keyboard Escape/Space, status legacy, kapasitas kosong/nol, nama panjang dan reflow.
- `test_customer_assets_ui.cjs`, `test_sap_assets_ui.cjs`, `test_service_work_ui.cjs`, `test_ticket_classification_ui.cjs`: PASS. Seluruh browser test menggunakan fixture sintetis, tanpa mutasi produksi.
- Axe WCAG A/AA: 0 violations pada state yang diuji: expanded light/dark, mobile, combobox terbuka, filtered-empty dan disclosure aksi terbuka.
- Harness diekspor dari DOM komponen asli: measure_render memeriksa 67 elemen teks light/dark, seluruhnya lulus gate AA; verify_states memeriksa 105 element-state default/hover/focus pada masing-masing tema, lulus.
- verify_responsive: tidak ada overflow halaman pada 280/320/414; suite browser juga memeriksa 768/1440. verify_mobile_first: base layout lulus320 tanpa width media/container queries.
- lint_hardcodes: 5/5 candidate changed files dipindai, tanpa nilai hardcoded yang terdeteksi. Nilai token berada di app/globals.css. Full app ESLint dan git diff --check PASS.
- Screenshot normal/stress light/dark/mobile berada pada direktori artefak task `customer-services-redesign`; screenshot normal dan stress mobile ditinjau visual.

## Temuan yang diperbaiki

Kontras muted text pada page background gagal pada pengujian awal; diperbaiki dengan token --asset-muted yang berbeda untuk light/dark. Target tautan disclosure terbuka gagal target-size; ditambah min-height token44px. Fresh reviewer menemukan fokus Reset dari empty state hilang saat tombol unmount; sekarang mengarah ke toolbar Reset yang stabil, dan regression eksplisit menguji tombol Reset terakhir. Reviewer memeriksa perbaikan dan tidak menemukan Important issue tersisa.

## Keputusan implementasi

Helper kapasitas existing menolak nol sebagai kapasitas operasional valid. Presentasi menampilkan hanya canonical bandwidthMbps yang eksplisit numeric/string0 sebagai `0 Mbps`, tanpa mengubah helper validasi atau data Inventory. Null/unknown tetap `Belum diisi`. Customer ID dan service.id tidak dibentuk dari kode CID.

Native summary pada disclosure diuji melalui elemen summary visible, bukan menambahkan role menu/button palsu. Desktop table dan mobile list tidak membuat ID duplikat; hanya layout yang terlihat masuk aksesibilitas/fokus.

## Batas klaim

accuracy_report kit global dijalankan dengan DS_REQUIRE_BROWSER=1, dibatasi45detik dan dihentikan bersama child process. Tidak tersedia hasil akhir N/N; bukan kelulusan kit global atau aplikasi. Gate target di atas dijalankan terpisah dan selesai. Log tersimpan di artefak, tidak dimasukkan sebagai klaim PASS global.

NVDA/VoiceOver, manual zoom400% serta peninjauan forced-colors secara visual belum diverifikasi. Reflow viewport sempit bukan klaim bahwa seluruh pengujian screen reader/zoom manual lulus. Tidak ada klaim peningkatan Core Web Vitals atau pagination server. Tidak ada migration, backfill, perubahan API, scoring, SLA, routing company atau isi customer/layanan.

## Rilis

Build Linux, backup terverifikasi, baseline image aktual dan rollback.sh diperlukan sebelum aktivasi. Smoke read-only lokal/domain dan hasil counts dicatat pada ledger/release server setelah deploy; dokumen ini tidak mengasumsikan hasil deploy sebelum verifikasi dijalankan.
