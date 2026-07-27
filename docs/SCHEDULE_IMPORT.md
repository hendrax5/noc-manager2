# Import roster master data from Documents/absen (optional)

The absen SQLite DB (`Documents/absen/backend/data/scheduler.db`) holds departments, employees, and past schedules. NOC Manager uses **User + Department** instead.

## Recommended mapping

| Absen | NOC |
|-------|-----|
| `departments.name` + `model_type` | `Department.name` + `schedulePola` + `scheduleEnabled=true` |
| `employees.name` + `religion` | Match `User.name` (or create user) + `User.scheduleFlag` |
| `schedules` history | Optional: seed `ShiftSchedule` for continuity |

## Manual steps (safe)

1. Di NOC: buat/aktifkan department yang shift (centang **Generate**).
2. Set **Default Pola** sesuai `model_type` absen (`POLA_1`…`POLA_6`).
3. Pastikan user ada di department yang sama (Team → Members).
4. Set flag **Umum / Kristen / Kuliah** di User Preferences.
5. Generate bulan berjalan sekali; bulan berikutnya continuity otomatis dari `ShiftSchedule`.

## Script bantuan (opsional)

Jika Python + sqlite3 tersedia:

```bash
python scripts/inspect_absen_db.py "C:/Users/hendr/OneDrive/Documents/absen/backend/data/scheduler.db"
```

Script hanya **membaca & mencetak** mapping saran — tidak menulis ke NOC (aman).
