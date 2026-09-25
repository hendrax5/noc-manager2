# Panduan: Agent AI membaca tiket NOC Manager

Cara membuat Integration API key dan mem-poll tiket yang baru dibuat atau sudah direspons manusia.

## 1. Buat API key

1. Buka **Settings → Integrations**
2. Buat Integration App (mis. `ai-agent`)
3. Centang scope minimal:
   - `tickets:read` — wajib (list + detail)
   - `tickets:comment` — opsional, jika agent boleh balas
4. Simpan key (`noc_...`) — hanya ditampilkan sekali
5. (Opsional) isi **Webhook URL** untuk event realtime

## 2. Auth

Semua request:

```http
X-API-Key: noc_xxxxxxxx...
```

Base URL production: host ewo2 (port 3000 / URL publik yang dipakai).

Spec mesin: `GET /api/v1/openapi`  
Referensi lengkap: [API_V1.md](./API_V1.md)

## 3. Poll tiket

### Tiket baru (belum / baru dibuat)

```bash
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?status=New&createdSince=2026-09-25T00:00:00Z&limit=50"
```

### Sudah direspons manusia

Staff reply biasanya mengisi `firstRespondedAt` dan status sering jadi `Pending` (menunggu user).

```bash
# Berdasarkan first response
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?hasHumanResponse=true&updatedSince=2026-09-25T00:00:00Z&limit=50"

# Atau filter status Pending
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?status=Pending&updatedSince=2026-09-25T00:00:00Z&limit=50"
```

### Thread lengkap satu tiket

```bash
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets/HSK-XXXX-XXXX"
```

Komentar publik (max 50) ikut di field `comments`.

### List + embed komentar

```bash
curl -s -H "X-API-Key: $KEY" \
  "$HOST/api/v1/tickets?hasHumanResponse=true&includeComments=true&limit=20"
```

## 4. Query params (list)

| Param | Contoh | Arti |
|-------|--------|------|
| `status` | `New` atau `Pending,Open` | Filter status |
| `hasHumanResponse` | `true` / `false` | Ada / belum `firstRespondedAt` |
| `createdSince` | ISO-8601 | Dibuat sejak |
| `updatedSince` | ISO-8601 | Diupdate sejak |
| `respondedSince` | ISO-8601 | First response sejak |
| `departmentId` / `departmentCode` | `1` / `noc-core` | Filter dept |
| `includeComments` | `true` | Sertakan komentar publik |
| `limit` | `1`–`100` (default 50) | Ukuran halaman |
| `offset` | `0`, `50`, … | Pagination |

Respons:

```json
{
  "tickets": [ { "trackingId": "...", "status": "...", "hasHumanResponse": true, "..." : "..." } ],
  "pagination": { "total": 12, "limit": 50, "offset": 0, "hasMore": false }
}
```

Field penting per tiket: `trackingId`, `status`, `firstRespondedAt`, `hasHumanResponse`, `publicCommentCount`, `assignee`, `updatedAt`, `trackUrl`.

## 5. Pola agent yang disarankan

```
loop setiap N menit (atau webhook):
  1) GET /api/v1/tickets?status=New&createdSince=<last_poll>
     → review / ringkas tiket baru
  2) GET /api/v1/tickets?hasHumanResponse=true&updatedSince=<last_poll>
     → baca balasan manusia
  3) untuk tiap trackingId yang relevan:
     GET /api/v1/tickets/{trackingId}
     → ambil deskripsi + komentar penuh
  4) (opsional) POST .../comments jika boleh membalas
```

Simpan `last_poll` (watermark `updatedSince` / `createdSince`) agar tidak memproses ulang semua tiket.

## 6. Webhook (opsional, realtime)

Di Integration App, set `webhookUrl`. Event:

- `ticket.created`
- `ticket.commented`
- `ticket.status_changed`
- `ticket.resolved`
- `ticket.sla_breached`

Header: `X-NOC-Event`, `X-NOC-Signature` (HMAC-SHA256 body + webhook secret), `X-NOC-App`.

Payload lean (id/status/title + cuplikan komentar). Setelah event, agent tetap `GET` detail by `trackingId`.

## 7. Checklist keamanan

- Key hanya di secret store agent (jangan di repo / chat)
- Scope minimal: `tickets:read` saja jika agent read-only
- Jangan expose internal notes: API v1 hanya komentar **publik**
- Rate limit per app (default ~60 req/menit) — jangan spam list tanpa watermark

## 8. Troubleshooting

| Gejala | Cek |
|--------|-----|
| `401 missing X-API-Key` | Header salah / kosong |
| `403` scope | App belum punya `tickets:read` |
| List kosong | Filter `createdSince` terlalu ketat / status tidak cocok |
| Tidak ada `hasHumanResponse` | Tiket belum pernah dapat komentar yang mengisi `firstRespondedAt` |
| Butuh dept list | `GET /api/v1/meta/departments` |
