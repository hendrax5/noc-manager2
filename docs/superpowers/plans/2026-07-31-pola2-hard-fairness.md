# POLA_2 Hard Fairness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten POLA_2 OR-Tools so in-month kerja/OFF, S1-band vs S2, and weekend duty stay within ±1, and extra work days (+8 jam) rotate across months via previous-month history.

**Architecture:** All changes live in the POLA_2 branch of `services/shift-solver/app_generate.py` (used by both `/generate` and `/solve`). Add hard max−min ≤ 1 on kerja and weekend duty, hard `|S1+OC − S2| ≤ 1` per person, and a strong soft term `−kerja_e * prev_kerja_e` for rotation. Cover with a FastAPI `/solve` integration test. Document in `docs/SCHEDULE_POLA.md`.

**Tech Stack:** Python 3.11, OR-Tools CP-SAT, FastAPI, pytest, existing Next.js generate client (unchanged).

**Spec:** `docs/superpowers/specs/2026-07-31-pola2-hard-fairness-design.md`

---

## File map

| File | Role |
|------|------|
| `services/shift-solver/app_generate.py` | POLA_2 hard fairness + rotation soft |
| `services/shift-solver/test_pola2_fairness.py` | `/solve` integration asserts |
| `services/shift-solver/requirements.txt` | add `pytest`, `httpx` |
| `docs/SCHEDULE_POLA.md` | note POLA_2 fairness rules |

No Next.js / Prisma changes required (`generatePola.js` already sends `history`).

---

### Task 1: Hard kerja/OFF band (±1)

**Files:**
- Modify: `services/shift-solver/app_generate.py` (POLA_2 block, after plain S1 fairness ~463–486, before or after S2 block)

- [ ] **Step 1: Insert hard kerja spread**

After the plain S1 hard band / soft spread block (before S2 fairness), add:

```python
        # FAIRNESS total kerja / OFF: max - min <= 1 (≤8 jam gap for POLA_2)
        kerja_counts = []
        for e in range(num_employees):
            kerja_e = model.NewIntVar(0, num_days, f'core_kerja_e{e}')
            model.Add(kerja_e == sum(1 - x[e, d, 0] for d in range(num_days)))
            # equivalent: kerja_e == num_days - off_sum
            kerja_counts.append(kerja_e)

        max_kerja = model.NewIntVar(0, num_days, 'core_max_kerja')
        min_kerja = model.NewIntVar(0, num_days, 'core_min_kerja')
        model.AddMaxEquality(max_kerja, kerja_counts)
        model.AddMinEquality(min_kerja, kerja_counts)
        model.Add(max_kerja - min_kerja <= 1)
```

Notes:
- Prefer `kerja_e == sum(x[e,d,1] + x[e,d,2] + x[e,d,3] for d in …)` if `1 - x[…]` is awkward for OR-Tools (BoolVar subtraction). Use the sum-of-working-shifts form if needed.
- Keep `kerja_counts` in scope for Task 2 rotation.

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "feat(pola2): hard-constrain monthly kerja spread to ±1 day"
```

---

### Task 2: Soft-strong rotasi kursi +1 (history)

**Files:**
- Modify: `services/shift-solver/app_generate.py` (same POLA_2 block)

- [ ] **Step 1: Compute prev_kerja from history_counts**

`history_counts[e][s]` is already filled for previous month (OFF=0, S1=1, S2=2, S1+OC=3). Immediately after building `kerja_counts`:

```python
        # Rotasi lintas bulan: yang banyak kerja bulan lalu lebih jarang dapat max_k
        PREV_KERJA_WEIGHT = 8000  # strong vs OC/S1 soft history (~200), below infeasibility
        for e in range(num_employees):
            prev_kerja = (
                history_counts[e][1] + history_counts[e][2] + history_counts[e][3]
            )
            # Linear: higher prev_kerja → prefer fewer kerja this month
            bonus_vars.append(kerja_counts[e] * (-PREV_KERJA_WEIGHT * prev_kerja))
```

If `prev_kerja == 0` for everyone (first generate / no history), term is zero — fine.

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "feat(pola2): rotate extra work days using previous-month history"
```

---

### Task 3: Hard \|S1+OC − S2\| ≤ 1

**Files:**
- Modify: `services/shift-solver/app_generate.py` (existing S2 fairness ~488–502)

- [ ] **Step 1: Upgrade soft diff to hard**

In the S2 loop that already builds `s1_band_sum` and `s2_sum`, **add** hard cap (keep a weaker soft abs penalty optional for tie-break):

