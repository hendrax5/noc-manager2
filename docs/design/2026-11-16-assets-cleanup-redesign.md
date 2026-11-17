# Menu Assets: Perapihan Data Customer, Penautan CID Massal, dan Konsolidasi UI

Tanggal: 2026-11-16  
Status: Draft untuk review (belum ada perubahan kode implementasi)  
Cakupan: `/assets`, `/assets/[id]`, API `/api/assets/*`, skema `Customer` & `Service` di Prisma.  
Referensi terkait: [`BRIEF.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/sap-cid/BRIEF.md), [`SAP_CID_ASSETS.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/SAP_CID_ASSETS.md), [`2026-10-24-ui-consistency-pass.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/design/2026-10-24-ui-consistency-pass.md).

---

## 1. Latar Belakang & Temuan Aktual di Codebase

Audit pada implementasi `/assets` saat ini menemukan mengapa operator kesulitan merapikan data customer dan menautkan CID ke produk/customer secara cepat dan aman:

### A. Celah Fungsional & Integritas Data di Backend
1. **Layanan (`Service`) belum bisa dipindah Customer atau diganti Produk secara langsung**  
   - Handler `PATCH /api/assets/services/[id]` (`app/api/assets/services/[id]/route.js` baris 75–80) hanya memperbarui `cid`, `name`, `status`, `company`, `customData`, dan `hops`.  
   - Field `customerId` dan `templateId` tidak diproses sama sekali, sehingga layanan yang terlanjur salah customer atau salah tipe produk tidak bisa dirapikan tanpa menghapus dan membuat ulang `Service` (yang berisiko memutus tautan tiket/BOD).
2. **Skema `Customer` belum mendukung arsip / riwayat penggabungan (merge)**  
   - Model `Customer` (`prisma/schema.prisma` baris 365–374) hanya memiliki `id`, `name` (`@unique`), `contactEmail`, `contactPhone`, `services`, `pickerUses`, `createdAt`, `updatedAt`.  
   - Tidak ada kolom `active`, `archivedAt`, atau `mergedIntoId`. `DELETE /api/assets/customers/[id]` (`app/api/assets/customers/[id]/route.js` baris 45) langsung gagal dengan error `P2003` jika masih ada `Service` terpasang, dan belum ada endpoint untuk menggabungkan dua customer duplikat secara transaksional.
   - Endpoint pemilih customer (`app/api/assets/customers/route.js`, `search/route.js`, `picker/route.js`) serta `app/assets/page.js` belum memfilter status aktif customer.
3. **Penautan CID masih satu per satu (`mapCircuitCandidate`)**  
   - `POST /api/assets/circuit-candidates` (`app/api/assets/circuit-candidates/route.js`) hanya memproses satu CID per request. Ketika satu customer memiliki puluhan CID dari tiket SAP, operator harus mengulang dialog yang sama berkali-kali.

### B. Masalah Alur Kerja & UI (`app/assets/`)
1. **Navigasi terpecah menjadi 6 tab yang terputus** (`AssetClient.js` baris 49–54)  
   - Tab saat ini: `Ringkasan layanan` (`portfolio`), `Daftar circuit` (`inventory`), `Customers Registry` (`customers`), `Penautan CID` (`sap`), `Produk layanan` (`templates`), dan `Analisis dampak` (`blast`).  
   - Operator harus melompat antar-tab hanya untuk tugas yang berkaitan (cek CID → buat customer → kembali cari CID → cek layanan customer).
2. **Konteks hilang saat membuat customer dari Penautan CID** (`SapCircuitsClient.js` baris 85 & `AssetClient.js` baris 55)  
   - Klik `"Daftarkan customer"` di dalam dialog `<dialog>` langsung menutup dialog dan memindahkan `activeTab` ke `'customers'`. Setelah customer dibuat, operator kehilangan posisi filter, halaman, dan baris CID yang sedang dikerjakan.
3. **Ringkasan kesehatan data bersifat pasif** (`ServicePortfolio.js` baris 10)  
   - Notice seperti `X CID belum memiliki bandwidth yang jelas · Y layanan belum memiliki CID · Z duplikasi CID dikecualikan` hanya berupa teks biasa, tidak bisa diklik untuk memfilter dan memperbaiki baris bermasalah.
4. **Ketidakkonsistenan desain token di tab `Analisis dampak`** (`AssetClient.js` baris 63–122)  
   - Masih memakai class legacy `.ui-static-*`, gaya inline `style={{ ... }}`, teks bahasa Inggris (`Trace Upstream Impact`, `Affected Customer`), serta modal customer/template lama di `AssetClient.js` baris 125–238 yang belum memakai `<dialog>` bertoken `assets-ui.module.css` (`--ui-*` / `--asset-*`).

---

## 2. Tujuan & Prinsip Desain (Keputusan Terkonfirmasi)

Berdasarkan sesi klarifikasi bersama operator/pemilik produk, redesain ini menetapkan 4 prinsip utama:

1. **Konsolidasi menjadi 4 Area Kerja yang Jelas**  
   Mengurangi perpindahan konteks dengan menyatukan alur terkait ke dalam 4 area utama di `/assets`.
2. **Merge Duplikat Customer dengan Arsip (Non-Destruktif)**  
   Penggabungan customer duplikat memindahkan seluruh `Service` dan riwayat pemakaian picker ke satu Customer resmi (*canonical*), lalu **mengarsipkan** customer duplikat (`active = false`, `mergedIntoId`) — **tidak pernah menghapus permanen**.
3. **Split-Pane & Batch Linking untuk Penautan CID + Inline Create Customer**  
   Operator memilih satu atau banyak CID sekaligus, melihat sumber tiket + saran customer di panel kanan, serta dapat mendaftarkan customer baru secara inline tanpa menutup/keluar dari layar Penautan CID.
4. **Smart Auto-Suggest + Konfirmasi Eksplisit (Tetap Mematuhi Integritas SAP CID)**  
   - Sistem memberi saran kemiripan nama customer (duplikat customer maupun kecocokan teks sumber tiket), **tetapi tidak pernah menebak atau menautkan otomatis tanpa klik konfirmasi operator**.  
   - Tetap menjaga seluruh aturan di [`docs/sap-cid/BRIEF.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/sap-cid/BRIEF.md): angka CID SAP bukan kode customer, status/poin/tanggal tiket sumber tidak berubah, `Order Origin` & `Executing Vendor` tidak ditimpa, dan setiap mutasi tercatat di `ActivityEvent` (`recordActivity`).

