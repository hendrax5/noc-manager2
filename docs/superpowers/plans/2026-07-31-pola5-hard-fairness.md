# POLA_5 Hard Fairness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten POLA_5 OR-Tools so in-month kerja/OFF and S1 vs S2 stay within ±1, and extra work days (+12 jam) rotate across months via previous-month history — fixing Sisterc-style 228 vs 204 jam gaps.

**Architecture:** Changes only in the POLA_5 branch of `services/shift-solver/app_generate.py` (before `Maximize`). Mirror POLA_2 pattern: hard kerja spread, hard `|S1−S2|≤1`, soft `is_max_kerja × prev_kerja`. Add `/solve` tests and docs. POLA_4 untouched.

**Tech Stack:** Python 3.11, OR-Tools CP-SAT, FastAPI, pytest

**Spec:** `docs/superpowers/specs/2026-07-31-pola5-hard-fairness-design.md`

---

## File map

| File | Role |
|------|------|
| `services/shift-solver/app_generate.py` | POLA_5 hard fairness + rotation + error |
| `services/shift-solver/test_pola5_fairness.py` | `/solve` integration asserts |
| `docs/SCHEDULE_POLA.md` | note POLA_5 fairness |

`pytest` / `httpx` already in `requirements.txt` from POLA_2 work.

---

### Task 1: Hard kerja/OFF band (±1)

**Files:**
- Modify: `services/shift-solver/app_generate.py` (POLA_5 block, immediately before `model.Maximize(sum(bonus_vars))` ~line 1091)

- [ ] **Step 1: Insert hard kerja spread**

Find the POLA_5 block ending with day-weight bonuses and `model.Maximize(sum(bonus_vars))`. **Before** Maximize, add:

```python
        # FAIRNESS total kerja / OFF: max - min <= 1 (≤12 jam gap for POLA_5)
        kerja_counts = []
        for e in range(num_employees):
            kerja_e = model.NewIntVar(0, num_days, f'p5_kerja_e{e}')
            model.Add(
                kerja_e
                == sum(x[e, d, 1] + x[e, d, 2] for d in range(num_days))
            )
            kerja_counts.append(kerja_e)

        max_kerja = model.NewIntVar(0, num_days, 'p5_max_kerja')
        min_kerja = model.NewIntVar(0, num_days, 'p5_min_kerja')
        model.AddMaxEquality(max_kerja, kerja_counts)
        model.AddMinEquality(min_kerja, kerja_counts)
        model.Add(max_kerja - min_kerja <= 1)
```

Keep existing sliding 3/7 OFF and daily min staffing unchanged. Keep `kerja_counts` / `max_kerja` for Task 2.

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "feat(pola5): hard-constrain monthly kerja spread to ±1 day"
```

Windows PowerShell: plain `-m "..."` (no bash heredoc).

---

### Task 2: Soft-strong rotasi kursi +1

**Files:**
- Modify: `services/shift-solver/app_generate.py` (same POLA_5 block, after Task 1)

- [ ] **Step 1: Add is_max_k × prev_kerja**

Immediately after the hard kerja band:

```python
        PREV_KERJA_WEIGHT = 8000
        for e in range(num_employees):
            prev_kerja = history_counts[e][1] + history_counts[e][2]
            is_max_k = model.NewBoolVar(f'p5_is_max_kerja_e{e}')
            model.Add(kerja_counts[e] == max_kerja).OnlyEnforceIf(is_max_k)
            model.Add(kerja_counts[e] < max_kerja).OnlyEnforceIf(is_max_k.Not())
            bonus_vars.append(is_max_k * (-PREV_KERJA_WEIGHT * prev_kerja))
```

Note: POLA_5 has no shift index 3; only S1=1, S2=2, OFF=0.

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "feat(pola5): rotate extra work days using previous-month history"
```

---

### Task 3: Hard \|S1 − S2\| ≤ 1

**Files:**
- Modify: `services/shift-solver/app_generate.py` (POLA_5, after Task 2, before Maximize)

- [ ] **Step 1: Per-person S1/S2 balance**

```python
        # FAIRNESS S1 vs S2: |S1 - S2| <= 1 per person
        for e in range(num_employees):
            s1_sum = sum(x[e, d, 1] for d in range(num_days))
            s2_sum = sum(x[e, d, 2] for d in range(num_days))
            s1_s2_diff = model.NewIntVar(-num_days, num_days, f'p5_s1_s2_diff_{e}')
            model.Add(s1_s2_diff == s1_sum - s2_sum)
            s1_s2_abs = model.NewIntVar(0, num_days, f'p5_s1_s2_abs_{e}')
            model.AddAbsEquality(s1_s2_abs, s1_s2_diff)
            model.Add(s1_s2_abs <= 1)
            bonus_vars.append(s1_s2_abs * -500)
```

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "feat(pola5): hard-balance S1 vs S2 per person within ±1"
```

---

### Task 4: Clearer infeasible message for POLA_5

**Files:**
- Modify: `services/shift-solver/app_generate.py` (~1246–1258)

- [ ] **Step 1: Extend failure branch**

```python
    else:
        if selected_pola == "POLA_2":
            raise HTTPException(
                status_code=400,
                detail=(
                    "POLA_2 fairness tidak solvable untuk pool/bulan ini "
                    "(kerja/OFF ±1, S1+OC vs S2 ±1, weekend ±1). "
                    "Sesuaikan jumlah anggota roster atau edit manual."
                ),
            )
        if selected_pola == "POLA_5":
            raise HTTPException(
                status_code=400,
                detail=(
                    "POLA_5 fairness tidak solvable untuk pool/bulan ini "
                    "(kerja/OFF ±1, S1 vs S2 ±1). "
                    "Sesuaikan jumlah anggota roster atau edit manual."
                ),
            )
        raise HTTPException(
            status_code=400,
            detail="Tidak dapat menemukan jadwal yang sesuai.",
        )
