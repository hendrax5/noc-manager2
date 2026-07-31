# Shift Fairness Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-person shift fairness summary (S1/S2/S3/OC/OFF, lembur, kerja, total jam) on Schedules + `/reports/shifts`, with Generate snapshot + manual lembur override.

**Architecture:** Extend `ShiftSchedule` with `generatedShiftTypeId` + `isLembur`. Pure helpers in `lib/schedules/fairness.js` drive both client summary and `GET /api/reports/shifts`. Generate writes baselines; PATCH auto-sets or accepts explicit `isLembur`.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, existing HTML Excel export (`lib/schedules/exportExcel.js`), `node --test` for pure helper tests (no Jest in repo).

**Spec:** `docs/superpowers/specs/2026-07-31-shift-fairness-report-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | Add `generatedShiftTypeId`, `isLembur` on `ShiftSchedule` |
| `lib/schedules/fairness.js` | Hours, columns, person summary, lembur compute |
| `lib/schedules/fairness.test.mjs` | Unit tests for fairness helpers |
| `lib/schedules/generatePola.js` | Set baseline fields on createMany |
| `lib/schedules/access.js` | `canViewShiftFairnessReport(user)` |
| `app/api/schedules/route.js` | GET returns new fields; PATCH/swap lembur logic |
| `lib/schedules/exportExcel.js` | Summary block + Total Jam column |
| `app/team/schedules/SchedulesClient.js` | Ringkasan card, Total Jam, lembur checkbox |
| `app/api/reports/shifts/route.js` | Aggregated fairness API |
| `app/reports/shifts/page.js` | Server gate + header |
| `app/reports/shifts/ShiftFairnessClient.js` | Filters, table, export |
| `components/Navbar.js` | Link under Administration |
| `docs/SCHEDULE_POLA.md` | Short note on fairness report / lembur |

---

### Task 1: Fairness helpers + unit tests

**Files:**
- Create: `lib/schedules/fairness.js`
- Create: `lib/schedules/fairness.test.mjs`

- [ ] **Step 1: Write the test file first**

```js
// lib/schedules/fairness.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hoursPerShift,
  summaryColumns,
  isWorkingShiftName,
  computeIsLembur,
  buildPersonSummary,
  buildDeptSummaries,
} from "./fairness.js";

describe("hoursPerShift", () => {
  it("maps pola hours", () => {
    assert.equal(hoursPerShift("POLA_1"), 9);
    assert.equal(hoursPerShift("POLA_2"), 8);
    assert.equal(hoursPerShift("POLA_5"), 12);
    assert.equal(hoursPerShift("UNKNOWN"), 9);
  });
});

describe("computeIsLembur", () => {
  it("auto: working + generated OFF", () => {
    assert.equal(computeIsLembur({ shiftTypeId: 1, generatedShiftTypeId: null }), true);
  });
  it("auto: working + generated same work → false", () => {
    assert.equal(computeIsLembur({ shiftTypeId: 1, generatedShiftTypeId: 1 }), false);
  });
  it("auto: OFF → false", () => {
    assert.equal(computeIsLembur({ shiftTypeId: null, generatedShiftTypeId: null }), false);
  });
  it("explicit wins", () => {
    assert.equal(
      computeIsLembur({ shiftTypeId: 1, generatedShiftTypeId: null, explicit: false }),
      false
    );
    assert.equal(
      computeIsLembur({ shiftTypeId: 1, generatedShiftTypeId: 2, explicit: true }),
      true
    );
  });
});