---

## 3. Arsitektur UI Baru: Konsolidasi 4 Area di `/assets`

Header `/assets` tetap mempertahankan gaya bersih konsisten (`--ui-*` tokens dari `app/ui-tokens.css` & `app/assets/assets-ui.module.css`) dengan 4 tab berpola ARIA tab/hash URL:

| # | Nama Tab / Area | Hash URL | Tujuan Utama | Menggantikan Tab Lama |
|---|---|---|---|---|
| 1 | **Ringkasan & Perapihan** | *(default)* / `#hygiene` | KPI kesehatan data + antrean aksi perapihan klik-langsung + saran duplikat customer | `Ringkasan layanan` (ditingkatkan jadi actionable) |
| 2 | **Customer & Circuit** | `#inventory` | Master-Detail: daftar customer resmi di kiri/atas, edit kontak, merge duplikat, & kelola circuit milik customer termasuk pindah customer/produk inline | `Daftar circuit` + `Customers Registry` |
| 3 | **Penautan CID** | `#sap-circuits` | Split-pane: tabel/antrean CID dari tiket di kiri + panel pemetaan tunggal/batch & buat customer inline di kanan (khusus Admin/`manage_assets`) | `Penautan CID` |
| 4 | **Katalog Produk & Dampak** | `#products` / `#blast` | Sub-view kelola `ServiceTemplate` (produk layanan) dan pelacakan `Blast Radius` antar-hop jaringan | `Produk layanan` + `Analisis dampak` |

