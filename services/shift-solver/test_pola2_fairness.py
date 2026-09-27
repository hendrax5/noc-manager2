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


def assert_weekly_off_and_standby(schedules, employees, year, month):
    """Tiap minggu penuh: 1 OFF weekday; weekend 1 OFF, atau 2 OFF kalau standby.
    Standby = (n - 4) orang/minggu, bergilir (maks sekali/bulan untuk n=5)."""
    grid = by_user_date(schedules)
    standby_flags = {
        (s["userId"], s["date"]) for s in schedules if s.get("standby")
    }
    start = date(year, month, 1)
    num_days = monthrange(year, month)[1]
    first_monday = next(
        i for i in range(7) if (start + timedelta(days=i)).weekday() == 0
    )
    standby_weeks = defaultdict(int)
    curr = first_monday
    while curr + 6 < num_days:
        days = [start + timedelta(days=curr + i) for i in range(7)]
        standby_this_week = []
        for employee in employees:
            uid = employee["id"]
            shifts = [grid[uid][d.isoformat()] for d in days]
            assert shifts[:5].count("OFF") == 1, (uid, curr, shifts)
            we_off = shifts[5:].count("OFF")
            assert we_off in (1, 2), (uid, curr, shifts)
            flagged = all((uid, d.isoformat()) in standby_flags for d in days[5:])
            assert flagged == (we_off == 2), (uid, curr, shifts)
            if we_off == 2:
                standby_this_week.append(uid)
                standby_weeks[uid] += 1
        assert len(standby_this_week) == len(employees) - 4, (curr, standby_this_week)
        curr += 7
    if len(employees) == 5:
        assert all(v <= 1 for v in standby_weeks.values()), dict(standby_weeks)


def test_pola2_weekly_off_rule_and_rotating_standby():
    assert_weekly_off_and_standby(solve(), EMPLOYEES, 2026, 8)


@pytest.mark.parametrize("year,month", [(2026, 9), (2026, 10), (2026, 11), (2026, 12)])
def test_pola2_weekly_off_rule_other_months(year, month):
    employees = [{"id": i, "name": f"P{i}", "religion": "Umum"} for i in range(1, 6)]
    schedules = solve(employees=employees, year=year, month=month)
    assert_weekly_off_and_standby(schedules, employees, year, month)


def test_pola2_weekend_exactly_one_s2_and_one_oc():
    schedules = solve()
    by_day = defaultdict(list)
    for schedule in schedules:
        day = date.fromisoformat(schedule["date"])
        if day.weekday() >= 5:
            by_day[schedule["date"]].append(schedule["shift"])

    for day, shifts in by_day.items():
        working = [s for s in shifts if s in WORKING_SHIFTS]
        assert working.count("S1+OC") == 1, (day, shifts)
        assert working.count("S2") == 1, (day, shifts)
        assert len(working) == 2, (day, shifts)


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