```python
            s2_sum = sum(x[e, d, 2] for d in range(num_days))
            s2_counts.append(s2_sum)
            s1_band_sum = sum(x[e, d, 1] + x[e, d, 3] for d in range(num_days))
            s1_s2_diff = model.NewIntVar(-num_days, num_days, f'core_s1_s2_diff_{e}')
            model.Add(s1_s2_diff == s1_band_sum - s2_sum)
            s1_s2_abs_diff = model.NewIntVar(0, num_days, f'core_s1_s2_abs_diff_{e}')
            model.AddAbsEquality(s1_s2_abs_diff, s1_s2_diff)
            # HARD: (Plain S1 + OC) vs S2 within 1
            model.Add(s1_s2_abs_diff <= 1)
            # Soft tie-break (weaker than before if it was -2000)
            bonus_vars.append(s1_s2_abs_diff * -500)
```

Remove or reduce the old `bonus_vars.append(s1_s2_abs_diff * -2000)` so it does not duplicate at full strength — one hard + weak soft is enough.

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "feat(pola2): hard-balance S1+OC vs S2 per person within ±1"
```

---

### Task 4: Hard weekend duty spread ≤ 1

**Files:**
- Modify: `services/shift-solver/app_generate.py` (weekend fairness ~512–527)

- [ ] **Step 1: Add hard spread on existing weekend_duty list**

After building `weekend_duty` and soft `we_spread` penalty, add:

```python
        model.Add(we_spread <= 1)
```

Keep `bonus_vars.append(we_spread * -2500)` as tie-break (or drop if redundant).

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "feat(pola2): hard-constrain weekend duty spread to ±1"
```

---

### Task 5: Clearer infeasible message for POLA_2

**Files:**
- Modify: `services/shift-solver/app_generate.py` (~1193–1219)

- [ ] **Step 1: Specialize error when pola is POLA_2**

Where status is not OPTIMAL/FEASIBLE:

```python
    if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        if selected_pola == "POLA_2":
            raise HTTPException(
                status_code=400,
                detail=(
                    "POLA_2 fairness tidak solvable untuk pool/bulan ini "
                    "(kerja/OFF ±1, S1+OC vs S2 ±1, weekend ±1). "
                    "Sesuaikan jumlah anggota roster atau edit manual."
                ),
            )
        raise HTTPException(
            status_code=400,
            detail="Tidak dapat menemukan jadwal yang sesuai.",
        )
```

Ensure `selected_pola` is in scope at that point (it is set earlier in `generate`).

- [ ] **Step 2: Commit**

```bash
git add services/shift-solver/app_generate.py
git commit -m "fix(pola2): clearer generate error when fairness model is infeasible"
```

---

### Task 6: Integration tests + pytest deps

**Files:**
- Create: `services/shift-solver/test_pola2_fairness.py`
- Modify: `services/shift-solver/requirements.txt`

- [ ] **Step 1: Add test deps**

Append to `requirements.txt`:

```
pytest
httpx
```

- [ ] **Step 2: Write failing/passing tests**

Create `services/shift-solver/test_pola2_fairness.py`:

```python
"""POLA_2 hard fairness — solve via FastAPI TestClient."""
from collections import Counter, defaultdict
from datetime import date
import calendar

from fastapi.testclient import TestClient

from app_generate import app

client = TestClient(app)

WORKING = {"S1", "S2", "S1+OC"}


def _solve(year, month, employees, history=None):
    res = client.post(
        "/solve",
        json={
            "year": year,
            "month": month,
            "pola": "POLA_2",
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


def test_pola2_august_2026_kerja_band_and_s1_s2():
    employees = [
        {"id": 1, "name": "A", "religion": "Umum"},
        {"id": 2, "name": "B", "religion": "Umum"},
        {"id": 3, "name": "C", "religion": "Umum"},
        {"id": 4, "name": "D", "religion": "Umum"},
        {"id": 5, "name": "E", "religion": "Umum"},
    ]
    schedules = _solve(2026, 8, employees)
    by = _counts(schedules)
    kerja = {}
    weekend_kerja = defaultdict(int)
    for uid, c in by.items():
        k = c["S1"] + c["S2"] + c["S1+OC"]
        kerja[uid] = k
        s1_band = c["S1"] + c["S1+OC"]
        assert abs(s1_band - c["S2"]) <= 1, (uid, c)
    assert max(kerja.values()) - min(kerja.values()) <= 1
    assert max(kerja.values()) <= 21
    assert min(kerja.values()) >= 20

    for row in schedules:
        d = date.fromisoformat(row["date"])
        if d.weekday() >= 5 and row["shift"] in WORKING:
            weekend_kerja[row["userId"]] += 1
    assert max(weekend_kerja.values()) - min(weekend_kerja.values()) <= 1


def test_pola2_rotation_prefers_low_prev_kerja_for_extras():
    """A,B overloaded last month → prefer not both sitting at max_k this month."""
    employees = [
        {"id": 1, "name": "A", "religion": "Umum"},
        {"id": 2, "name": "B", "religion": "Umum"},
        {"id": 3, "name": "C", "religion": "Umum"},
        {"id": 4, "name": "D", "religion": "Umum"},
        {"id": 5, "name": "E", "religion": "Umum"},
    ]
    # Synthetic July 2026: A,B work 22 days of S2; C,D,E work 20
    history = []
    days = calendar.monthrange(2026, 7)[1]
    for day in range(1, days + 1):
        ds = f"2026-07-{day:02d}"
        for uid, limit in [(1, 22), (2, 22), (3, 20), (4, 20), (5, 20)]:
            if day <= limit:
                history.append({"employee_id": uid, "date": ds, "shift": "S2"})
            else:
                history.append({"employee_id": uid, "date": ds, "shift": "OFF"})

    schedules = _solve(2026, 8, employees, history=history)
    by = _counts(schedules)
    kerja = {
        uid: c["S1"] + c["S2"] + c["S1+OC"] for uid, c in by.items()
    }
    max_k = max(kerja.values())
    # Among people at max_k, prefer C/D/E over A/B when extras exist
    at_max = {uid for uid, k in kerja.items() if k == max_k}
    if max_k > min(kerja.values()):
        # At least one of the low-history people should hold an extra seat
        assert at_max & {3, 4, 5}, (kerja, at_max)
```