### Area 1: Ringkasan & Perapihan Data (`ServicePortfolio` + Hygiene Queue)
- **Kartu Status Kesehatan Data (Actionable Cards)** di atas ringkasan kapasitas produk:
  1. *Kandidat Duplikat Customer* (klik → buka Area 2 dengan panel review merge).
  2. *CID Belum Tertaut ke Layanan* (klik → lompat ke Area 3 filter `status=needs_mapping`).
  3. *Layanan Tanpa CID* (`missingCidCount`) (klik → lompat ke Area 2 filter `missingCid=true`).
  4. *Kapasitas / Pair Belum Lengkap* (`unknownBandwidthCount` / `unknownPairCount`) (klik → filter tabel ringkasan/detail ke item yang butuh dilengkapi, dengan link cepat ke `/assets/[id]`).
  5. *Layanan Berstatus Pending* (klik → lompat ke Area 2 filter `status=Pending`).
- **Ringkasan Kapasitas Produk**: tetap mempertahankan metrik produk existing (`Gbps` terpisah dari `pair` untuk `DARKFIBER`, pemisahan BOD sementara dengan `normalBandwidthMbps`, filter `company`, `status`, dan tabel detail terpaginasi).

### Area 2: Customer & Circuit (Master-Detail + Merge & Reassign)
- **Panel Kiri (Daftar Customer — Master)**:
  - Pencarian real-time (`Nama`, `IONCUSTxxxxxx`, `Email/Telepon`, `CID milik customer`), filter cepat (`Semua`, `Punya layanan Pending`, `Tanpa layanan`, `Kandidat duplikat`), toggle opsional `"Tampilkan arsip"` (read-only untuk audit riwayat merge).
  - Banner **Saran Duplikat Customer** bila terdeteksi kemiripan nama (mis. normalisasi menghapus `PT`, `CV`, `TBK`, tanda baca, spasi ganda, atau kesamaan token > ambang batas), dengan tombol `Tinjau Merge`.
  - Aksi di tiap item/detail customer: `+ Tambah customer`, `Edit profil`, `Gabungkan ke customer lain (Merge)`.
- **Panel Kanan (Circuit & Layanan Milik Customer — Detail)**:
  - Ringkasan profil customer (`formatCustomerId`, kontak, total layanan, daftar **alias nama lama** yang pernah di-merge ke customer ini sebagai informasi kontekstual).
  - Tabel/kartu circuit milik customer tersebut (memakai struktur aksesibel `CustomerServiceList`), dilengkapi tombol aksi cepat per baris:
    - **Ubah Pemilik / Produk** (membuka popover/dialog ringkas tanpa harus membuka halaman baru, dengan validasi BOD aktif & kapasitas produk).
    - **Buka Detail / Edit Hops / SLA** (`/assets/[id]`).
    - **Buat Tiket Trouble** (`/tickets/new?workType=Trouble&serviceId=...`).
- **Modal Konfirmasi Merge Duplikat Customer (`<dialog>`)**:
  - Memilih *Customer Sumber (akan diarsipkan)* dan *Customer Tujuan / Resmi (tetap aktif)* — bisa di-swap satu klik.
  - Pratinjau dampak eksplisit sebelum submit:
    - Jumlah `Service` yang akan dipindahkan (daftar ringkas nama + CID).
    - Jumlah histori `CustomerPickerUse` yang akan dialihkan.
    - Penanganan kontak (`contactEmail` / `contactPhone`): jika Customer Tujuan kosong, tawarkan salin dari Customer Sumber via checkbox/opsi yang jelas.
    - Peringatan jika Customer Tujuan saat ini tidak punya nama persis dan operator ingin mempertahankan nama sumber sebagai catatan alias.
  - Membutuhkan konfirmasi eksplisit (checkbox / tombol konfirmasi `Gabungkan & Arsipkan`).