describe("buildPersonSummary", () => {
  it("counts POLA_2 plain S1 vs OC and lembur", () => {
    const row = buildPersonSummary({
      pola: "POLA_2",
      user: { id: 1, name: "Ada", email: "a@x" },
      daysInMonth: 3,
      cells: [
        { shiftName: "S1", isLembur: false },
        { shiftName: "S1+OC", isLembur: false },
        { shiftName: "S2", isLembur: true },
      ],
    });
    assert.equal(row.plainS1, 1);
    assert.equal(row.oc, 1);
    assert.equal(row.s2, 1);
    assert.equal(row.lembur, 1);
    assert.equal(row.kerja, 3);
    assert.equal(row.totalHours, 24); // 3 * 8
    assert.equal(row.off, 0);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `node --test lib/schedules/fairness.test.mjs`  
Expected: ERR_MODULE_NOT_FOUND or similar for `./fairness.js`

- [ ] **Step 3: Implement `lib/schedules/fairness.js`**

```js
/** Shift fairness / ringkasan helpers (absen-compatible). */

export const WORKING_SHIFT_NAMES = Object.freeze(["S1", "S2", "S3", "S1+OC"]);

export function hoursPerShift(pola) {
  const p = String(pola || "POLA_1").toUpperCase();
  if (p === "POLA_2") return 8;
  if (p === "POLA_4" || p === "POLA_5" || p === "POLA_6") return 12;
  return 9; // POLA_1, POLA_3, unknown
}

export function summaryColumns(pola) {
  const p = String(pola || "POLA_1").toUpperCase();
  if (p === "POLA_2") {
    return [
      { key: "plainS1", label: "Plain S1" },
      { key: "oc", label: "OC" },
      { key: "s2", label: "S2" },
      { key: "off", label: "OFF" },
      { key: "lembur", label: "Lembur" },
      { key: "kerja", label: "Kerja" },
      { key: "totalHours", label: "Total Jam" },
    ];
  }
  if (p === "POLA_4" || p === "POLA_5" || p === "POLA_6") {
    return [
      { key: "s1", label: "S1" },
      { key: "s2", label: "S2" },
      { key: "off", label: "OFF" },
      { key: "lembur", label: "Lembur" },
      { key: "kerja", label: "Kerja" },
      { key: "totalHours", label: "Total Jam" },
    ];
  }
  return [
    { key: "s1", label: "S1" },
    { key: "s2", label: "S2" },
    { key: "s3", label: "S3" },
    { key: "off", label: "OFF" },
    { key: "lembur", label: "Lembur" },
    { key: "kerja", label: "Kerja" },
    { key: "totalHours", label: "Total Jam" },
  ];
}

export function isWorkingShiftName(name) {
  if (name == null || name === "" || name === "OFF") return false;
  return WORKING_SHIFT_NAMES.includes(String(name).toUpperCase());
}

/**
 * @param {{ shiftTypeId: number|null, generatedShiftTypeId: number|null, explicit?: boolean }} args
 * explicit undefined → auto; boolean → override
 */
export function computeIsLembur({ shiftTypeId, generatedShiftTypeId, explicit }) {
  if (explicit === true || explicit === false) return explicit;
  const working = shiftTypeId != null;
  const generatedOff = generatedShiftTypeId == null;
  if (!working) return false;
  return generatedOff;
}

/**
 * @param {{ pola: string, user: {id,name,email}, daysInMonth: number, cells: {shiftName:string|null, isLembur:boolean}[] }} args
 */
export function buildPersonSummary({ pola, user, daysInMonth, cells }) {
  let plainS1 = 0,
    oc = 0,
    s2 = 0,
    s3 = 0,
    off = 0,
    lembur = 0;

  for (const c of cells) {
    const name =
      c.shiftName == null || c.shiftName === ""
        ? "OFF"
        : String(c.shiftName).toUpperCase();
    if (c.isLembur) lembur++;
    if (name === "S1") plainS1++;
    else if (name === "S1+OC") oc++;
    else if (name === "S2") s2++;
    else if (name === "S3") s3++;
    else off++;
  }
  if (cells.length < daysInMonth) off += daysInMonth - cells.length;

  const kerja = plainS1 + oc + s2 + s3;
  const h = hoursPerShift(pola);
  return {
    userId: user.id,
    name: user.name || user.email || `#${user.id}`,
    plainS1,
    oc,
    s1: plainS1, // POLA_1/3/4 columns use key "s1"
    s2,
    s3,
    off,
    lembur,
    kerja,
    totalHours: kerja * h,
  };
}

/**
 * schedules: [{ userId, user, shiftType?: { name }, shiftTypeId, isLembur }]
 */
export function buildDeptSummaries({ schedules, pola, year, month }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const byUser = new Map();
  for (const s of schedules) {
    if (!byUser.has(s.userId)) {
      byUser.set(s.userId, { user: s.user, cells: [] });
    }
    const name =
      s.shiftType?.name ?? (s.shiftTypeId == null ? "OFF" : null);
    byUser.get(s.userId).cells.push({
      shiftName: name,
      isLembur: !!s.isLembur,
    });
  }
  const rows = [...byUser.values()].map(({ user, cells }) =>
    buildPersonSummary({ pola, user, daysInMonth, cells })
  );
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name), "id"));
  return {
    pola,
    hoursPerShift: hoursPerShift(pola),
    columns: summaryColumns(pola),
    daysInMonth,
    rows,
  };
}
```

Note: callers must `include: { shiftType: true }` so OFF vs named shifts resolve. If `shiftTypeId` set but `shiftType` missing, treat cautiously — prefer always including relation.


- [ ] **Step 4: Run tests — expect PASS**

Run: `node --test lib/schedules/fairness.test.mjs`  
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/schedules/fairness.js lib/schedules/fairness.test.mjs
git commit -m "feat(schedules): add fairness summary helpers and unit tests"
```

