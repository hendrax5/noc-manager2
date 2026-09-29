# Panduan: Agent AI + Integration API

Cara membuat API key lalu membaca data **tiket (lengkap)**, **dashboard**, **poin / performance**, **SLA & analytics**, **daily report / leaderboard**, **shift**, **meeting**, dan **ops report**.

Referensi teknis: [API_V1.md](./API_V1.md) · OpenAPI: `GET /api/v1/openapi`

Semua endpoint baru di panduan ini **read-only** (`GET`). Yang bisa menulis hanya create ticket, PATCH ticket, dan comment (lihat API_V1.md).

## 1. Buat API key

1. Buka **Settings → Integrations** (butuh Admin / `manage_settings`)
2. Buat Integration App (mis. `ai-agent`) **atau** klik **Edit scopes** pada app yang sudah ada
3. Centang scope sesuai kebutuhan agent:

| Scope | Fungsi | Menu di aplikasi |
|-------|--------|------------------|
| `tickets:read` | List + detail tiket (komentar **publik** saja) | Tickets |
| `tickets:read:full` | Tiket lengkap: komentar internal, notes, history, attachment, watcher, services, CSAT, `customData` | Tickets (detail) |
| `tickets:comment` | Opsional — balas komentar | Tickets |
| `dashboard:read` | KPI, category monitor, sky view, live-ops board, SLA alert | Dashboard |
| `reports:performance:read` | Poin per user, leaderboard, work-hours tim | Poin saya, Daily Reports (leaderboard), Performance |
| `reports:sla:read` | SLA & Analytics, service-desk metrics | SLA & Analytics, Daily Reports (metrics) |
| `reports:daily:read` | Isi laporan harian (tulisan user) | Reports → New |
| `reports:ops:read` | Ops report (downtime / new / upgrade / terminate) | Ops Report |
| `schedules:read` | Roster shift + tipe shift | Shifts |
| `meetings:read` | List + detail meeting | Meetings |

4. Simpan key (`noc_...`) — **hanya ditampilkan sekali**
5. (Opsional) isi **Webhook URL** untuk event tiket realtime

> `tickets:read:full`, `dashboard:read`, `reports:performance:read`, dan `reports:sla:read` membuka data setara Admin/Manager (catatan internal, poin semua staff, email staff). Berikan hanya ke agent tepercaya.

## 2. Auth & format umum

```http
X-API-Key: noc_xxxxxxxx...
```

- Base URL: host production (URL publik aplikasi)
- Semua respons JSON. Error: `{ "error": "..." }`, 403 scope kurang: `{ "error": "Forbidden", "missingScopes": [...] }`
- Tanggal `YYYY-MM-DD` = tanggal kalender; `date-time` = ISO-8601 (`2026-09-25T00:00:00Z`)
- Rate limit per app (default 60 req/menit) → `429 Too Many Requests`
- Setiap request tercatat di audit log integrasi

Contoh di bawah memakai:

```bash
export HOST="https://noc.example.com"
export KEY="noc_xxxxxxxx"
```

## 3. Tiket

### 3.1 List / poll

```bash
# Tiket baru sejak poll terakhir
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?status=New&createdSince=2026-09-25T00:00:00Z&limit=50"

# Sudah direspons staff
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?hasHumanResponse=true&updatedSince=2026-09-25T00:00:00Z"

# Critical/High yang belum di-assign
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?priority=Critical,High&assigneeId=none&status=New,Open"

# Cari berdasarkan teks
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/tickets?q=core-sw-01"

# Mode full (butuh tickets:read:full) — tambah customData, jobCategory, queue, services, csat, counts
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/tickets?view=full&slaBreached=true"
```

| Param | Keterangan |
|-------|------------|
| `status` | Satu status atau comma list (`New`, `Open`, `Pending`, `In Progress`, `On Hold`, `Resolved`, `Closed`, …) |
| `priority` | Comma list: `Low`, `Medium`, `High`, `Critical` |
| `ticketType` | Comma list: `Incident`, `Problem`, `Change`, `Request` |
| `assigneeId` | ID user, atau `none` untuk yang belum di-assign |
| `departmentId` / `departmentCode` | Filter dept (`GET /api/v1/meta/departments`) |
| `jobCategoryId`, `queueId` | Filter kategori / queue (`/meta/job-categories`, `/meta/queues`) |
| `slaBreached` | `true` = pernah breach SLA, `false` = belum |
| `q` | Cari di title, trackingId, externalRef, description |
| `hasHumanResponse` | `true` / `false` berdasarkan `firstRespondedAt` |
| `createdSince`, `updatedSince`, `respondedSince` | ISO-8601 |
| `includeComments` | `true` = sertakan komentar publik (maks 50) |
| `view` | `full` (butuh `tickets:read:full`) |
| `limit` / `offset` | 1–100 (default 50) / pagination |