### Area 3: Penautan CID (Split-Pane & Batch Linking)
Menggantikan modal `<dialog>` satu-per-satu di `SapCircuitsClient.js` dengan tata letak split-pane desktop (bertingkat rapi di layar `< 64rem`):
- **Pane Kiri — Antrean Kandidat CID**:
  - Filter `Format kode` (`SAP`, `I`, `C`, dll.), `Status` (`Belum selesai ditautkan`, `Belum tertaut`, `Asset tersedia`, `Sudah tertaut`, `Perlu diperiksa`, `Semua`), dan pencarian CID / nama sumber tiket.
  - Kolom checkbox multi-select (hanya aktif untuk baris yang belum berstatus `linked`/`conflict`, atau dengan validasi konsisten saat batch).
  - Menampilkan CID, nama reporter/tiket sumber, badge `Butuh konfirmasi review` bila `needsConfirmation === true`, jumlah tiket sumber (expandable).
- **Pane Kanan — Inspector & Panel Pemetaan (Sticky)**:
  - **Mode Tunggal (1 CID dipilih)**:
    - Menampilkan detail tiket sumber, *Saran Customer* (berbasis kesamaan teks `sourceName` vs nama `Customer` aktif atau alias merge — disajikan sebagai tombol quick-pick `"Gunakan saran: PT X"` yang tetap harus diklik operator).
    - Pilihan mode tautan:
      1. *Tautkan ke Layanan yang Sudah Ada* milik customer terpilih (mendukung alias kode lama dengan checkbox `confirmAlias`).
      2. *Buat Layanan Baru untuk CID ini* (`Produk/Layanan`, `Nama layanan`, `Status layanan`).
    - **Buat Customer Baru Inline**: blok collapsible/inline langsung di dalam pane kanan (Nama Customer, Email opsional, No. Telp/NOC opsional). Saat disimpan via `POST /api/assets/customers`, customer baru otomatis ditambahkan ke state, langsung terpilih di combobox `Customer`, dan daftar CID di kiri **tidak hilang posisinya**.
  - **Mode Batch (`N >= 2` CID dipilih)**:
    - Ringkasan daftar CID terpilih (bisa hapus salah satu chip sebelum submit) + indikator mana saja yang berstatus `needsConfirmation` atau `ready_to_link` (sudah ada Asset-nya).
    - Opsi batch yang aman:
      - Untuk CID berstatus `needs_mapping` (belum ada `Service`): pilih **1 Customer Resmi** + **1 Produk (`ServiceTemplate`)** + **Status awal** (`Pending` / `Active`) + opsi penamaan otomatis per baris (default memakai `sourceName` tiket atau boleh diedit per baris di daftar ringkasan batch).
      - Jika ada kandidat dengan `needsConfirmation === true`, tampilkan daftar tiket tersebut dan minta satu checkbox konfirmasi review yang jelas sebelum tombol `Simpan N CID` aktif.
      - Untuk CID yang `ready_to_link` (sudah punya `Service` unik): langsung tautkan tiket sumber tanpa membuat `Service` duplikat.
    - Hasil batch ditampilkan terstruktur per CID (berhasil dibuat / tiket ditautkan / gagal beserta alasannya jika ada konflik parsial atau seluruh transaksi di-rollback sesuai aturan mode atomik).

### Area 4: Katalog Produk & Analisis Dampak
- Menggunakan sub-tab/toggle internal dalam komponen baru tanpa `.ui-static-*` dan tanpa inline style legacy:
  - **Katalog Produk (`ServiceTemplate`)**: memakai `<dialog>` bertoken `assets-ui.module.css` (menggantikan modal manual lama di `AssetClient.js`), menampilkan status aktif/arsip, jumlah layanan pemakai, dan preview schema field.
  - **Analisis Dampak (`Blast Radius`)**: ditulis ulang dalam bahasa Indonesia yang konsisten menggunakan komponen card/tabel bertoken `--ui-*`, menampilkan Customer terdampak, CID (`font-mono`), node/device/port yang cocok, serta link ke `/assets/[id]` dan tombol cepat filter/buat tiket gangguan massal.

---

## 4. Perubahan Skema Database (`prisma/schema.prisma`)

