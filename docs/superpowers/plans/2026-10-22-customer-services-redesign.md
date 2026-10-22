# Customer & Layanan Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah Customer & layanan menjadi daftar operasional datar dengan pencarian/filter yang benar, detail layanan ringkas, dan shortcut tiket yang jelas tanpa mengubah data.

**Architecture:** Pertahankan /assets, API, dan props data yang sekarang. Pisahkan selector pencarian/filter/pagination yang pure dari komponen customer row, daftar layanan, serta disclosure aksi tiket; AssetClient tetap menjadi shell yang mempertahankan tab lama. Rilis ini memakai pagination client-side dengan shared semantic tokens, bukan endpoint/payload baru.

**Tech Stack:** Next.js/React existing, CSS Modules, CSS variables, node:test, esbuild/Playwright/axe-core dari lingkungan pengujian existing; Prisma/PostgreSQL tidak dimodifikasi.

**Spec:** docs/superpowers/specs/2026-10-22-customer-services-redesign.md

## Global Constraints

- Tetap berada di NOC Manager; tidak membuat aplikasi/web baru.
- Tidak ada dependensi baru.
- Tidak ada schema migration, backfill, merge customer, perubahan service/customer ID, atau perubahan payload API lama.
- Pagination customer 25 per halaman. Query/filter/reset mengembalikan page=1.
- Maksimal satu customer terbuka. Pengguna tetap dapat menutup hasil tunggal selama pencarian aktif.
- Company ION/SDC/Sistercompany/Indotel/PRODC mengikuti Multi-Company Routing Identities dan metadata tiket; Executing Vendor bukan customer pemilik.
- Tidak menyimpulkan status Active dari tiket Resolved; tidak mengubah Pending hasil impor atau menebak tipe/kapasitas.
- Satu permukaan daftar, tanpa kartu per customer, KPI dekoratif, gradient, emoji atau bayangan baris.
- Judul 28px mobile/32px desktop; teks isi/aksi minimal 14px, metadata minimal 12px; kontrol utama minimal 44px; customer row desktop minimum 52px; radius kontrol 6px; breakpoint desktop 768px/48rem.
- Semua warna, spacing, radius, ukuran, dan durasi baru berasal dari token bersama di app/globals.css; kedua tema memakai data-theme existing.
- Registry, produk, analisis dampak, dialog penautan, hash lama, Dashboard/Semua Tiket, form instalasi lama, scoring dan SLA tetap tersedia.
- Tidak menjalankan deploy sebelum implementasi, review, pengujian dan persetujuan eksekusi rencana selesai.

## Review Focus

- Pencarian alias/case/Customer ID yang cocok ke beberapa customer tidak boleh menggabungkan customer atau mengubah service.id; diuji Task 1.
- Filter menghasilkan nol layanan atau customer tanpa layanan: hitungan, empty state dan Reset harus sesuai scope; diuji Task 1 dan 2.
- Query aktif dengan satu customer: tombol tutup harus benar-benar menutup, juga setelah pagination/data berubah; diuji Task 2.
- Nama/site/CID panjang, kapasitas kosong, dan banyak layanan pada 280px/dark mode: informasi tetap dapat dibaca tanpa overflow halaman; diuji Task 3 dan 5.
- Role tanpa manage_assets dan layanan tanpa CID: tidak menawarkan tindakan pengelolaan/pembuatan tiket yang tidak valid, tanpa mengubah pemeriksaan izin server; diuji Task 4 dan 5.

---

## File Structure

Create `lib/customers/serviceInventoryView.js` dan `.test.mjs`: pure view-model, tanpa akses DB/React.

Create `app/assets/CustomerInventoryRow.js`: satu baris customer + controlled detail panel.

Create `app/assets/CustomerServiceList.js`: presentasi layanan desktop/mobile, capacity dan status copy.

Create `app/assets/ServiceTicketActions.js`: disclosure aksesibel dua shortcut tiket.

