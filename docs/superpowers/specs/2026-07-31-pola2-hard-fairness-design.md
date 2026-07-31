# POLA_2 Hard Fairness — Design

**Date:** 2026-07-31  
**Status:** Approved for implementation planning  
**Product:** NOC Manager (`noc-manager2`)  
**Related:** `services/shift-solver/app_generate.py` (POLA_2), `docs/SCHEDULE_POLA.md`, Shift Fairness Report

## Goal

Make monthly POLA_2 (NOC Core) rosters fair across people on **kerja/OFF**, **OC**, **plain S1**, and **S1-band vs S2**, so cases like Putra/Septi getting +2 working days (22 vs 20) do not happen after Generate. Within a month, a **≤1 day / ≤8 jam** gap is acceptable when `total_kerja` is not divisible by pool size; across months, the people who receive the extra day must **rotate**.

## Decisions (confirmed)

| Topic | Choice |
|-------|--------|
| Scope | **POLA_2 only** |
| Approach | **Hard constraints in OR-Tools** (not soft-only, not post-process swap) |
| S1 vs S2 meaning | Per person: **(Plain S1 + OC) ≈ S2** with \|diff\| ≤ 1 |
| Kerja/OFF | Per person band floor/ceil of equal share (max−min ≤ 1) |
| Jam gap in-month | **≤8 jam** OK (1 hari × 8 jam POLA_2) when remainder forces it |
| Extra-day rotation | **Gantian lintas bulan** via previous-month kerja history (soft, strong weight) |
| Other polas | Unchanged |

## Problem (observed)

NOC Core, August 2026, 5 people, demand-fixed **104** work slots → average 20.8.

| Person | Kerja | OFF | Weekend kerja |
|--------|------:|----:|--------------:|
| putra, septi | 22 | 9 | 5 |
| others | 20 | 11 | 3–4 |

OC / plain S1 already had hard floor/ceil. S2 team spread, weekend duty, and **total kerja/OFF** were only soft → solver could leave a ±2 gap.

Demand implies team totals roughly:
- OC: 1/day × days  
- Plain S1: 1/weekday  
- S2: (working−2)/weekday + 1/weekend  
With classic staffing, **S2 ≈ Plain S1 + OC** at team level; fairness is per-person balance of that identity, not Plain S1 ≈ S2 alone.

## Hard constraints (new / tightened)

All apply only when `selected_pola == "POLA_2"`.

### 1. Total kerja / OFF

Let `n` = number of employees in the solve pool, `D` = days in month.

`total_kerja` is implied by daily demand already in the model (weekday working count + weekend working count = 2). Prefer deriving per-person counts from assignment vars:

- `kerja_e = sum(1 - x[e,d,0])` over `d in 0..D-1`  
- `min_k = floor(total_kerja / n)`, `max_k = ceil(total_kerja / n)`  
- Hard: `min_k ≤ kerja_e ≤ max_k` for every `e`

Equivalent OFF band follows automatically.

For classic 5-person August: total 104 → each person **20 or 21** only (no 22).  
Hours: **160 atau 168** (selisih max 8 jam). Exact equal jam for all is impossible when `total_kerja % n ≠ 0` without changing demand.

### 1b. Rotasi “kursi +1” lintas bulan

When `max_k > min_k`, some people must get `max_k` (extra day / +8 jam). Use **previous month** schedules already loaded into the solver (`history` / `history_counts`):

1. For each employee `e`, compute `prev_kerja_e` = count of non-OFF days in the previous calendar month (from history payload). Missing history → treat as `0` (new joiners get priority for fewer extras only after veterans who already had extras).
2. Soft (strong): penalize `kerja_e == max_k` proportional to `prev_kerja_e` (and/or a flag `prev_kerja_e == prev_max_k`).  
   Example: `bonus -= is_max_k_e * (prev_kerja_e * W)` with `W` large enough to beat weak tie-breaks but not override hard constraints.
3. Goal: people who sat at 21/168 last month prefer 20/160 this month; those who sat at 20 prefer the leftover 21 seats.
4. Not a multi-year ledger in v1 — **one month lookback** is enough for “bulan berikutnya harus gantian.” Optional later: rolling 3-month average.

Do **not** hard-forbid repeating `max_k` (can be infeasible if pool/demand changes); strong soft + hard in-month band is enough.

### 2. S1-band vs S2

Per person:

- `s1_band_e = sum(x[e,d,1] + x[e,d,3])`  
- `s2_e = sum(x[e,d,2])`  
- Hard: `|s1_band_e - s2_e| ≤ 1`

Upgrade today’s soft `s1_s2_abs_diff` penalty to this hard cap (soft may remain as weak tie-break with smaller weight if useful).

### 3. Weekend duty

Per person weekend work days (S2 or OC on Sat/Sun — same definition as existing soft weekend_duty):

- Hard: `max(weekend_e) - min(weekend_e) ≤ 1`

### 4. Keep existing hard bands

Unchanged:

- OC count per person in `[floor(D/n), ceil(D/n)]`  
- Plain S1 in `[floor(weekdays/n), ceil(weekdays/n)]`  
- Daily demand, weekday 1-OFF/week (full weeks), weekend pair ≥1 OFF, OC→next not S1/OC, S2→next not S1/OC, OC cooldown  

### 5. Soft objectives

Keep history penalties and soft spreads as **secondary** maximize terms. Do not rely on them for the guarantees above.

## Infeasibility

If the model is infeasible under these hards:

- Do **not** silently relax hard fairness.  
- Return a clear generate error to the API/UI (e.g. fairness POLA_2 constraints not satisfiable for this pool/month).  
- Operator options: adjust pool size, edit manually after a prior generate, or change demand rules (out of scope).

## Out of scope

- POLA_1 / 3 / 4 / 5 / 6  
- Changing classic demand (1 plain S1 + 1 OC + ≥1 S2 weekday; weekend 1 OC + 1 S2)  
- National holidays, lembur, payroll  
- Auto-fixing August without an explicit regenerate  

## Acceptance criteria

1. Unit/integration test: solve POLA_2 for **5 fictional employees**, August 2026 (or fixed calendar), classic demand →  
   - every person `kerja ∈ {20, 21}` (jam 160 atau 168; no 176)  
   - every person `|S1+OC − S2| ≤ 1`  
   - weekend work max−min ≤ 1  
2. Rotation test: same pool, two consecutive months (or August solve with synthetic July history where A,B had `prev_kerja = max`) → A,B prefer `min_k` in August when feasible; extras go to others.  
3. Existing daily demand / transition rules still hold on the solution.  
4. Regenerate NOC Core on staging/prod for a target month → Shift Fairness ringkasan shows kerja spread ≤ 1.  
5. Docs: short note in `docs/SCHEDULE_POLA.md` under POLA_2 fairness (in-month ±1 day / ±8 jam; rotate extras next month).

## Implementation sketch

**File:** `services/shift-solver/app_generate.py` (POLA_2 block ~312–529)  
**History already passed from:** `lib/schedules/generatePola.js` → solver `history` / prev month rows

After existing OC / plain S1 hard bands and before `model.Maximize`:

1. Add kerja/OFF hard band from assignment sums (and/or from closed-form total if easier and proven equal).  
2. Soft-strong: penalize `max_k` seats using `prev_kerja` from history (rotasi gantian).  
3. Replace soft-only S1−S2 balance with hard `|diff| ≤ 1`.  
4. Add hard weekend spread ≤ 1 (keep soft penalty optional).  
5. Add pytest (or solver smoke script) under `services/shift-solver/` for in-month bands + rotation preference.  
6. Deploy shift-solver image; regenerate affected months.