Tambahan kolom pada `model Customer` bersifat **backwards-compatible** (nullable atau punya nilai default):

```prisma
model Customer {
  pickerUses   CustomerPickerUse[]
  id           Int        @id @default(autoincrement())
  name         String     @unique
  contactEmail String?
  contactPhone String?
  active       Boolean    @default(true)
  archivedAt   DateTime?
  mergedIntoId Int?
  mergedInto   Customer?  @relation("CustomerMergeHistory", fields: [mergedIntoId], references: [id], onDelete: SetNull)
  mergedAliases Customer[] @relation("CustomerMergeHistory")
  services     Service[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([active, name])
  @@index([mergedIntoId])
}
```

### Pertimbangan `Customer.name @unique` Saat Arsip / Merge
1. **Mempertahankan nama lama pada baris terarsip sebagai audit & alias**:  
   Ketika `Customer A ("PT Contoh")` digabung ke `Customer B ("PT Contoh Indonesia")` dan diarsipkan (`active = false`, `archivedAt = now()`, `mergedIntoId = B.id`), baris `A` tetap menyimpan `name = "PT Contoh"`. Ini berguna untuk:
   - Jejak audit di UI (`mergedAliases` pada `Customer B`) tanpa perlu tabel alias terpisah di tahap awal.
   - Pencocokan *auto-suggest* di Penautan CID ketika tiket lama menyebut nama alias `A` → sistem dapat menyarankan `Customer B` (canonical).
2. **Edge Case Tabrakan Nama (`Unique Constraint`)**:  
   Karena kolom `name` pada PostgreSQL masih memiliki indeks unik `"Customer_name_key"`, jika nanti ada operator yang ingin membuat customer baru bernama persis `"PT Contoh"` atau me-rename `B` menjadi `"PT Contoh"`:
   - **Rekomendasi skema migrasi**: ganti constraint unik global `"Customer_name_key"` dengan **partial unique index** pada PostgreSQL untuk customer aktif saja:
     ```sql
     DROP INDEX IF EXISTS "Customer_name_key";
     CREATE UNIQUE INDEX "Customer_active_name_ci_key"
       ON "Customer" (lower(btrim("name")))
       WHERE "active" = true;
     ```
     *Catatan*: Prisma `schema.prisma` belum mendukung deklarasi `WHERE` pada `@@unique` secara native tanpa catatan migrasi manual; jika ingin tetap menjaga `name @unique` di level Prisma schema agar sinkronisasi `prisma db push` / `prisma migrate` mulus tanpa drift, alternatif aman adalah:
     - Tetap pertahankan `@unique` di `Customer.name` pada Prisma schema **atau** saat `merge` menyertakan opsi `adoptSourceName` (swap nama atomik di dalam transaksi), dan saat `POST /api/assets/customers` / `PATCH /api/assets/customers/[id]` mendeteksi nama yang sama ada di customer berstatus `active = false` (`mergedIntoId != null`), kembalikan pesan error ramah yang mengarahkan ke customer canonical tujuan merge-nya (*"Nama sudah diarsipkan ke Customer XYZ (IONCUST000012)."*).
   - Keputusan ini mudah diimplementasikan tanpa risiko drift Prisma, sekaligus mencegah terciptanya kembali duplikat dengan nama yang sudah pernah dimerge.

---

## 5. Kontrak API & Aturan Invarian

### A. Endpoint Baru: `POST /api/assets/customers/merge`
- **Otorisasi**: `Admin` atau permission `manage_assets`.
- **Payload**:
  ```json
  {
    "sourceCustomerId": 12,
    "targetCustomerId": 5,
    "copyMissingContact": true,
    "confirmMerge": true
  }
  ```
