# Shift Fairness Report — Design

**Date:** 2026-07-31  
**Status:** Approved for implementation planning  
**Product:** NOC Manager (`noc-manager2`)  
**Related:** Absen Shift Scheduler UI (`Documents/absen/frontend`), `docs/SCHEDULE_POLA.md`

## Goal

Give managers a fairness view of the monthly roster — per person counts of S1 / S2 / S3 / OC / OFF, **lembur**, working days, and total hours — matching the absen app’s “Ringkasan” table, plus export. Lembur means **called in on a day that was originally OFF**.

## Decisions (confirmed)

| Topic | Choice |
|-------|--------|
| Lembur definition | Day was OFF in generated roster, later changed to a working shift |
| Detection | Snapshot at Generate **and** manual override |
| Placement | Both: above schedule grid **and** standalone Reports page |
| Approach | Extend `ShiftSchedule` with `generatedShiftTypeId` + `isLembur` (not a separate snapshot table) |

## Out of scope (v1)

- National public holidays as lembur
- Multi-version generate history
- Payroll / money calculation for overtime
- Changing OR-Tools fairness constraints (report only; solver already balances soft/hard)

---

## Data model

### `ShiftSchedule` additions

```prisma
generatedShiftTypeId  Int?       // shift written by last POLA generate for this cell; null = generated OFF
generatedShiftType    ShiftType? @relation(...)
isLembur              Boolean    @default(false)
```

| Field | Meaning |
|-------|---------|
| `shiftTypeId` | Current displayed shift (`null` = OFF) — unchanged |
| `generatedShiftTypeId` | Baseline from last successful generate for that user/date (`null` = was OFF) |
| `isLembur` | Explicit flag; see rules below |

Existing cells (pre-migration): `generatedShiftTypeId` stays `null`, `isLembur` stays `false`. Auto-lembur only applies after a generate that populated the baseline (or after a PATCH that sets the flag).

### Lembur rules

**Working shift** = name in `{S1, S2, S3, S1+OC}` (non-null `shiftTypeId` mapping to those names).

1. **On Generate POLA** (after department-month wipe + write):  
   - For each created row: `generatedShiftTypeId = shiftTypeId`, `isLembur = false`.

2. **On cell PATCH** (edit shift / swap):  
   - After update, recompute default:  
     `isLembur = (current is working) AND (generated was OFF)`  
     i.e. `shiftTypeId != null` (working) **and** `generatedShiftTypeId == null`.  
   - If the client sends `isLembur` explicitly in the body, **that value wins** (manual override).  
   - Changing a cell back to OFF → `isLembur = false` (unless client forces true — UI should not allow lembur on OFF).

3. **Swap**: apply the same recompute (or explicit flags) to both cells after swap.

4. **Display / reports**: count a day as lembur iff `isLembur === true`.

### Hours per shift (same as absen)

| Pola | Hours per working day |
|------|------------------------|
| POLA_1, POLA_3 | 9 |
| POLA_2 | 8 |
| POLA_4, POLA_5, POLA_6 | 12 |

`totalHours = workDays * hoursPerShift` where `workDays` = count of working shifts in the month (not OFF).

---

## Summary columns (by pola)

Mirror absen `getShiftSummaryConfig` / `buildShiftSummaryRows`:

| Pola | Columns |
|------|---------|
| POLA_2 | Nama, Plain S1, OC, S2, OFF, Lembur, Kerja, Total Jam |
| POLA_4 / 5 / 6 | Nama, S1, S2, OFF, Lembur, Kerja, Total Jam |
| POLA_1 / 3 (default) | Nama, S1, S2, S3, OFF, Lembur, Kerja, Total Jam |

- **Plain S1** = cell `S1` only (not `S1+OC`)  
- **OC** = `S1+OC`  
- **Kerja** = Plain S1 + S2 + S3 + OC (all working)  
- **Lembur** = days with `isLembur`  
- Fairness hint (UI only): highlight a count cell if that person’s value differs from department median by ≥ 2 (optional polish; not required for v1 API)

---

## Components

### Shared lib — `lib/schedules/fairness.js`

- `hoursPerShift(pola)`  
- `summaryColumns(pola)`  
- `buildPersonSummary({ schedules, user, pola, daysInMonth })` → row object  
- `isWorkingShiftName(name)`  
- `computeIsLembur({ shiftTypeId, generatedShiftTypeId, explicit })`

Pure functions; used by API and client export.

### Generate — `lib/schedules/generatePola.js`

In the transaction that deletes + `createMany`, include `generatedShiftTypeId` and `isLembur: false` on every row.

### API

| Endpoint | Role |
|----------|------|
| Existing `PATCH /api/schedules` | Accept optional `isLembur`; recompute default when shift changes |
| `GET /api/reports/shifts?year=&month=&departmentId=` | Auth: can edit schedules **or** `view_reports` / Admin. Returns `{ pola, hoursPerShift, columns, rows[], fairnessNotes? }` |

### UI — Schedules (`SchedulesClient`)

1. Card **Ringkasan fairness** above the calendar grid (filtered by current month + department).  
2. Grid header: add **Total Jam** column (per row).  
3. Cell editor: checkbox **Lembur (panggil dari OFF)** — enabled only when current shift is working; shown with hint when auto-detected.  
4. **Export Excel**: extend `exportExcel.js` — summary sheet/section + Total Jam + Lembur counts (HTML workbook style already used).

### UI — Reports (`/reports/shifts`)

- New page + client, linked under Administration next to Ops Report.  
- Filters: year, month, department.  
- Same summary table + Export.  
- Access: Manager / Admin / `view_reports` / `manage_schedules` (align with `canEditSchedules` ∪ report viewers).

### Migration

- Prisma migrate: add nullable `generatedShiftTypeId`, `isLembur` default false.  
- No backfill of baseline; managers re-generate month if they need auto-lembur for that month.

---

## Data flow

```
Generate POLA
  → wipe dept month
  → create rows with shiftTypeId + generatedShiftTypeId + isLembur=false

Manager edits cell OFF → S1
  → PATCH sets shiftTypeId=S1
  → server sets isLembur=true (auto) unless body.isLembur provided

GET /api/reports/shifts or client summary from loaded schedules
  → aggregate counts + hours
  → render table / Excel
```

## Error handling

- Report with no schedules: empty table + message (same tone as Ops Report).  
- Unknown pola: fall back to POLA_1 column set + 9h.  
- PATCH with `isLembur: true` while shift is OFF → `400` with clear error.  
- Users without access → `401` / `403`.

## Testing (acceptance)

1. Generate CS (or Sisterc) for a month → all `isLembur` false; summary S1/S2/OFF sum to days in month per person.  
2. Edit one OFF → S2 → that day `isLembur` true; Lembur column +1; uncheck Lembur → flag false but shift stays S2.  
3. Export Excel includes Total Jam and Lembur.  
4. `/reports/shifts` matches summary on Schedules for same filters.  
5. Staff without edit/report permission cannot open report API.

## Architecture notes

- Prefer computing summary **server-side** for `/reports/shifts` (single source). Schedules page may compute client-side from already-fetched `/api/schedules` for snappiness, using the same `lib/schedules/fairness.js` helpers so formulas cannot drift.  
- Do not store `totalHours` in DB — always derived.