Modify `app/assets/CustomerServiceInventory.js`: query/filter/page/expanded state, toolbar dan hasil selector; tidak memegang markup setiap layanan.

Modify `app/assets/customer-services.module.css`, `assets-ui.module.css`, `AssetClient.js`, dan `app/globals.css`: tokens, visual daftar dan shell.

Modify `scripts/test_customer_assets_ui.cjs`; create `scripts/test_customer_inventory_redesign_ui.cjs`: regression lama dan skenario baru memakai API sintetis; tidak menulis produksi.

## Task 1: Pure inventory selector dan semantik hitungan

**Files:** Create `lib/customers/serviceInventoryView.js`, `lib/customers/serviceInventoryView.test.mjs`.

**Interfaces:**
- Consumes: existing `formatCustomerId(customer)`, `getServiceSearchText(service)`, `getServiceCid(service)`.
- Produces: `selectServiceInventory({customers,services,query='',templateId='',status='',page=1,pageSize=25}) -> {groups,customerCount,serviceCount,page,pageCount}`. `groups` hanya halaman aktif, setiap item `{customer,services,totalServiceCount,pendingCount}`. `services` adalah layanan hasil query+filter; totalServiceCount seluruh layanan customer. Filter templateId dibandingkan melalui String(service.templateId ?? service.template?.id). pageCount minimal 1, page clamp ke rentang. PendingCount jumlah Pending pada services yang tampil.

- [ ] **Step 1: Write failing tests.** Gunakan fixture customer id1/id2/id3 tanpa layanan; service11 milik1 punya canonical SAP-C-0001-0001 dan alias I-0001-001-01, service12 milik1 Pending template2, service21 milik2 Active template1. Pin assertions berikut:

```js
assert.equal(select({query:'ion-cust-000001'}).serviceCount,2);
assert.equal(select({query:'i-0001-001-01'}).groups[0].services[0].id,11);
assert.equal(select({status:'Pending'}).customerCount,1);
assert.equal(select({status:'Pending'}).serviceCount,1);
assert.equal(select({query:'Customer tanpa layanan'}).customerCount,1);
assert.equal(select({query:'Customer tanpa layanan',status:'Active'}).customerCount,0);
assert.equal(select({query:'tidak ditemukan'}).serviceCount,0);
assert.equal(select({page:999}).page,1);
```

Test terpisah: 26 customer menjadi 25+1, filter template/status dikombinasikan, case berbeda, dua customer bernama sama tetap dua ID, produk/Customer Name tidak disimpulkan dari angka CID. `select` pada test adalah wrapper fixture untuk signature di atas.

- [ ] **Step 2:** Run `node --test lib/customers/serviceInventoryView.test.mjs`; expected FAIL import module belum ada.
- [ ] **Step 3:** Implement `selectServiceInventory` di file yang ditentukan: gunakan Map customerId, helper pencarian existing, filter, stable sort name lalu id, hitung sebelum slice. Jangan mutasi input. Customer tanpa layanan hanya lolos jika query customer cocok atau query kosong, serta filter Semua.
- [ ] **Step 4:** Run test yang sama; expected seluruh assertion PASS. Tambahkan freeze input untuk memastikan selector tidak mengubah services/customers.
- [ ] **Step 5:** Commit `feat: add customer service inventory view selector` hanya dua file task ini.

## Task 2: Toolbar dan customer list yang dapat dibuka/ditutup

**Files:** Create `app/assets/CustomerInventoryRow.js`; modify `CustomerServiceInventory.js`, `customer-services.module.css`; create `scripts/test_customer_inventory_redesign_ui.cjs`.

**Interfaces:**
- Consumes: selector Task 1; `AssetCombobox({label,options,value,onChange,...})` existing.
- Produces: `CustomerInventoryRow({customer,serviceCount,totalServiceCount,pendingCount,expanded,onToggle,children})` dengan unique panel ID berbasis customer.id; `CustomerServiceInventory({customers,services,canManage})` mempertahankan signature publik.
- State: query string, templateId string, status string, page number, expandedCustomerId number|null. Handler query/filter/reset menghitung hasil selector baru dan membuka satu customer hanya jika customerCount===1; onToggle selalu bisa menutup. Setelah data props berubah, page dan expandedCustomerId harus tetap valid.