- **Validasi & Eksekusi Transaksional (`prisma.$transaction`)**:
  1. Tolak jika `sourceCustomerId === targetCustomerId`, ID tidak valid, atau `confirmMerge !== true`.
  2. Lock baris `Customer` kedua belah pihak secara deterministik (`SELECT id FROM "Customer" WHERE id IN (...) ORDER BY id FOR UPDATE`) untuk mencegah race condition atau double-merge.
  3. Pastikan `source.active === true`, `target.active === true`, dan `source.mergedIntoId === null`.
  4. Pindahkan seluruh `Service`: `tx.service.updateMany({ where: { customerId: source.id }, data: { customerId: target.id } })`.
  5. Pindahkan histori picker: `tx.customerPickerUse.updateMany({ where: { customerId: source.id }, data: { customerId: target.id } })`.
  6. Jika `copyMissingContact === true`, isi `target.contactEmail` / `target.contactPhone` hanya jika nilai pada `target` saat ini kosong/null dan `source` terisi.
  7. Arsipkan `source`: `active: false`, `archivedAt: new Date()`, `mergedIntoId: target.id`.
  8. Catat audit via `recordActivity(tx, ...)` dengan `type: 'customer.merged'`, `entityType: 'customer'`, `entityId: target.id`, memuat ringkasan `sourceId`, `sourceName`, `movedServiceIds`, dan `movedPickerUses`.
- **Idempotensi / Proteksi Error**: Jika request diulang setelah `source` sudah terarsip, kembalikan `409 Conflict` dengan pesan jelas (*"Customer sumber sudah diarsipkan ke ..."*).

