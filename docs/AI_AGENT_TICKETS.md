# Panduan: Agent AI + Integration API

Cara membuat API key dan mem-poll **tiket**, **shift**, **meeting**, **daily report**, dan **ops report**.

Referensi teknis: [API_V1.md](./API_V1.md) · OpenAPI: `GET /api/v1/openapi`

## 1. Buat API key

1. Buka **Settings → Integrations**
2. Buat Integration App (mis. `ai-agent`) **atau** pada app yang sudah ada klik **Edit scopes**
3. Centang scope yang dibutuhkan:

| Scope | Fungsi |
|-------|--------|
| `tickets:read` | List + detail tiket |
| `tickets:comment` | Opsional — balas komentar |
| `schedules:read` | Roster shift + tipe shift |
| `meetings:read` | List + detail meeting |
| `reports:daily:read` | Daily report |
| `reports:ops:read` | Ops report (downtime / new / upgrade / terminate) |

4. Simpan key (`noc_...`) — hanya ditampilkan sekali
5. (Opsional) isi **Webhook URL** untuk event tiket realtime

## 2. Auth

```http
X-API-Key: noc_xxxxxxxx...
```

Base URL: host production (ewo2 / URL publik).

## 3. Tiket

### Tiket baru

```bash
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?status=New&createdSince=2026-09-25T00:00:00Z&limit=50"
```

### Sudah direspons manusia

```bash
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?hasHumanResponse=true&updatedSince=2026-09-25T00:00:00Z&limit=50"

# atau
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?status=Pending&updatedSince=2026-09-25T00:00:00Z&limit=50"
```

### Thread lengkap

```bash
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/tickets/HSK-XXXX-XXXX"
```

Query list: `status`, `hasHumanResponse`, `createdSince`, `updatedSince`, `respondedSince`, `departmentId`/`departmentCode`, `includeComments`, `limit`, `offset`.

Field penting: `trackingId`, `status`, `firstRespondedAt`, `hasHumanResponse`, `publicCommentCount`, `assignee`, `updatedAt`, `trackUrl`.

## 4. Shift (schedules)

```bash
# Roster bulan
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/schedules?start=2026-10-01&end=2026-10-31&departmentId=1"

# Katalog tipe shift
curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/schedules/types"
```

| Param | Wajib | Keterangan |
|-------|-------|------------|
| `start`, `end` | ya | `YYYY-MM-DD` |
| `departmentId` | tidak | Filter dept |
| `locationId` | tidak | Filter lokasi |
| `userId` | tidak | Satu orang |

Respons: `{ start, end, count, schedules: [{ date, shift, isLembur, user }] }`

## 5. Meeting

```bash
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/meetings?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z&limit=50"

curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/meetings/123"
```

List query: `from`, `to`, `status`, `limit`, `offset`.  
Detail: organizer, attendees, sessions, action items.

## 6. Daily report

```bash
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/daily?from=2026-09-01T00:00:00Z&limit=50"

curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/daily?userId=10&from=2026-09-01T00:00:00Z"

curl -s -H "X-API-Key: $KEY" "$HOST/api/v1/reports/daily/42"
```

List query: `userId`, `from`, `to`, `limit`, `offset`.

## 7. Ops report

```bash
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/ops?period=week&anchor=2026-09-25"

curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/ops?period=month&anchor=2026-09-01"

curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/reports/ops?period=custom&start=2026-09-01&end=2026-09-30"
```

Respons: `period`, `startDate`, `endDate`, `counts`, `downtime`, `terminate`, `new`, `upgrade` (sama seperti UI Ops Report).

## 8. Pola agent yang disarankan

```
loop setiap N menit (atau webhook tiket):
  1) GET /api/v1/tickets?status=New&createdSince=<last_poll>
  2) GET /api/v1/tickets?hasHumanResponse=true&updatedSince=<last_poll>
  3) GET /api/v1/tickets/{trackingId} untuk thread penuh
  4) GET /api/v1/schedules?start=&end=&departmentId=  (roster hari/minggu)
  5) GET /api/v1/meetings?from=&to=  (meeting terjadwal)
  6) GET /api/v1/reports/daily?from=  (laporan harian)
  7) GET /api/v1/reports/ops?period=week  (ringkas ops)
```

Simpan watermark `last_poll` agar tidak memproses ulang semua data.

## 9. Webhook tiket (opsional)

Event: `ticket.created`, `ticket.commented`, `ticket.status_changed`, `ticket.resolved`, `ticket.sla_breached`.

Header: `X-NOC-Event`, `X-NOC-Signature` (HMAC-SHA256), `X-NOC-App`.  
Setelah event → `GET /api/v1/tickets/{trackingId}`.

Shift / meeting / daily / ops **belum** punya webhook; gunakan poll berkala.

## 10. Checklist keamanan

- Key hanya di secret store agent
- Scope minimal sesuai kebutuhan (read-only)
- Tiket v1 hanya komentar **publik** (bukan internal notes)
- `reports:ops:read` setara akses Manager/Admin di UI — berikan hanya ke agent tepercaya
- Rate limit ~60 req/menit per app

## 11. Troubleshooting

| Gejala | Cek |
|--------|-----|
| `401` | Header `X-API-Key` hilang/salah |
| `403` + missingScopes | Centang scope di Integrations, simpan ulang |
| List tiket kosong | Filter `createdSince` / status terlalu ketat |
| Schedules 400 | `start` dan `end` wajib |
| Ops kosong | Periode / job category tidak cocok data |
| Dept list | `GET /api/v1/meta/departments` (butuh scope tiket create atau read) |