- [ ] **Step 1:** Extend fixture browser test. Cari Customer ID satu hasil, assert expanded true; klik customer, assert false dan panel hidden; klik ulang, assert true. Cari query dengan dua hasil, assert hanya header keduanya dan tidak ada auto-expand semua. Filter Pending, assert summary `1 customer` dan `1 layanan`. Reset, assert page1, kedua filter Semua, query kosong dan detail tertutup. Fixture 26 customer: next menuju halaman2; filter nol hasil tidak meninggalkan Halaman2 kosong palsu.
- [ ] **Step 2:** Run `node scripts/test_customer_inventory_redesign_ui.cjs`; expected FAIL filter belum tersedia atau collapse saat search tetap terbuka pada baseline.
- [ ] **Step 3:** Implement toolbar terlabel `Cari customer, Customer ID, atau CID`, `Tipe layanan`, `Status layanan`, `Reset filter`. Opsi status/value sesuai spec. Render satu list datar dan CustomerInventoryRow controlled; aria-controls target tetap ada saat collapsed dengan hidden. Gunakan hasil selector untuk summary dan pagination; jangan menaruh Company sebagai properti customer.
- [ ] **Step 4:** Run test baru dan `node scripts/test_customer_assets_ui.cjs`; expected PASS. Adapt assertion lama pada perubahan label/struktur yang disengaja, pertahankan assertion CID alias, customer identity, kapasitas, hash navigation dan customer tanpa layanan.
- [ ] **Step 5:** Commit `feat: simplify customer inventory filtering and disclosure` dengan file Task 2.

## Task 3: Daftar layanan ringkas dan token visual bersama

**Files:** Create `app/assets/CustomerServiceList.js`; modify `CustomerServiceInventory.js`, `customer-services.module.css`, `assets-ui.module.css`, `AssetClient.js`, `app/globals.css`; extend test browser baru.

**Interfaces:**
- Consumes: filtered services Task1, existing `readServiceBandwidthMbps(service)` dan `getServiceCid(service)`.
- Produces: `CustomerServiceList({customer,services,canManage})`; menyediakan slot ServiceTicketActions Task4, sementara tahap ini tetap memakai link Detail existing.
- Shared tokens: `--asset-heading-mobile:1.75rem`, `--asset-heading-desktop:2rem`, `--asset-body-size:.875rem`, `--asset-meta-size:.75rem`, `--asset-control-min:2.75rem`, `--asset-customer-row-min:3.25rem`, `--asset-radius:.375rem`, `--asset-divider-width:1px`, `--asset-space-1:.25rem`, `--asset-space-2:.5rem`, `--asset-space-3:.75rem`, `--asset-space-4:1rem`, `--asset-space-6:1.5rem`. Warna consume --text-color/--heading-color/--muted-text/--border-color/--secondary-color dan token status existing; theme correction hanya jika pengukuran membuktikan perlu.