```

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "fix(pola5): clearer generate error when fairness model is infeasible"
```

---

### Task 5: Integration tests

**Files:**
- Create: `services/shift-solver/test_pola5_fairness.py`

- [ ] **Step 1: Write tests**

```python
"""POLA_5 hard fairness — solve via FastAPI TestClient."""
from collections import Counter, defaultdict
from datetime import date
import calendar

from fastapi.testclient import TestClient

from app_generate import app

client = TestClient(app)
WORKING = {"S1", "S2"}


def _solve(year, month, employees, history=None):
    res = client.post(
        "/solve",
        json={
            "year": year,
            "month": month,
            "pola": "POLA_5",
            "employees": employees,
            "history": history or [],
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["schedules"]


def _counts(schedules):
    by = defaultdict(Counter)
    for row in schedules:
        by[row["userId"]][row["shift"]] += 1
    return by


def test_pola5_august_2026_kerja_and_s1_s2():
    employees = [{"id": i, "name": f"E{i}", "religion": "Umum"} for i in range(1, 8)]
    schedules = _solve(2026, 8, employees)
    by = _counts(schedules)
    kerja = {}
    for uid, c in by.items():
        k = c["S1"] + c["S2"]
        kerja[uid] = k
        assert abs(c["S1"] - c["S2"]) <= 1, (uid, dict(c))
    assert max(kerja.values()) - min(kerja.values()) <= 1
    # Sisterc-style gap must not appear
    assert max(kerja.values()) - min(kerja.values()) <= 1
    assert max(kerja.values()) <= 19


def test_pola5_rotation_high_prev_prefers_min():
    employees = [{"id": i, "name": f"E{i}", "religion": "Umum"} for i in range(1, 8)]
    days = calendar.monthrange(2026, 7)[1]
    history = []
    # High prev for 1,2; low for others. Last 6 days OFF (history_days window).
    for day in range(1, days + 1):
        ds = f"2026-07-{day:02d}"
        near_end = day >= 26
        for uid in range(1, 8):
            if near_end:
                shift = "OFF"
            elif uid in (1, 2) and day <= 22:
                shift = "S2"
            elif uid not in (1, 2) and day <= 17:
                shift = "S1"
            else:
                shift = "OFF"
            history.append({"employee_id": uid, "date": ds, "shift": shift})

    schedules = _solve(2026, 8, employees, history=history)
    by = _counts(schedules)
    kerja = {uid: c["S1"] + c["S2"] for uid, c in by.items()}
    min_k = min(kerja.values())
    max_k = max(kerja.values())
    assert max_k - min_k <= 1
    if max_k > min_k:
        at_min = {uid for uid, k in kerja.items() if k == min_k}
        assert at_min & {1, 2}, kerja
```

If solve is slow or infeasible with 7 staff, try 6–8 employees but keep asserts. Do **not** remove hard constraints to make tests pass — adjust pool size / history only.

- [ ] **Step 2: Run**

```bash
cd services/shift-solver
pytest test_pola5_fairness.py -v
```

Expected: PASS (may take longer than POLA_2).

- [ ] **Step 3: Commit**

```bash
git add services/shift-solver/test_pola5_fairness.py
git commit -m "test(pola5): assert kerja band, S1 vs S2, and rotation"
```

---

### Task 6: Docs

**Files:**
- Modify: `docs/SCHEDULE_POLA.md`

- [ ] **Step 1: Append after POLA_2 fairness section**

```markdown
## POLA_5 fairness (solver)

Generate POLA_5 menyeimbangkan per orang dalam bulan:
- Kerja / OFF: selisih max 1 hari (jam POLA_5: selisih max 12 jam bila total slot tidak habis dibagi)
- S1 vs S2: selisih max 1
- Kursi +1 hari digilir lewat history bulan sebelumnya (soft kuat)

Regenerate dept POLA_5 (mis. NOC Sisterc) setelah deploy `shift-solver`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/SCHEDULE_POLA.md
git commit -m "docs: note POLA_5 hard fairness and cross-month rotation"
```

---

### Task 7: Deploy checklist (manual)

- [ ] Push `main`, deploy prod (rebuild app + **shift-solver**)
- [ ] Regenerate **NOC Sisterc** (and other POLA_5 depts as needed) for target month
- [ ] Shift Fairness: kerja spread ≤ 1, jam gap ≤ 12, no extreme S1/S2 skew

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Hard kerja ±1 | 1 |
| Rotasi +1 | 2 |
| Hard \|S1−S2\| ≤ 1 | 3 |
| Clear error | 4 |
| Tests | 5 |
| Docs | 6 |
| Regenerate after deploy | 7 |
| POLA_4 unchanged | — |

## Placeholder scan

None. Keep sliding 3-OFF/7-day and daily min 2+2 staffing as-is.