Respons: `{ tickets: [...], pagination: { total, limit, offset, hasMore } }`.

### 3.2 Detail publik (thread yang dilihat pelanggan)

```bash
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/tickets/HSK-XXXX-XXXX"
```

Hanya komentar publik. Cocok untuk agent yang membalas pelanggan.

### 3.3 Detail lengkap (read-only, `tickets:read:full`)

```bash
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/tickets/HSK-XXXX-XXXX/full"
```

Berisi semua yang ada di halaman detail tiket:

| Field | Isi |
|-------|-----|
| field dasar | `trackingId`, `title`, `description`, `status`, `priority`, `ticketType`, `department`, `assignee`, `createdBy`, SLA (`enableSla`, `nextSlaDeadline`, `responseDueAt`, `resolutionDueAt`, `slaBreaches`, `slaTimerMins`), `escalationLevel`, `approvalStatus` |
| `customData` | Field custom (downtime, customer, dll.) |
| `jobCategory`, `queue`, `awardedScore` | Kategori, queue, poin tiket |
| `csat` | `{ score, comment, at }` atau `null` |
| `services` | Layanan terdampak + customer + template + `customData` |
| `comments` | **Semua** komentar (`isPublic` true/false) + attachment |
| `notes` | Internal notes (`noteType`: internal, follow_up, escalation, customer_update) |
| `history` | Audit trail lengkap (`action`, `actor`, `awardedScore`) |
| `attachments` | File tiket; `url` relatif (`/api/uploads/...`) → gabungkan dengan `$HOST` |
| `watchers`, `meetings`, `actionItem` | Watcher, meeting yang membahas tiket, action item terkait |

> Jangan mengirim isi `notes` / komentar `isPublic: false` ke pelanggan.

### 3.4 Data referensi (meta)

```bash
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/meta/departments"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/meta/users?departmentId=1"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/meta/job-categories"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/meta/queues"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/meta/custom-fields"
```

Pakai untuk mengubah ID (assignee, kategori, queue) menjadi nama.

## 4. Dashboard (`dashboard:read`)

```bash
# KPI + category monitor + sky view (global)
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/dashboard"

# Hanya satu dept / satu PIC
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/dashboard?departmentId=1&skyView=false"

# Live Operations Board
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/dashboard/live-ops?date=today"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/dashboard/live-ops?date=week&status=Open,In%20Progress"

# Tiket SLA yang jatuh tempo dalam 15 menit (atau sudah lewat)
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/dashboard/sla-alerts?withinMins=15"
```

`/dashboard` mengembalikan:
- `totals` — `new`, `open`, `inProgress`, `pending`, `resolvedToday`
- `ticketStats`, `avgTtrMins`, `todayResolved`, `categoryMetrics` (active / today / resolvedToday per kategori), `categoryStats`
- Sky view (`skyView` default `true`): `picWorkloads` (tiket aktif per staff), `activeCustomerIncidents` (High/Critical terbuka), `criticalSlaTickets` (10 deadline SLA terdekat)

Param `/dashboard`: `departmentId`, `assigneeId`, `categories` (comma list nama kategori), `skyView`.
Param `/dashboard/live-ops`: `date` (`today` | `week` | `all`), `status`, `category`, `departmentId`, `assigneeId`. Maks 100 tiket, yang breach SLA di atas. Tiket kategori personal (Daily Report / Laporan Harian) tidak ikut, sama seperti di UI.

## 5. Poin & performance (`reports:performance:read`)

```bash
# Poin satu user (sama seperti "Poin saya")
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/performance/12?start=2026-09-01&end=2026-09-30"

# Leaderboard tech + CS (menu Daily Reports)
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/leaderboard?start=2026-09-01&end=2026-09-30"

# Timeline jam kerja tim satu hari
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/work-hours?date=2026-09-29&departmentId=1"
```

- **performance**: `user`, `metrics` (`finalScore`, `taskPoints`, `replyPoints`, `resolvedCount`, `totalInvolvedCount`, `meetingsAttended`, `isCS`, …), `tickets` (dengan `ttrMins`), `categoryTtr`, `activities` (15 terakhir). `start`/`end` opsional.
- **leaderboard**: `techLeaderboard` (urut `taskPoints`), `csLeaderboard` (urut `csEngagementScore`), `globalCategoryTtr`, `skyViewStats` (`resolvedCount`, `avgTtrMins`, `activeOperators`, `leadingDept`). `start` dan `end` harus diisi berdua atau tidak sama sekali.
- **work-hours**: per user → `shift` (`name`, `startTime`, `endTime`, `workMode`, `onCall`), `stats` (`activeHours`, `idleHours`, `overtimeHours`, `onCallHours`, `efficiencyRate`), `segments` (`type`: `active` / `idle` / `overtime` / `oncall`), `activities`, `diligence`. `date` default hari ini (WIB).