---

### Task 2: Prisma schema + migrate

**Files:**
- Modify: `prisma/schema.prisma` (`ShiftSchedule` + `ShiftType` relation back-field)

- [ ] **Step 1: Update schema**

On `ShiftType` add:

```prisma
generatedSchedules ShiftSchedule[] @relation("GeneratedShiftBaseline")
```

On `ShiftSchedule` add:

```prisma
generatedShiftTypeId Int?
generatedShiftType   ShiftType? @relation("GeneratedShiftBaseline", fields: [generatedShiftTypeId], references: [id])
isLembur             Boolean   @default(false)
```

Keep existing `shiftType` relation as-is.

- [ ] **Step 2: Create migration**

Run: `npx prisma migrate dev --name shift_fairness_lembur`  
Expected: migration applied locally; client generated.

If Docker-only DB: `npx prisma migrate deploy` against prod URL is a later deploy step — locally ensure migrate succeeds.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(prisma): add generatedShiftTypeId and isLembur on ShiftSchedule"
```

---

### Task 3: Generate POLA writes baseline

**Files:**
- Modify: `lib/schedules/generatePola.js` (creates array ~lines 211–221)

- [ ] **Step 1: Include baseline on create**

Change each `creates.push` to:

```js
creates.push({
  userId: row.userId,
  date: dateOnlyToUtcDate(dateStr),
  shiftTypeId,
  generatedShiftTypeId: shiftTypeId,
  isLembur: false,
});
```

- [ ] **Step 2: Sanity-check** — no other code paths create monthly bulk schedules without baseline (grep `shiftSchedule.create`).

- [ ] **Step 3: Commit**

```bash
git add lib/schedules/generatePola.js
git commit -m "feat(schedules): stamp generated baseline and clear isLembur on POLA generate"
```

---

### Task 4: Schedules API GET/PATCH/swap

**Files:**
- Modify: `app/api/schedules/route.js`
- Modify: `lib/schedules/access.js` (add viewer helper used later)

- [ ] **Step 1: GET include new fields**

In `findMany` include, add:

```js
generatedShiftTypeId: true, // selected via default scalar; ensure not stripped
isLembur: true,
generatedShiftType: { select: { id: true, name: true } },
```

Scalars are returned automatically once in schema; include `generatedShiftType` for debug/UI.

- [ ] **Step 2: PATCH lembur logic**

After building `data` from shift/highlight/note, before upsert:

1. Load existing row: `findUnique({ where: { userId_date } })`.
2. Resolve next `shiftTypeId` = `data.shiftTypeId` if present else existing.
3. `generatedShiftTypeId` stays existing (never change on PATCH unless create with null generated).
4. On **create** of a brand-new cell (no prior generate): `generatedShiftTypeId: null`.
5. Compute:

```js
import { computeIsLembur } from "@/lib/schedules/fairness";

const explicit =
  body.isLembur === true || body.isLembur === false ? body.isLembur : undefined;
const nextShiftTypeId =
  data.shiftTypeId !== undefined ? data.shiftTypeId : existing?.shiftTypeId ?? null;
const generatedId = existing?.generatedShiftTypeId ?? null;

if (explicit === true && nextShiftTypeId == null) {
  return NextResponse.json(
    { error: "isLembur tidak boleh true saat shift OFF" },
    { status: 400 }
  );
}

