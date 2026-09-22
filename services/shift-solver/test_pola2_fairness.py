from collections import defaultdict
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app_generate import app


EMPLOYEES = [
    {"id": employee_id, "name": name, "religion": "Umum"}
    for employee_id, name in enumerate(("A", "B", "C", "D", "E"), start=1)
]
WORKING_SHIFTS = {"S1", "S2", "S1+OC"}


def solve(history=None):
    with TestClient(app) as client:
        response = client.post(
            "/solve",
            json={
                "year": 2026,
                "month": 8,
                "pola": "POLA_2",
                "employees": EMPLOYEES,
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


def test_pola2_monday_sunday_exactly_two_off():
    schedules = solve()
    grid = by_user_date(schedules)
    start = date(2026, 8, 1)
    num_days = 31

    first_monday = None
    for i in range(min(7, num_days)):
        if (start + timedelta(days=i)).weekday() == 0:
            first_monday = i
            break
    assert first_monday is not None

    for employee in EMPLOYEES:
        user_id = employee["id"]
        curr = first_monday
        while curr + 6 < num_days:
            offs = 0
            for i in range(7):
                day = start + timedelta(days=curr + i)
                if grid[user_id].get(day.isoformat()) == "OFF":
                    offs += 1
            assert offs == 2, f"user {user_id} week starting +{curr}: OFF={offs}"
            curr += 7


def test_pola2_weekend_allows_at_least_two_workers():
    schedules = solve()
    by_day = defaultdict(list)
    for schedule in schedules:
        day = date.fromisoformat(schedule["date"])
        if day.weekday() >= 5:
            by_day[schedule["date"]].append(schedule["shift"])

    for day, shifts in by_day.items():
        working = [s for s in shifts if s in WORKING_SHIFTS]
        assert len(working) >= 2, f"{day} weekend workers={len(working)}"
        assert working.count("S1+OC") == 1
        assert working.count("S1") == 0
        assert working.count("S2") == len(working) - 1


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