Adjust history construction if `/solve` is slow or if synthetic July history makes August infeasible (transition constraints use last 6 days). Prefer building July history that ends with valid OFF/S2 patterns for days 26–31, or only set `history_counts` path by using shifts that don’t poison `history_days` — history_days only uses delta in `[-6, 0)`, so days far from Aug 1 are counts-only. July 1–25 affect counts only; July 26–31 become history_days. Make July 26–31 all OFF for everyone to avoid transition traps:

```python
    for day in range(1, days + 1):
        ds = f"2026-07-{day:02d}"
        near_end = day >= 26
        for uid, limit in [(1, 22), (2, 22), (3, 20), (4, 20), (5, 20)]:
            if near_end:
                history.append({"employee_id": uid, "date": ds, "shift": "OFF"})
            elif day <= limit:
                history.append({"employee_id": uid, "date": ds, "shift": "S2"})
            else:
                history.append({"employee_id": uid, "date": ds, "shift": "OFF"})
```

(Recount: if days 26–31 forced OFF, bump early-month work so A/B still have higher `prev_kerja` than C/D/E.)

- [ ] **Step 3: Run tests**

```bash
cd services/shift-solver
pip install -r requirements.txt
pytest test_pola2_fairness.py -v
```

Expected: PASS (may take 30–120s per solve).

- [ ] **Step 4: Commit**

```bash
git add services/shift-solver/test_pola2_fairness.py services/shift-solver/requirements.txt
git commit -m "test(pola2): assert kerja band, S1+OC vs S2, weekend, and rotation"
```

---

### Task 7: Docs

**Files:**
- Modify: `docs/SCHEDULE_POLA.md`

- [ ] **Step 1: Append POLA_2 fairness note**

After the Fairness report section (or under Pola):

```markdown
## POLA_2 fairness (solver)

Generate POLA_2 menyeimbangkan per orang dalam bulan:
- Kerja / OFF: selisih max 1 hari (jam POLA_2: selisih max 8 jam bila total slot tidak habis dibagi)
- (Plain S1 + OC) vs S2: selisih max 1
- Weekend duty: selisih max 1
- Kursi +1 hari digilir lewat history bulan sebelumnya (soft kuat)

Regenerate bulan target setelah deploy `shift-solver` agar roster lama (mis. 22 vs 20) diganti.
```

- [ ] **Step 2: Commit**

```bash
git add docs/SCHEDULE_POLA.md
git commit -m "docs: note POLA_2 hard fairness and cross-month rotation"
```

---

### Task 8: Deploy checklist (manual)

Not a code task — after merge:

- [ ] Deploy app + rebuild `shift-solver` on `10.16.124.242`
- [ ] Regenerate **NOC Core** for the target month (e.g. August)
- [ ] Open Shift Fairness: kerja only 20/21, jam 160/168, no 176
- [ ] Optional: generate September after August locked → extras should tend to move off who had 21 in August

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Hard kerja/OFF ±1 | 1 |
| Rotasi +1 via prev history | 2 |
| Hard \|S1+OC − S2\| ≤ 1 | 3 |
| Hard weekend ±1 | 4 |
| No silent relax / clear error | 5 |
| Acceptance tests | 6 |
| Docs | 7 |
| Regenerate after deploy | 8 |
| Other polas unchanged | — (no edits outside POLA_2) |

## Placeholder scan

None intentional. Implementers must keep classic demand (weekday 1 S1 + 1 OC + S2 rest; weekend 1 OC + 1 S2) unchanged.