if (body.shift != null || body.shiftTypeId !== undefined || body.isLembur !== undefined) {
  data.isLembur = computeIsLembur({
    shiftTypeId: nextShiftTypeId,
    generatedShiftTypeId: generatedId,
    explicit,
  });
}
```

6. On create payload, also pass `isLembur` and `generatedShiftTypeId: null`.

- [ ] **Step 3: Swap — recompute isLembur for both cells**

When swapping, exchange `shiftTypeId` / highlight / note as today, but **do not swap** `generatedShiftTypeId`. After swap payloads applied, set each cell:

```js
isLembur: computeIsLembur({
  shiftTypeId: newShiftTypeIdForCell,
  generatedShiftTypeId: thatCell.generatedShiftTypeId,
  // no explicit
})
```

Include `generatedShiftTypeId` in findUnique results.

- [ ] **Step 4: Commit**

```bash
git add app/api/schedules/route.js
git commit -m "feat(schedules): auto and manual isLembur on cell edit and swap"
```

---

### Task 5: Report access + API

**Files:**
- Modify: `lib/schedules/access.js`
- Create: `app/api/reports/shifts/route.js`

- [ ] **Step 1: Access helper**

```js
export function canViewShiftFairnessReport(user) {
  if (!user) return false;
  if (user.role === "Admin" || user.role === "Manager") return true;
  if (user.permissions?.includes("view_reports")) return true;
  if (user.permissions?.includes("manage_schedules")) return true;
  return false;
}
```

- [ ] **Step 2: Implement GET `/api/reports/shifts`**

Query params: `year`, `month` (1–12), `departmentId` (required).

Logic:
1. Session + `canViewShiftFairnessReport` else 401/403.
2. Load department (`schedulePola`).
3. Date range monthStart–monthEnd via `dateOnlyToUtcDate` (same as generatePola).
4. `shiftSchedule.findMany` where `user.departmentId` and date in range; include `user`, `shiftType`.
5. `buildDeptSummaries({ schedules, pola: dept.schedulePola, year, month })`.
6. Return JSON `{ departmentId, department: dept.name, ...summary }`.

- [ ] **Step 3: Commit**

```bash
git add lib/schedules/access.js app/api/reports/shifts/route.js
git commit -m "feat(reports): add shift fairness API"
```

---

### Task 6: Schedules UI — ringkasan + Total Jam + lembur checkbox

**Files:**
- Modify: `app/team/schedules/SchedulesClient.js`

- [ ] **Step 1: Import helpers**

```js
import {
  hoursPerShift,
  summaryColumns,
  buildPersonSummary,
  buildDeptSummaries,
} from "@/lib/schedules/fairness";
```

- [ ] **Step 2: Derive pola for filtered department**

From `departments` prop + `calDepartment`, read `schedulePola` (ensure `page.js` selects `schedulePola` on departments — add if missing).

- [ ] **Step 3: Build summary from `gridData` / `schedules`**

Map current month schedules for selected dept into `buildDeptSummaries` input shape (include `isLembur` from API).

Render a card above the grid:

```jsx
<div style={{ marginBottom: "1rem", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
  <div style={{ background: "#0f172a", color: "#fff", padding: "0.5rem 0.75rem" }}>
    <strong>{deptName} — Ringkasan {monthName} {calYear}</strong>
    <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>Distribusi shift per orang (fairness)</div>
  </div>
  <table>...</table>
</div>
```

- [ ] **Step 4: Add Total Jam column** on employee rows (after name sticky col): show `row.totalHours` from matching summary row.

- [ ] **Step 5: Cell editor — lembur checkbox**

When `cellEditor` open and shift is working, show:

```jsx
<label>
  <input
    type="checkbox"
    checked={!!cellEditor.isLembur}
    onChange={(e) => setCellEditor({ ...cellEditor, isLembur: e.target.checked })}
  />
  Lembur (panggil dari OFF)
</label>
```

On save PATCH include `isLembur: cellEditor.isLembur`. Initialize editor from `cell.isLembur`.

- [ ] **Step 6: Commit**

```bash
git add app/team/schedules/SchedulesClient.js app/team/schedules/page.js
git commit -m "feat(schedules): show fairness ringkasan, total jam, and lembur checkbox"
```

---

### Task 7: Export Excel with summary

**Files:**
- Modify: `lib/schedules/exportExcel.js`
- Modify: `app/team/schedules/SchedulesClient.js` (pass summary into export)

- [ ] **Step 1: Extend export function signature**

```js
export function exportScheduleMatrixExcel({
  title,
  year,
  month,
  dayHeaders,
  rows,
  filename,
  summary, // { columns, rows, hoursPerShift } | null
}) {
```

Before the day grid table, if `summary`, render an HTML table of Nama + each column key.

Add column **Total Jam** on the day-grid header and each data row (`row.totalHours`).

- [ ] **Step 2: Wire SchedulesClient export** to pass summary + totalHours on each export row.

- [ ] **Step 3: Commit**

```bash
git add lib/schedules/exportExcel.js app/team/schedules/SchedulesClient.js
git commit -m "feat(schedules): include fairness summary and total hours in Excel export"
```

---

### Task 8: Reports page + Navbar

**Files:**
- Create: `app/reports/shifts/page.js`
- Create: `app/reports/shifts/ShiftFairnessClient.js`
- Modify: `components/Navbar.js`
- Modify: `app/team/schedules/page.js` only if departments query needs fields (done in Task 6)

- [ ] **Step 1: Page gate** (mirror Ops Report)

```js
import { canViewShiftFairnessReport } from "@/lib/schedules/access";
// redirect if !canViewShiftFairnessReport
// load departments for filter: id, name, schedulePola
```

- [ ] **Step 2: Client** — year/month/dept selects, fetch `/api/reports/shifts?...`, table, button Export calling shared `exportScheduleMatrixExcel` with empty day grid optional OR export summary-only helper.

Minimal export on report page: reuse fairness summary table → download HTML xls with summary only (add `exportFairnessSummaryExcel` in `exportExcel.js` if cleaner).

- [ ] **Step 3: Navbar** — next to Ops Report:

```jsx
{canViewShiftFairness && (
  <Link href="/reports/shifts">Shift Fairness</Link>
)}
```

Compute `canViewShiftFairness` same rules as helper (Admin/Manager/view_reports/manage_schedules).

- [ ] **Step 4: Commit**

```bash
git add app/reports/shifts components/Navbar.js lib/schedules/exportExcel.js
git commit -m "feat(reports): add Shift Fairness page and nav link"
```

---

### Task 9: Docs + self-check

**Files:**
- Modify: `docs/SCHEDULE_POLA.md`

- [ ] **Step 1: Add short section**

```markdown
## Fairness report

Ringkasan per orang (S1/S2/OC/OFF, lembur, total jam) di **Shifts** dan **Reports → Shift Fairness**.
Lembur = masuk pada hari yang baseline Generate-nya OFF (`generatedShiftTypeId` null), atau dicentang manual.
Setelah deploy, regenerate bulan berjalan agar baseline terisi.
```

- [ ] **Step 2: Manual acceptance (local or staging)**

1. Migrate DB; generate one dept month → all `isLembur` false in DB.  
2. PATCH one OFF→S2 without `isLembur` → response `isLembur: true`.  
3. PATCH `isLembur: false` → stays S2, flag false.  
4. Schedules ringkasan Lembur +1 then 0.  
5. `/reports/shifts` matches.  
6. Staff role cannot open report (403/redirect).

- [ ] **Step 3: Commit**

```bash
git add docs/SCHEDULE_POLA.md
git commit -m "docs: note shift fairness report and lembur rules"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| `generatedShiftTypeId` + `isLembur` | 2 |
| Generate stamps baseline | 3 |
| PATCH auto + explicit lembur | 4 |
| Swap keeps generated, recomputes lembur | 4 |
| `fairness.js` hours/columns/summary | 1 |
| Schedules ringkasan + Total Jam + checkbox | 6 |
| Excel export | 7 |
| `/reports/shifts` + access | 5, 8 |
| Navbar | 8 |
| Docs | 9 |
| No national holidays / payroll | — out of scope |

## Placeholder scan

None intentional. Implementers must keep `buildPersonSummary` kerja formula as `plainS1 + oc + s2 + s3` (and for POLA_1 use `s1` field = plain S1 count; no double-count OC into s1).
