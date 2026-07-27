"""
Read-only inspector for absen SQLite → print suggested NOC mapping.
Usage: python scripts/inspect_absen_db.py path/to/scheduler.db
"""
import sys
import sqlite3

def main(path):
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    print("=== Departments ===")
    for r in con.execute("SELECT id, name, model_type FROM departments ORDER BY name"):
        print(f"  {r['name']}: schedulePola={r['model_type']} scheduleEnabled=true")
    print("\n=== Employees ===")
    for r in con.execute(
        """
        SELECT e.name, e.religion, d.name AS dept
        FROM employees e
        JOIN departments d ON d.id = e.department_id
        ORDER BY d.name, e.name
        """
    ):
        print(f"  [{r['dept']}] {r['name']} → scheduleFlag={r['religion'] or 'Umum'}")
    print("\n(Done — no writes performed)")
    con.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/inspect_absen_db.py path/to/scheduler.db")
        sys.exit(1)
    main(sys.argv[1])
