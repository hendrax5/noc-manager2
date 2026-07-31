# POLA_5 Hard Fairness — Design

**Date:** 2026-07-31  
**Status:** Approved for implementation planning  
**Product:** NOC Manager (`noc-manager2`)  
**Related:** `services/shift-solver/app_generate.py` (POLA_5), `docs/SCHEDULE_POLA.md`, POLA_2 hard fairness

## Goal

Make monthly POLA_5 rosters fair within a department on **kerja/OFF** and **S1 vs S2**, so gaps like NOC Sisterc August (ariel **228 jam** / 19 kerja vs others **204 jam** / 17 kerja, and yudha **1×S1 / 17×S2**) do not recur after Generate. Within a month, a **≤1 day / ≤12 jam** gap is OK when totals do not divide evenly; across months, extra work days rotate via previous-month history.

## Decisions (confirmed)

| Topic | Choice |
|-------|--------|
| Scope | **POLA_5 only** (Sisterc, CS, Monitoring, Regional Jakarta, …) |
| POLA_4 | **Out of scope** for this change (fix later if needed) |
| Approach | Hard constraints in OR-Tools (same pattern as POLA_2) |
| S1 vs S2 | Per person: **\|S1 − S2\| ≤ 1** (no OC in POLA_5) |
| Kerja/OFF | Team max−min ≤ 1 day |
| Jam | POLA_5 = **12 jam/hari** → in-month gap max **12 jam** |
| Extra-day rotation | Soft-strong `is_max_kerja` × `prev_kerja` from prior month |

## Problem (observed)

NOC Sisterc, August 2026, POLA_5, 7 people:

| Person | Kerja | Jam (×12) | S1 | S2 | OFF |
|--------|------:|----------:|---:|---:|----:|
| ariel | 19 | 228 | 11 | 8 | 12 |
| Fahmi, veri, yudha | 18 | 216 | (yudha: 1 / 17) | | 13 |
| Bagus, Rafli, lintang | 17 | 204 | … | … | 14 |

Current POLA_5 model has **no** per-person fairness on total kerja or S1/S2 — only sliding “3 OFF / 7 days”, no 3 OFF in a row, S2↛S1 next day, min 2 S1 + 2 S2 per day, soft prefer S1 > S2 daily.

## Hard constraints (new)

Only when `selected_pola == "POLA_5"`.

### 1. Total kerja / OFF

- `kerja_e = sum(S1 + S2)` over days in month  
- Hard: `max(kerja) − min(kerja) ≤ 1`

### 2. S1 vs S2

Per person:

- Hard: `|S1_e − S2_e| ≤ 1`

### 3. Rotasi kursi +1 (soft kuat)

Same as POLA_2:

- `prev_kerja` from `history_counts` (S1+S2; OFF ignored)  
- Bool `is_max_k` ↔ `kerja_e == max_kerja`  
- `bonus -= is_max_k * PREV_KERJA_WEIGHT * prev_kerja` (e.g. weight 8000)

### 4. Keep existing POLA_5 rules

Unchanged: ExactlyOne per day; sliding window 3 OFF / 7 days; no 3 consecutive OFF; soft prefer 2 consecutive OFF; S2 ⇒ next day not S1; daily min 2 S1 and 2 S2; soft S1 > S2 and day weights.

## Infeasibility

Do **not** silently relax hard fairness. Return a clear 400 for POLA_5 (mirror POLA_2 message), e.g. fairness not solvable for this pool/month.

If sliding 3/7 + hard ±1 proves often infeasible for small pools, document and escalate — do not weaken without a new decision.

## Out of scope

- POLA_1 / 2 / 3 / 4 / 6  
- Changing min staffing (2+2) or cycle length  
- National holidays, lembur, payroll  
- Auto-fix without regenerate  

## Acceptance criteria

1. `/solve` test: 7 fictional employees, August 2026, POLA_5 →  
   - kerja max−min ≤ 1  
   - each person `|S1 − S2| ≤ 1`  
2. Rotation smoke: high `prev_kerja` prefers `min_kerja` when extras exist.  
3. Regenerate NOC Sisterc on prod → no 19 vs 17 (228 vs 204) style gap.  
4. Note in `docs/SCHEDULE_POLA.md`.

## Implementation sketch

**File:** `services/shift-solver/app_generate.py` (POLA_5 block ~1009–1094)  
Before `model.Maximize(sum(bonus_vars))`:

1. Build `kerja_counts`, hard max−min ≤ 1  
2. Soft max-seat × prev_kerja  
3. Hard `|S1 − S2| ≤ 1` per person  
4. Specialize infeasible error for POLA_5  
5. Tests in `test_pola5_fairness.py`  
6. Docs + deploy + regenerate Sisterc