### B. Perluasan Endpoint: `PATCH /api/assets/services/[id]`
Melengkapi [`app/api/assets/services/[id]/route.js`](file:///home/antigravity/hendrax5/noc-manager2/app/api/assets/services/[id]/route.js):
- **Field baru yang diterima**: `customerId` (opsional), `templateId` (opsional).
- **Invarian yang harus dijaga di dalam transaksi**:
  1. Lock `lockCircuitCodes` + `SELECT id FROM "Service" ... FOR UPDATE` tetap dijalankan lebih dulu.
  2. **Guard BOD Aktif tetap berlaku**: jika ada `BodWindow` aktif (`activatedAt != null && restoredAt == null && cancelledAt == null`), tolak perubahan `customerId` / `templateId` / `customData` dengan `409 Conflict`.
  3. Jika `body.customerId !== undefined`:
     - Validasi customer tujuan eksis dan `active === true` (tidak boleh memindahkan layanan ke customer yang sudah diarsipkan).
     - Set `updateData.customerId = nextCustomerId`.
  4. Jika `body.templateId !== undefined` dan berbeda dari `fresh.templateId`:
     - Validasi `ServiceTemplate` tujuan eksis dan `active === true`.
     - Gunakan `nextTemplate` tersebut (bukan `fresh.templateId`) untuk mengevaluasi `darkFiberData` & `openPortUpdatedData` + `validateOpenPortData`.
     - **Keamanan data kapasitas saat ganti produk**: jika berpindah antara produk berbasis bandwidth (`Gbps`/`Mbps`) dan `DARKFIBER` (`pair`), konversi / bersihkan hanya bila payload menyertakan `customData` baru atau validasi ulang; nilai `customData` non-konflik lainnya (seperti `cidSource`, catatan custom) tetap dipertahankan agar tidak hilang diam-diam.
  5. `recordActivity` mencatat perubahan `before` dan `after` (`customerId` / `templateId` tercatat jelas pada `changes`).

### C. Endpoint Baru: `POST /api/assets/circuit-candidates/batch`
Menggunakan helper `mapCircuitCandidate` / inti transaksi di [`lib/services/circuitAssets.js`](file:///home/antigravity/hendrax5/noc-manager2/lib/services/circuitAssets.js):
- **Payload**:
  ```json
  {
    "customerId": 5,
    "templateId": 2,
    "status": "Pending",
    "confirmReview": true,
    "items": [
      { "cid": "SAP-C-1243-0003", "name": "PT Contoh - Jakarta" },
      { "cid": "SAP-C-1243-0004", "name": "PT Contoh - Surabaya" }
    ]
  }
  ```
- **Aturan Transaksi & Pencegahan Deadlock**:
  1. Validasi batas wajar ukuran batch (mis. maksimal 50 CID per request agar UI responsif dan timeout DB aman).
  2. Parse seluruh `items[].cid` di awal, buang duplikasi input, dan urutkan kode CID secara leksikografis sebelum memanggil `lockCircuitCodes(tx, allCodes)` — menjamin penguncian deterministik bebas deadlock.
  3. Lock semua `Ticket` sumber yang terlibat dalam urutan `ORDER BY id FOR UPDATE`.
  4. Validasi seluruh syarat per CID (jika ada `needsConfirmation` dan `confirmReview !== true`, tolak; jika ada status `conflict`, tolak sebelum menulis).
  5. Jalankan pembuatan `Service` + `registerCircuitIdentifier` + `joinSources` untuk setiap item dalam satu transaksi atomik (`all-or-nothing`), dan catat aktivitas per item / batch ringkasan.

### D. Filter Customer Aktif di Seluruh Endpoint Pemilih & Halaman
- **`GET /api/assets/customers`**: default memfilter `where: { active: true }` (mendukung `?includeArchived=true` untuk tab audit/arsip di `/assets`). Sertakan `mergedAliases: { select: { id: true, name: true, archivedAt: true } }` atau hitungannya agar operator bisa melihat riwayat alias pada panel detail customer.
- **`GET /api/assets/customers/picker`** (`app/api/assets/customers/picker/route.js`): tambahkan `AND c."active" = true` pada query SQL agar customer hasil merge yang sudah diarsipkan tidak muncul lagi di form pembuatan tiket (`/tickets/new`).
- **`GET /api/assets/customers/search`** (`app/api/assets/customers/search/route.js`): tambahkan `active: true` pada klausa `where`.
- **`app/assets/page.js`**: muat `customers` aktif dan `mergedAliases` sebagai properti awal, serta pisahkan `archivedCustomers` untuk mode tinjau arsip bila diperlukan.
- **`POST /api/assets/services`** (`app/api/assets/services/route.js`): tolak pembuatan layanan baru pada `Customer` yang berstatus `active = false`.

### E. Helper Smart Auto-Suggest (`lib/customers/duplicateDetection.js`)
Fungsi murni (*pure function*, mudah diuji unit test tanpa DB):
- `normalizeCustomerName(name)`: lowercase, hapus prefiks/sufiks badan usaha umum (`pt`, `cv`, `tbk`, `ltd`, `inc`, `corp`), hapus tanda baca, rapikan spasi.
- `findCustomerDuplicateSuggestions(customers)`: mengelompokkan pasangan customer aktif dengan skor kemiripan tinggi (exact normalized match atau token Jaccard / Levenshtein di atas threshold), sekaligus mengurutkan saran canonical (prioritas yang memiliki jumlah `Service` lebih banyak atau kontak lebih lengkap).
- `suggestCustomerForCircuitSource(sourceNames, customersWithAliases)`: mencocokkan nama sumber tiket SAP terhadap `name` customer aktif **dan** `mergedAliases[].name` untuk memberi saran di pane kanan Penautan CID — hasilnya murni *read-only hint* yang wajib diklik operator.

---

## 6. Tahapan Implementasi yang Direkomendasikan

| Fase | Fokus Perubahan | File Utama Terdampak |
|---|---|---|
| **Fase 1: Skema & Pure Helpers** | Tambah kolom `active`, `archivedAt`, `mergedIntoId` pada `Customer` + migrasi SQL + helper `duplicateDetection.js` & unit test `.test.mjs`. | `prisma/schema.prisma`, `prisma/migrations/...`, `lib/customers/duplicateDetection.js`, `tests/` |
| **Fase 2: API Kontrak & Audit** | Implementasi `/api/assets/customers/merge`, perluas `PATCH /api/assets/services/[id]` (`customerId`, `templateId`), implementasi `/api/assets/circuit-candidates/batch`, serta filter `active: true` di `customers`, `picker`, `search`, dan `services POST`. | `app/api/assets/customers/merge/route.js`, `app/api/assets/services/[id]/route.js`, `app/api/assets/circuit-candidates/batch/route.js`, `lib/services/circuitAssets.js`, `app/api/assets/customers/**` |
| **Fase 3: UI Konsolidasi 4 Area** | Refactor `AssetClient.js` menjadi 4 area bersih; ubah `SapCircuitsClient.js` menjadi split-pane + batch + inline create customer; tingkatkan `ServicePortfolio.js` dengan kartu hygiene klik-langsung; gabungkan `CustomerServiceInventory` + `Customers` dengan panel Merge & modal pindah Customer/Produk; perbaiki tab `Blast Radius` & modal produk agar memakai `assets-ui.module.css` (`--ui-*` tokens). | `app/assets/AssetClient.js`, `app/assets/SapCircuitsClient.js`, `app/assets/ServicePortfolio.js`, `app/assets/CustomerServiceInventory.js`, `app/assets/CustomerServiceList.js`, `app/assets/assets-ui.module.css`, CSS modules terkait |
| **Fase 4: Verifikasi & Smoke Test** | Jalankan unit test, contract test UI tokens, dan regression test SAP/Customer Assets. | `scripts/test_*.cjs`, `tests/*.test.mjs` |

---

## 7. Rencana Verifikasi

Setiap fase implementasi harus diverifikasi dengan kombinasi pengujian berikut:

1. **Unit Tests (Node Test Runner — tanpa perlu DB live)**:
   - `node --test` untuk `duplicateDetection.js` (normalisasi `PT.` / `CV` / spasi, deteksi kemiripan nama, pencocokan alias hasil merge).
   - Validasi fungsi batch/validasi parameter di `circuitAssets` dan validasi ganti `templateId` (`darkFiberData`, `validateOpenPortData`).
2. **Database & API Transaction Tests** (saat environment PostgreSQL & `node_modules` tersedia):
   - Uji `POST /api/assets/customers/merge`: pastikan `Service` & `CustomerPickerUse` berpindah lengkap, customer sumber terarsip (`active = false`), `ActivityEvent` tercatat, dan request ulang mengembalikan `409`.
   - Uji `PATCH /api/assets/services/[id]`: pastikan `customerId` & `templateId` bisa diubah saat aman, namun diblokir (`409`) ketika ada `BodWindow` aktif atau saat target customer berstatus arsip.
   - Uji `POST /api/assets/circuit-candidates/batch`: pastikan beberapa CID berhasil ditautkan ke 1 customer + produk dalam 1 transaksi tanpa mengubah tanggal/status/poin tiket sumber.
   - Jalankan skrip regresi existing:
     - `node scripts/test_circuit_identifiers_db.cjs`
     - `node scripts/test_sap_assets_api.cjs`
3. **UI, Aksesibilitas & Token Contract Tests**:
   - `node scripts/test_ui_style_contract.cjs` (memastikan 0 `.ui-static-*` tersisa di `/assets` dan seluruh warna/spacing memakai `--ui-*` / `--asset-*` tokens).
   - `node scripts/test_customer_assets_ui.cjs`
   - `node scripts/test_customer_inventory_redesign_ui.cjs`
   - `node scripts/test_sap_assets_ui.cjs`
   - `npm run lint`

---

## 8. Hal di Luar Cakupan (Disengaja)

- **Auto-merge atau auto-linking tanpa persetujuan manusia**: tetap dilarang keras sesuai prinsip non-guessing pada [`BRIEF.md`](file:///home/antigravity/hendrax5/noc-manager2/docs/sap-cid/BRIEF.md).
- **Unmerge (pemisahan ulang customer yang sudah diarsipkan)** pada UI tahap pertama: riwayat merge disimpan (`mergedIntoId` + `ActivityEvent`) sehingga data tidak hilang, tetapi aksi unmerge belum dibuatkan endpoint otomatis.
- **Impor CSV/Excel eksternal**: fokus perbaikan tahap ini pada data existing di `Customer`, `Service`, dan kandidat CID dari `Ticket`.