- [ ] **Step 1:** Tambahkan test nama panjang 180 karakter, site tanpa spasi 100 karakter, alias CID, bandwidth null/0/100, empat status dan template kosong. Assert capacity null=`Belum diisi`, 0=`0 Mbps`; alias tidak menjadi service tambahan; Pending tetap label Pending. Pada 280/320/414/768/1440 assert document.scrollWidth<=innerWidth dan tidak ada informasi yang hanya hadir pada elemen hidden.
- [ ] **Step 2:** Run test baru; expected FAIL copy/struktur mobile atau computed token yang belum ada.
- [ ] **Step 3:** Implement CustomerServiceList: tabel >=768px dan daftar semantik <768px yang mempunyai informasi sama tanpa ID duplikat; CID monospace, site utama, alias secondary. Header: CID, Site, Tipe layanan, Kapasitas, Status layanan, Tiket, Aksi. Ubah shell menjadi judul pendek tanpa paragraf instruksi dan tab datar; Registry/produk/analisis dampak tidak dihapus. CSS tanpa kartu customer, KPI, gradient, emoji, shadow baris, atau gerakan translateY; format CSS dapat dibaca, satu selector per blok.
- [ ] **Step 4:** Run kedua browser test. Capture light/dark pada desktop dan mobile ke direktori artefak task, lalu lihat screenshot. Run kit `measure_render.mjs`, `verify_states.mjs`, `verify_responsive.mjs`, `verify_mobile_first.mjs` pada harness HTML yang diekspor dari komponen asli dengan DS_REQUIRE_BROWSER=1. Expected tidak SKIPPED dan tidak ada kegagalan; lint_hardcodes berlaku pada file berubah dengan token source dikecualikan sesuai aturan tool, bukan ignore seluruh direktori.
- [ ] **Step 5:** Commit `style: replace customer cards with compact inventory rows` dengan file Task 3.

## Task 4: Aksi tiket pada CID dengan disclosure aksesibel

**Files:** Create `app/assets/ServiceTicketActions.js`; modify `CustomerServiceList.js`, `customer-services.module.css`; extend test browser baru.

**Interfaces:**
- Consumes: `{service,canManage}`; CID canonical/alias resolved melalui helper existing.
- Produces: `ServiceTicketActions({service,canManage})`. Untuk service ber-CID: link Detail `/assets/${service.id}` dan disclosure `Buat tiket` berisi Trouble `/tickets/new?workType=Trouble&serviceId=${service.id}` serta Pekerjaan layanan `/tickets/new?workType=ServiceWork&serviceId=${service.id}`. Jangan preselect Upgrade/Installasi atau membuat route baru. Tanpa CID: Detail dan, bila canManage, `/assets#sap-circuits` dengan teks Tautkan CID.

- [ ] **Step 1:** Assert URL tepat untuk service11 dan service21; klik disclosure tidak mengirim POST/fetch mutasi. Space/Enter membuka; Tab menjangkau kedua link; Escape menutup dan fokus kembali. Service tanpa CID tidak punya shortcut tiket. canManage=false tidak menampilkan Tautkan CID; server authorization existing tetap menjadi otoritas, bukan hanya tombol.
- [ ] **Step 2:** Run test baru; expected FAIL ServiceTicketActions/disclosure belum ada.
- [ ] **Step 3:** Implement native details/summary atau controlled disclosure dengan button+aria-expanded yang benar, tanpa role menu/listbox palsu; tampilkan dua link biasa. Jika native details, Escape ditangani eksplisit dan summary diberi fokus kembali. Gunakan satu pola markup untuk kedua layout tanpa duplicate focus target.
- [ ] **Step 4:** Run test baru, kedua suite Assets existing, `node scripts/test_service_work_ui.cjs` dan `node scripts/test_ticket_classification_ui.cjs`; expected PASS, Trouble multi-CID dan Pekerjaan layanan single-CID tidak berubah.
- [ ] **Step 5:** Commit `feat: add contextual service ticket actions` dengan file Task 4.

## Task 5: Review final, QA dan paket rilis yang dapat di-rollback

**Files:** Extend `scripts/test_customer_inventory_redesign_ui.cjs`; record ledger `.superpowers/sdd/2026-10-22-customer-services-redesign/progress.md`; release files di `/opt/noc-manager2/releases/<actual-commit>/` saat eksekusi rilis sudah diotorisasi. Jangan mengedit plan ini untuk mencatat hasil.

**Interfaces:**
- Consumes: komponen Tasks1–4, baseline image aktif yang dibaca ulang, regression scripts existing.
- Produces: laporan QA dengan scope/command/hasil asli, screenshot light/dark/mobile, image commit yang dibuild, pg_dump terverifikasi, counts-before/after, compose override, smoke read-only dan rollback.sh executable menuju image baseline yang masih ada.

