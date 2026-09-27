from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app_generate import app


EMPLOYEES = [
    {"id": employee_id, "name": name, "religion": "Umum"}
    for employee_id, name in enumerate(("A", "B", "C", "D", "E"), start=1)
]
WORKING_SHIFTS = {"S1", "S2", "S1+OC"}


def solve(history=None, employees=None, year=2026, month=8):
    with TestClient(app) as client:
        response = client.post(
            "/solve",
            json={
                "year": year,
                "month": month,
                "pola": "POLA_2",
                "employees": employees or EMPLOYEES,
                "history": history or [],
            },
        )
    assert response.status_code == 200, response.text
    return response.json()["schedules"]


def count_shifts(schedules):
    counts = defaultdict(lambda: defaultdict(int))
    for schedule in schedules:
        if schedule["shift"] in WORKING_SHIFTS:
            counts[schedule["userId"]]["kerja"] += 1
        if schedule["shift"] in {"S1", "S1+OC"}:
            counts[schedule["userId"]]["s1_or_oc"] += 1
        if schedule["shift"] == "S2":
            counts[schedule["userId"]]["s2"] += 1
        if (
            schedule["shift"] in WORKING_SHIFTS
            and date.fromisoformat(schedule["date"]).weekday() >= 5
        ):
            counts[schedule["userId"]]["weekend"] += 1
        if schedule["shift"] == "OFF":
            counts[schedule["userId"]]["off"] += 1
    return counts


def by_user_date(schedules):
    grid = defaultdict(dict)
    for schedule in schedules:
        grid[schedule["userId"]][schedule["date"]] = schedule["shift"]
    return grid


def test_pola2_august_2026_hard_fairness():
    schedules = solve()
    counts = count_shifts(schedules)

    kerja = [counts[employee["id"]]["kerja"] for employee in EMPLOYEES]
    assert max(kerja) - min(kerja) <= 1

    for employee in EMPLOYEES:
        employee_counts = counts[employee["id"]]
        assert abs(employee_counts["s1_or_oc"] - employee_counts["s2"]) <= 1

    weekend_work = [counts[employee["id"]]["weekend"] for employee in EMPLOYEES]
    assert max(weekend_work) - min(weekend_work) <= 1


def assert_weekly_off_and_backup(schedules, employees, year, month):
    """Tiap minggu penuh: 1 OFF weekday + 1 OFF weekend (tanpa libur tambahan).
    Weekend: 1 OC + 1 S2 inti; kalau 2 S2, tepat satu ditandai cadangan, digilir."""
    grid = by_user_date(schedules)
    backup = {(s["userId"], s["date"]) for s in schedules if s.get("standby")}
    for uid, day in backup:
        assert grid[uid][day] == "S2", (uid, day, grid[uid][day])

    start = date(year, month, 1)
    num_days = monthrange(year, month)[1]
    first_monday = next(
        i for i in range(7) if (start + timedelta(days=i)).weekday() == 0
    )
    curr = first_monday
    while curr + 6 < num_days:
        days = [start + timedelta(days=curr + i) for i in range(7)]
        for employee in employees:
            shifts = [grid[employee["id"]][d.isoformat()] for d in days]
            assert shifts[:5].count("OFF") == 1, (employee["id"], curr, shifts)
            assert shifts[5:].count("OFF") == 1, (employee["id"], curr, shifts)
        curr += 7

    for i in range(num_days):
        day = start + timedelta(days=i)
        if day.weekday() < 5:
            continue
        shifts = [grid[e["id"]][day.isoformat()] for e in employees]
        s2 = shifts.count("S2")
        assert shifts.count("S1+OC") == 1 and shifts.count("S1") == 0, (day, shifts)
        assert 1 <= s2 <= 2, (day, shifts)
        flagged = sum(1 for e in employees if (e["id"], day.isoformat()) in backup)
        assert flagged == s2 - 1, (day, shifts, flagged)

    per_person = [sum(1 for (uid, _) in backup if uid == e["id"]) for e in employees]
    assert max(per_person) - min(per_person) <= 1, per_person


def test_pola2_weekly_off_rule_and_weekend_backup():
    assert_weekly_off_and_backup(solve(), EMPLOYEES, 2026, 8)


@pytest.mark.parametrize("year,month", [(2026, 9), (2026, 10), (2026, 11), (2026, 12)])
def test_pola2_weekly_off_rule_other_months(year, month):
    employees = [{"id": i, "name": f"P{i}", "religion": "Umum"} for i in range(1, 6)]
    schedules = solve(employees=employees, year=year, month=month)
    assert_weekly_off_and_backup(schedules, employees, year, month)


def july_history_with_heavier_a_and_b():
    history = []
    for employee in EMPLOYEES:
        work_days = range(1, 16) if employee["id"] in {1, 2} else range(1, 6)
        for day in work_days:
            history.append(
                {
                    "employee_id": employee["id"],
                    "date": f"2026-07-{day:02d}",
                    "shift": "S2",
                }
            )
        for day in range(26, 32):
            history.append(
                {
                    "employee_id": employee["id"],
                    "date": f"2026-07-{day:02d}",
                    "shift": "OFF",
                }
            )
    return history


def test_pola2_kerja_extras_prefer_lower_previous_month_work():
    counts = count_shifts(solve(july_history_with_heavier_a_and_b()))
    kerja = {employee["id"]: counts[employee["id"]]["kerja"] for employee in EMPLOYEES}
    max_kerja = max(kerja.values())
    min_kerja = min(kerja.values())

    assert max_kerja - min_kerja <= 1
    if max_kerja > min_kerja:
        at_min = {
            employee_id for employee_id, count in kerja.items() if count == min_kerja
        }
        assert at_min & {1, 2}, (
            f"expected A or B (high previous kerja) at min kerja, got {kerja}"
        )
