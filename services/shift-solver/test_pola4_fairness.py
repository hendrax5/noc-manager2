"""POLA_4 hard fairness — solve via FastAPI TestClient (Jakarta-sized pool)."""
from collections import defaultdict

from fastapi.testclient import TestClient

from app_generate import app

# 12 employees — mirrors NOC Regional Jakarta pool size
EMPLOYEES = [
    {"id": i, "name": f"E{i}", "religion": "Umum"} for i in range(1, 13)
]
WORKING = {"S1", "S2"}


def solve(history=None):
    with TestClient(app) as client:
        response = client.post(
            "/solve",
            json={
                "year": 2026,
                "month": 8,
                "pola": "POLA_4",
                "employees": EMPLOYEES,
                "history": history or [],
            },
        )
    assert response.status_code == 200, response.text
    return response.json()["schedules"]


def count_shifts(schedules):
    counts = defaultdict(lambda: defaultdict(int))
    for row in schedules:
        uid = row["userId"]
        if row["shift"] in WORKING:
            counts[uid]["kerja"] += 1
        if row["shift"] == "S1":
            counts[uid]["s1"] += 1
        if row["shift"] == "S2":
            counts[uid]["s2"] += 1
    return counts


def test_pola4_august_2026_hard_fairness_12_people():
    counts = count_shifts(solve())
    kerja = [counts[e["id"]]["kerja"] for e in EMPLOYEES]
    s1 = [counts[e["id"]]["s1"] for e in EMPLOYEES]
    s2 = [counts[e["id"]]["s2"] for e in EMPLOYEES]
    assert max(kerja) - min(kerja) <= 1
    assert max(s1) - min(s1) <= 1
    assert max(s2) - min(s2) <= 1


def july_history_heavy_a_b():
    history = []
    for e in EMPLOYEES:
        work_days = range(1, 18) if e["id"] in {1, 2} else range(1, 8)
        for day in work_days:
            history.append(
                {
                    "employee_id": e["id"],
                    "date": f"2026-07-{day:02d}",
                    "shift": "S2",
                }
            )
        for day in range(26, 32):
            history.append(
                {
                    "employee_id": e["id"],
                    "date": f"2026-07-{day:02d}",
                    "shift": "OFF",
                }
            )
    return history


def test_pola4_rotation_high_prev_prefers_min():
    counts = count_shifts(solve(july_history_heavy_a_b()))
    kerja = {e["id"]: counts[e["id"]]["kerja"] for e in EMPLOYEES}
    max_k = max(kerja.values())
    min_k = min(kerja.values())
    assert max_k - min_k <= 1
    if max_k > min_k:
        at_min = {uid for uid, k in kerja.items() if k == min_k}
        assert at_min & {1, 2}, f"expected A/B (high prev) at min, got {kerja}"