- [ ] **Step 1:** Tambahkan test role read-only, props berubah setelah page2, status tidak dikenal ditampilkan apa adanya, invalid string customer ID tidak dipakai sebagai relasi, serta screenshot nama panjang/filtered-empty/dialog penautan yang existing. Jalankan axe pada halaman awal, expanded, filtered-empty, combobox terbuka, disclosure tiket, light/dark; assertion 0 pelanggaran WCAG A/AA yang diuji.
- [ ] **Step 2:** Run `node --test lib/customers/serviceInventoryView.test.mjs lib/customers/identity.test.mjs lib/services/cidLookup.test.mjs`; expected PASS. Run `node scripts/test_customer_inventory_redesign_ui.cjs`, `node scripts/test_customer_assets_ui.cjs`, `node scripts/test_sap_assets_ui.cjs`; expected PASS. Run `node node_modules/eslint/bin/eslint.js app lib components middleware.js --max-warnings 0` dan `git diff --check`; expected exit0.
- [ ] **Step 3:** Jalankan design-review terhadap screenshot komponen asli; periksa keyboard, focus, reduced motion, manual 400% zoom dan NVDA bila tersedia. Run `accuracy_report.mjs` sesuai design-doctrine dan bedakan scope kit dari aplikasi. SKIPPED/hasil parsial bukan kelulusan; kegagalan kit non-target dicatat, bukan diklaim berhasil. Lakukan fresh whole-branch review; perbaiki temuan penting dengan test red/green sebelum rilis.
- [ ] **Step 4:** Commit test/dokumentasi hasil yang relevan sebagai `test: verify customer inventory redesign release gates`. Jangan commit artefak sensitif atau .env. Pastikan hanya perubahan scope ini yang masuk; dirty .dockerignore/.gitignore milik pekerjaan lain dipertahankan.
- [ ] **Step 5:** Setelah review rencana/otorisasi eksekusi, build Linux prebuilt image dari sumber commit final. Baca actual active image, simpan image/compose baseline; buat pg_dump -Fc dan verifikasi `pg_restore -l`. Buat rollback.sh yang hanya mengganti app image dengan --no-deps --no-build; cek `sh -n` dan image inspect. Jangan menjalankan startup db push accept-data-loss.
- [ ] **Step 6:** Deploy override app saja; bila smoke gagal, jalankan rollback.sh. Smoke read-only dengan sesi uji terautentikasi pada local HTTP dan domain: /assets, /tickets, /tickets/new, API customer/services/CID; anonymous CID API harus401. Periksa relasi service.customerId, Customer ID, company config dan counts sebelum/sesudah; jika ada perubahan aktivitas user, investigasi tanpa memulihkan database secara otomatis. Pastikan container image=commit yang diuji, restarts stabil, HTTP200 dan worker/database sehat.
- [ ] **Step 7:** Catat commit, hasil pemeriksaan, lokasi backup/rollback dan limitasi yang belum diuji ke ledger; laporkan ringkas ke user dengan link /assets. Jangan mengklaim seluruh NOC Manager sudah redesign atau semua metrik performa membaik tanpa pengukuran.

## Self-review rencana

- Coverage: spec behavior1–2 -> Task1; behavior3–6 -> Task1/2; behavior7 -> Task4; behavior8–10 -> Tasks3–5; visual/state/theme -> Task3/5; release/rollback -> Task5.
- Interfaces: selector menghasilkan `groups[].services`, bukan visibleServices; Task2/3 memakai nama yang sama. Public signature CustomerServiceInventory tetap sama.
- Review Focus: kelima risiko mempunyai assertion di task pemilik, bukan hanya daftar manual.
- Tidak ada implementasi pada pekerjaan ini; baseline kode tetap e5a364c. Server pagination, filter company pada Service, perubahan form tiket dan pembersihan seluruh stylesheet legacy berada di luar scope.