Definisi angka (sama di UI dan API):

- `resolvedCount` (performance & leaderboard) = tiket yang di-assign ke user, status `Resolved`, dibuat **atau** terakhir diupdate dalam periode. Poin job-category diberikan ke penulis reply terakhir, jadi user bisa punya `taskPoints` > 0 dengan `resolvedCount` = 0.
- `createdCount` = jumlah tiket yang dibuat user (history `Ticket created…`).
- TTR (`avgMins`, `ttrMins`, `avgTtrMins`) dalam **menit**, dihitung per siklus resolve: dari `reopenedAt` (jika tiket pernah dibuka ulang) atau `createdAt`, sampai `resolvedAt`.
- Skor CS (`csEngagementScore`) = 1 per tiket dibuat + 1 per reply + 1 per aksi status lain.
- Work-hours: shift diambil dari jadwal tanggal `date`. Jam shift mengikuti pola departemen: pola 12 jam (POLA_4/5/6) → S1 08:00–20:00, S2 20:00–08:00; pola lain → jam di master Shift Type. Shift malam dihitung sampai jam selesai esok pagi, dan aktivitas dini hari milik shift malam kemarin tidak dihitung lagi. User tanpa jadwal (OFF / belum di-roster) → `shift.name = "No Shift Scheduled"`, `hasScheduledShift = false`, dan jam S1 pola departemen dipakai untuk menghitung idle.
- On-call (Core `S1+OC`): jam kerja = jam S1 (08:00–17:00), lalu jendela on-call terpisah = jam Shift Type `S1+OC` (22:00–08:00 esok) di `shift.onCall`. Aktivitas di jendela on-call → segmen `oncall` dan `stats.onCallHours` (bukan lembur, bukan idle); aktivitas antara akhir S1 dan mulai on-call tetap `overtime`. Aktivitas pagi hari setelah on-call kemarin masuk ke laporan kemarin. `totalEffectiveHours` = active + overtime + on-call.
- `shift.workMode`: `"wfh"` untuk hari kerja Sabtu/Minggu tim POLA_2 (Core; OFF weekend-nya 1 hari, hari lainnya WFH), selain itu `"office"`. On-call selalu WFH (`shift.onCall.workMode = "wfh"`).

Daftar `userId`: `GET /api/v1/meta/users`.

## 6. SLA & Analytics (`reports:sla:read`)

```bash
# Default 30 hari terakhir (tanggal WIB)
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/sla"

# Periode + filter customer
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/sla?startDate=2026-09-01&endDate=2026-09-30&customer=PT%20ABC"

# Service-desk metrics (panel di atas leaderboard)
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/service-desk?days=30"
```

- **sla**: `summary` (`totalTickets`, `slaBreaches`, `slaComplianceRate`, `uptimePercentage`, `totalDowntimeHours`, `outageCount`), `monthSections` (availability per bulan + daftar outage), `dailyTrend`, `departmentStats`, `incidents`, `letter` (data surat SLA).
- **service-desk**: `volume` (created / resolved / openNow), `sla` (`breachRate`, `resolutionMetPct`, `responseMetPct`), `ttr`, `csat`, `byPriority`, `byType`, `byStatus`. `days` 1–365.

Definisi angka SLA:

- `uptimePercentage` / `monthSections[].availPercent` = rata-rata availability **per pelanggan terdampak** (outage yang tumpang-tindih pada satu pelanggan digabung). `affectedCustomers` = jumlah pelanggan tersebut. Isi `customer` untuk angka satu pelanggan.
- `totalDowntimeHours` = total jam downtime **kumulatif semua pelanggan** (bisa melebihi panjang periode).
- `outageCount` = jumlah tiket dengan downtime di periode. `slaComplianceRate` = tiket tanpa SLA breach (respon/resolusi), berbeda dengan uptime.
- `/reports/sla` memakai tiket yang dibuat, di-resolve, atau diupdate dalam periode; `/reports/service-desk` memakai tiket yang dibuat dalam `days` hari terakhir. Jumlah breach keduanya bisa berbeda.
- `breachRate`, `resolutionMetPct`, `responseMetPct` dalam persen; `breachRate` 2 desimal (mis. `0.04`).
- `byStatus`, `byPriority`, `byType` = tiket yang dibuat dalam jendela `days` (totalnya = `volume.created`). `openNow` = semua tiket open saat ini.

## 7. Daily report (isi laporan harian, `reports:daily:read`)

```bash
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/daily?from=2026-09-01T00:00:00Z&limit=50"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/daily?userId=10&from=2026-09-01T00:00:00Z"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/daily/42"
```

Query: `userId`, `from`, `to`, `limit`, `offset`. Untuk angka poin/leaderboard pakai bagian 5.

## 8. Ops report (`reports:ops:read`)

```bash
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/ops?period=week&anchor=2026-09-25"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/ops?period=month&anchor=2026-09-01"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/ops?period=custom&start=2026-09-01&end=2026-09-30"
```

Respons: `period`, `startDate`, `endDate`, `counts`, `downtime`, `terminate`, `new`, `upgrade`.

## 9. Shift & meeting

```bash
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/schedules?start=2026-10-01&end=2026-10-31&departmentId=1"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/schedules/types"

curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/meetings?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z"
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/meetings/123"
```

Schedules: `start` + `end` wajib, opsional `departmentId`, `locationId`, `userId`.
Meetings: `from`, `to`, `status`, `limit`, `offset`.

## 10. Pola agent yang disarankan

```
setiap 1–5 menit (atau saat webhook tiket masuk):
  1) GET /api/v1/dashboard/sla-alerts?withinMins=15      → eskalasi yang mendesak
  2) GET /api/v1/tickets?status=New&createdSince=<last_poll>
  3) GET /api/v1/tickets?updatedSince=<last_poll>&view=full
  4) GET /api/v1/tickets/{trackingId}/full               → konteks lengkap sebelum analisa

setiap jam / shift:
  5) GET /api/v1/dashboard                               → ringkasan beban & insiden
  6) GET /api/v1/dashboard/live-ops?date=today
  7) GET /api/v1/schedules?start=<hari ini>&end=<hari ini>  → siapa yang on-shift

harian / mingguan:
  8) GET /api/v1/reports/leaderboard?start=&end=
  9) GET /api/v1/reports/sla?startDate=&endDate=
 10) GET /api/v1/reports/service-desk?days=7
 11) GET /api/v1/reports/ops?period=week
 12) GET /api/v1/reports/work-hours?date=<kemarin>
```

Simpan watermark `last_poll` (pakai `updatedAt` terbesar yang diterima) agar tidak memproses ulang. Untuk report besar (SLA, leaderboard, work-hours) cache hasilnya di sisi agent. Endpoint ini menghitung ulang setiap request.

## 11. Webhook tiket (opsional)

Event: `ticket.created`, `ticket.commented`, `ticket.status_changed`, `ticket.resolved`, `ticket.sla_breached`.

Header: `X-NOC-Event`, `X-NOC-Signature` (HMAC-SHA256 body dengan webhook secret), `X-NOC-App`.
Setelah event → `GET /api/v1/tickets/{trackingId}/full` (atau `/tickets/{trackingId}` bila hanya punya `tickets:read`).

Dashboard / report / shift / meeting **belum** punya webhook; gunakan poll berkala.

## 12. Checklist keamanan

- Simpan key di secret store agent, jangan di prompt / log / repo
- Satu Integration App per agent, scope seminimal mungkin
- `tickets:read` = hanya komentar publik; `tickets:read:full` = termasuk catatan internal → jangan diteruskan ke pelanggan
- Report & dashboard setara akses Admin/Manager di UI
- Data pribadi (email, poin staff) jangan dikirim ke pihak luar / model publik tanpa izin
- Rotasi key: buat key baru → update agent → nonaktifkan app lama
- Legacy global key (`EXTERNAL_API_KEY` / Settings `externalApiKey`) otomatis punya **semua** scope; lebih aman pakai Integration App per agent

## 13. Troubleshooting

| Gejala | Cek |
|--------|-----|
| `401` | Header `X-API-Key` hilang/salah, atau app nonaktif |
| `403` + `missingScopes` | Centang scope di Settings → Integrations → Edit scopes |
| `429` | Rate limit; kurangi frekuensi poll atau naikkan limit app |
| `400 Invalid ...` | Format param (`YYYY-MM-DD`, angka, enum) |
| List tiket kosong | Filter `createdSince` / `status` terlalu ketat |
| `view=full` 403 | Butuh scope `tickets:read:full` |
| Leaderboard 400 | `start` dan `end` harus diisi keduanya |
| Schedules 400 | `start` dan `end` wajib |
| Ops kosong | Periode / job category tidak cocok data |
