from fastapi import FastAPI, Depends, HTTPException
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
import schemas
from database import engine, get_db
from ortools.sat.python import cp_model
from datetime import date, timedelta
import math
import random
import calendar

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def init_db(db: Session):
    if db.query(models.Department).count() == 0:
        db.add(models.Department(name="NOC Jakarta", model_type="POLA_1"))
        db.add(models.Department(name="NOC Core", model_type="POLA_2"))
        db.commit()

    if db.query(models.Employee).count() == 0:
        dept_jkt = db.query(models.Department).filter(models.Department.name == "NOC Jakarta").first()
        default_employees = [
            "Andres Aprilia", "Mumu Muhibudin ali", "Andrew Aprilio Situmorang",
            "Yovangga Nugraha", "Adin Nurahman", "Mohammad Ainul Yaqin El Irjaz",
            "Ikhsan Permana", "Khaerul Kahfi", "Kevin Rian Situmorang",
            "Pandu Setyaji", "Josua hardi arif"
        ]
        for name in default_employees:
            emp = models.Employee(name=name, department_id=dept_jkt.id)
            db.add(emp)
            
        dept_core = db.query(models.Department).filter(models.Department.name == "NOC Core").first()
        noc_core_names = ["rahman", "septi", "Ardi", "Putra", "Idham"]
        for name in noc_core_names:
            emp = models.Employee(name=name, department_id=dept_core.id)
            db.add(emp)
            
        db.commit()

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    init_db(db)

@app.get("/")
def root():
    return {"status": "ok"}

# --- Department CRUD ---
@app.get("/departments", response_model=list[schemas.Department])
def get_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).all()

@app.post("/departments", response_model=schemas.Department)
def create_department(department: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    db_dept = db.query(models.Department).filter(models.Department.name == department.name).first()
    if db_dept:
        raise HTTPException(status_code=400, detail="Department already exists")
    new_dept = models.Department(name=department.name, model_type=department.model_type)
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return new_dept

@app.put("/departments/{dept_id}", response_model=schemas.Department)
def update_department(dept_id: int, department: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    db_dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not db_dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    existing = db.query(models.Department).filter(models.Department.name == department.name).first()
    if existing and existing.id != dept_id:
        raise HTTPException(status_code=400, detail="Department name already exists")
        
    db_dept.name = department.name
    db_dept.model_type = department.model_type
    db.commit()
    db.refresh(db_dept)
    return db_dept


# --- Employee CRUD ---
@app.get("/employees", response_model=list[schemas.Employee])
def get_employees(db: Session = Depends(get_db)):
    return db.query(models.Employee).all()

@app.post("/employees", response_model=schemas.Employee)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    db_emp = db.query(models.Employee).filter(models.Employee.name == employee.name).first()
    if db_emp:
        raise HTTPException(status_code=400, detail="Employee already exists")
    new_emp = models.Employee(name=employee.name, department_id=employee.department_id, religion=employee.religion)
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp

@app.put("/employees/{emp_id}", response_model=schemas.Employee)
def update_employee(emp_id: int, employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    db_emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    existing = db.query(models.Employee).filter(models.Employee.name == employee.name).first()
    if existing and existing.id != emp_id:
        raise HTTPException(status_code=400, detail="Name already taken")
        
    db_emp.name = employee.name
    db_emp.department_id = employee.department_id
    db_emp.religion = employee.religion
    db.commit()
    db.refresh(db_emp)
    return db_emp

@app.delete("/employees/{emp_id}")
def delete_employee(emp_id: int, db: Session = Depends(get_db)):
    db_emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    db.query(models.Schedule).filter(models.Schedule.employee_id == emp_id).delete()
    db.delete(db_emp)
    db.commit()
    return {"detail": "Employee deleted"}

@app.get("/generate")
def generate(year: int, month: int, department_id: int, pola: Optional[str] = None, full_shift: Optional[str] = None, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    employees = db.query(models.Employee).filter(models.Employee.department_id == department_id).all()
    if not employees:
        raise HTTPException(status_code=400, detail="Tidak ada data pegawai di departemen ini.")
    
    random.shuffle(employees)
    num_employees = len(employees)
    num_days = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    
    # --- Fetch Previous Month History ---
    if month == 1:
        prev_month = 12
        prev_year = year - 1
    else:
        prev_month = month - 1
        prev_year = year
        
    prefix = f"{prev_year}-{prev_month:02d}-"
    prev_schedules = db.query(models.Schedule).filter(
        models.Schedule.department_id == department_id,
        models.Schedule.date.like(f"{prefix}%")
    ).all()
    
    # Mapping history
    history_days = {} # (e_idx, d_offset) -> shift_id
    history_counts = {e: {0:0, 1:0, 2:0, 3:0} for e in range(num_employees)}
    emp_id_to_idx = {emp.id: e for e, emp in enumerate(employees)}
    shift_str_to_id = {"OFF": 0, "S1": 1, "S2": 2, "S3": 3, "S1+OC": 3}
    
    for sch in prev_schedules:
        if sch.employee_id in emp_id_to_idx:
            e_idx = emp_id_to_idx[sch.employee_id]
            s_id = shift_str_to_id.get(sch.shift, 0)
            history_counts[e_idx][s_id] += 1
            
            # offset from start_date
            sch_date = date.fromisoformat(sch.date)
            delta_days = (sch_date - start_date).days
            if -6 <= delta_days < 0:
                history_days[(e_idx, delta_days)] = s_id
                
    model = cp_model.CpModel()
    
    selected_pola = pola if pola else dept.model_type
    
    if selected_pola == "POLA_1":
        x = {}
        for e in range(num_employees):
            for d in range(-6, num_days):
                for s in range(4): # 0=OFF, 1=S1, 2=S2, 3=S3
                    x[e, d, s] = model.NewBoolVar(f'shift_e{e}_d{d}_s{s}')
                    if d < 0:
                        hist_s = history_days.get((e, d))
                        if hist_s is not None:
                            if hist_s == s:
                                model.Add(x[e, d, s] == 1)
                            else:
                                model.Add(x[e, d, s] == 0)
                    
        # 1. Tepat 1 shift per hari
        for e in range(num_employees):
            for d in range(-6, num_days):
                model.AddExactlyOne(x[e, d, s] for s in range(4))
                
        # 2. Demand
        for d in range(num_days):
            # Hard constraints (minimal 1 org per shift agar tidak kosong)
            model.Add(sum(x[e, d, 1] for e in range(num_employees)) >= 1)
            model.Add(sum(x[e, d, 2] for e in range(num_employees)) >= 1)
            model.Add(sum(x[e, d, 3] for e in range(num_employees)) >= 1)
            # User request: shift 3 max 2 org
            model.Add(sum(x[e, d, 3] for e in range(num_employees)) <= 2)

        bonus_vars = []
        for d in range(num_days):
            current_date = start_date + timedelta(days=d)
            is_weekday = current_date.weekday() < 5 # Senin-Jumat
            
            s1_count = sum(x[e, d, 1] for e in range(num_employees))
            s2_count = sum(x[e, d, 2] for e in range(num_employees))
            s3_count = sum(x[e, d, 3] for e in range(num_employees))
            
            # ATURAN MUTLAK SEMUA SHIFT MINIMAL 2 ORANG DI SEMUA HARI
            if num_employees >= 6:
                # Soft minimum staffing per shift (penalized if unmet)
                min_s1 = model.NewBoolVar(f'p4_soft_min_s1_d{d}')
                model.Add(s1_count >= 1).OnlyEnforceIf(min_s1.Not())
                model.Add(s1_count < 1).OnlyEnforceIf(min_s1)
                bonus_vars.append(min_s1 * -500)
                
                min_s2 = model.NewBoolVar(f'p4_soft_min_s2_d{d}')
                model.Add(s2_count >= 1).OnlyEnforceIf(min_s2.Not())
                model.Add(s2_count < 1).OnlyEnforceIf(min_s2)
                bonus_vars.append(min_s2 * -500)
                model.Add(s3_count == 2)
            else:
                # Soft minimum staffing per shift (penalized if unmet)
                min_s1 = model.NewBoolVar(f'p4_soft_min_s1_d{d}')
                model.Add(s1_count >= 1).OnlyEnforceIf(min_s1.Not())
                model.Add(s1_count < 1).OnlyEnforceIf(min_s1)
                bonus_vars.append(min_s1 * -500)
                
                min_s2 = model.NewBoolVar(f'p4_soft_min_s2_d{d}')
                model.Add(s2_count >= 1).OnlyEnforceIf(min_s2.Not())
                model.Add(s2_count < 1).OnlyEnforceIf(min_s2)
                bonus_vars.append(min_s2 * -500)
                model.Add(s3_count == 1)
            
            if is_weekday:
                # Senin-jumat usahakan S2 > 2 (minimal 3)
                s2_gt_2 = model.NewBoolVar(f'jkt_s2_gt_2_d{d}')
                model.Add(s2_count >= 3).OnlyEnforceIf(s2_gt_2)
                model.Add(s2_count < 3).OnlyEnforceIf(s2_gt_2.Not())
                bonus_vars.append(s2_gt_2 * 200)
                
                # S1 lebih banyak dari S2
                s1_gt_s2 = model.NewBoolVar(f'jkt_s1_gt_s2_d{d}')
                model.Add(s1_count >= s2_count + 1).OnlyEnforceIf(s1_gt_s2)
                model.Add(s1_count <= s2_count).OnlyEnforceIf(s1_gt_s2.Not())
                bonus_vars.append(s1_gt_s2 * 300)
                
                # Bobot dasar untuk memadatkan orang
                bonus_vars.append(s1_count * 5)
                bonus_vars.append(s2_count * 5)
            else:
                # Sabtu-Minggu hari santai (poin kecil agar solver memprioritaskan hari biasa)
                bonus_vars.append(s1_count * 2)
                bonus_vars.append(s2_count * 2)
                
        
        # FAIRNESS LINTAS BULAN: Penyeimbang Shift Malam (S2) dan Shift (S3)
        for e in range(num_employees):
            history_s2 = history_counts[e][2]
            history_s3 = history_counts[e][3]
            for d in range(num_days):
                bonus_vars.append(x[e, d, 2] * (-50 * history_s2))
                bonus_vars.append(x[e, d, 3] * (-50 * history_s3))
                
        model.Maximize(sum(bonus_vars))

        # 3. 5 Hari Kerja (Tepat 2 hari libur per 7 hari)
        for e in range(num_employees):
            for d in range(-6, num_days - 6):
                model.Add(sum(x[e, d+i, 0] for i in range(7)) == 2)
                
        # 4. Keadilan S3
        total_s3_demand = num_days * 2
        avg_s3 = math.ceil(total_s3_demand / num_employees)
        for e in range(num_employees):
            model.Add(sum(x[e, d, 3] for d in range(num_days)) <= avg_s3 + 1)
            
        # 5. Tidak Boleh Ganti Shift Tanpa Libur
        for e in range(num_employees):
            for d in range(-1, num_days - 1):
                for s1 in [1, 2, 3]:
                    for s2 in [1, 2, 3]:
                        if s1 != s2:
                            model.AddImplication(x[e, d, s1], x[e, d+1, s2].Not())

        # Prioritas Minggu untuk Kristen (Hanya di Shift 3 atau Libur)
        for e, emp in enumerate(employees):
            if emp.religion == "Kristen":
                for d in range(num_days):
                    if (start_date + timedelta(days=d)).weekday() == 6: # Minggu
                        model.Add(x[e, d, 1] == 0) # Tidak boleh S1
                        model.Add(x[e, d, 2] == 0) # Tidak boleh S2
        shift_map = {0: "OFF", 1: "S1", 2: "S2", 3: "S3"}
        num_shifts = 4
        
    elif selected_pola == "POLA_2":
        x = {}
        for e in range(num_employees):
            for d in range(-6, num_days):
                for s in range(4): # 0=OFF, 1=S1, 2=S2, 3=S3
                    x[e, d, s] = model.NewBoolVar(f'core_shift_e{e}_d{d}_s{s}')
                    if d < 0:
                        hist_s = history_days.get((e, d))
                        if hist_s is not None:
                            if hist_s == s:
                                model.Add(x[e, d, s] == 1)
                            else:
                                model.Add(x[e, d, s] == 0)
                        else:
                            if s == 0:
                                model.Add(x[e, d, s] == 1)
                            else:
                                model.Add(x[e, d, s] == 0)
                    
        for e in range(num_employees):
            for d in range(-6, num_days):
                model.AddExactlyOne(x[e, d, s] for s in range(4))
                
        # Libur 1x Senin - Jumat (Setiap minggu)
        
        # Cari kelompok hari Senin-Jumat per minggu
        weekday_groups = []
        d = 0
        while d < num_days:
            curr = start_date + timedelta(days=d)
            if curr.weekday() < 5:
                # Kumpulkan dari hari ini sampai Jumat (atau akhir bulan)
                group = []
                while d < num_days and (start_date + timedelta(days=d)).weekday() < 5:
                    group.append(d)
                    d += 1
                weekday_groups.append(group)
            else:
                d += 1

        bonus_vars = []
                
        for e in range(num_employees):
            for wg in weekday_groups:
                # Libur weekday: tepat 1x jika blok Senin-Jumat penuh (5 hari)
                if len(wg) >= 5:
                    model.Add(sum(x[e, d, 0] for d in wg) == 1)
                elif len(wg) >= 3:
                    # Blok partial (awal/akhir bulan): usahakan 1 libur, tidak wajib
                    has_off = model.NewBoolVar(f'core_partial_off_e{e}_d{wg[0]}')
                    model.Add(sum(x[e, d, 0] for d in wg) >= 1).OnlyEnforceIf(has_off)
                    bonus_vars.append(has_off * 500)
                    
        # Demand Shift — aturan klasik NOC Core (absen POLA_2):
        # - Tiap hari: tepat 1× S1+OC (on-call 22:00–pagi), bagian dari slot S1
        # - Weekday: tepat 1 plain S1 + 1 S1+OC; S2 mengisi sisa yang kerja
        # - Weekend (WFH): 1 S1+OC + 1 S2 (2 org); sisanya OFF
        # - Per orang: 1 libur weekday / minggu + ≥1 libur weekend (→ ~1x WFH)
        for d in range(num_days):
            s1_count = sum(x[e, d, 1] for e in range(num_employees))
            s2_count = sum(x[e, d, 2] for e in range(num_employees))
            oc_count = sum(x[e, d, 3] for e in range(num_employees))
            off_count = sum(x[e, d, 0] for e in range(num_employees))
            working_cnt = model.NewIntVar(0, num_employees, f'core_working_d{d}')
            model.Add(working_cnt == num_employees - off_count)

            # Tepat 1 orang S1+OC setiap hari (On Call 22:00–pagi)
            model.Add(oc_count == 1)

            curr = start_date + timedelta(days=d)
            if curr.weekday() < 5:
                # Slot S1 selalu 2 org: 1 plain S1 + 1 S1+OC
                model.Add(s1_count == 1)
                model.Add(s1_count + oc_count == 2)

                # Sisanya yang kerja = S2 (minimal 1)
                model.Add(s2_count == working_cnt - 2)
                model.Add(s2_count >= 1)

                # Tim ≤5: max 1 OFF/hari (classic). Tim lebih besar: boleh lebih banyak OFF
                # agar tiap orang tetap dapat tepat 1 libur weekday / minggu.
                max_off = 1 if num_employees <= 5 else max(1, (num_employees + 4) // 5)
                model.Add(off_count <= max_off)
                model.Add(working_cnt >= num_employees - max_off)

                # Soft prefer: classic full (1 S1 + 1 OC + 2 S2) atau understaffed (+1 S2)
                full_team = model.NewBoolVar(f'core_full_team_d{d}')
                model.Add(s2_count == 2).OnlyEnforceIf(full_team)
                model.Add(s2_count != 2).OnlyEnforceIf(full_team.Not())
                bonus_vars.append(full_team * 1000)

                partial_ok = model.NewBoolVar(f'core_partial_ok_d{d}')
                model.Add(s2_count == 1).OnlyEnforceIf(partial_ok)
                model.Add(s2_count != 1).OnlyEnforceIf(partial_ok.Not())
                bonus_vars.append(partial_ok * 5000)
            elif curr.weekday() >= 5:
                # Sabtu-Minggu WFH: tepat 2 org kerja = 1 S1+OC + 1 S2
                model.Add(working_cnt == 2)
                model.Add(s2_count == 1)
                model.Add(s1_count == 0)
                bonus_vars.append(2000)  # weekend coverage achieved (hard)
                
        # Libur 1x Sabtu atau Minggu
        weekends = []
        for d in range(num_days):
            curr = start_date + timedelta(days=d)
            if curr.weekday() == 5 and d + 1 < num_days:
                weekends.append((d, d + 1))
                
        for e in range(num_employees):
            for sat, sun in weekends:
                model.Add(x[e, sat, 0] + x[e, sun, 0] >= 1)
                
        # Aturan Transisi: Setelah S1+S3 (On-Call), keesokan harinya WAJIB masuk S2 (atau Libur).
        for e in range(num_employees):
            for d in range(-1, num_days - 1):
                # Jika hari ini S3 (S1+OnCall), besok WAJIB S2 atau OFF. Tidak boleh S1 lagi.
                model.AddImplication(x[e, d, 3], x[e, d+1, 1].Not())
                model.AddImplication(x[e, d, 3], x[e, d+1, 3].Not())
                
                # Menghindari S2 pindah kembali ke S1 tanpa libur? (Boleh S2 berturut-turut)
                model.AddImplication(x[e, d, 2], x[e, d+1, 1].Not())
                model.AddImplication(x[e, d, 2], x[e, d+1, 3].Not())

        # OC cooldown: maksimal 1x per 5 hari per orang (skip 3 hari awal bulan agar lintas bulan feasible)
        for e in range(num_employees):
            for d in range(3, num_days - 4):
                model.Add(sum(x[e, d + i, 3] for i in range(5)) <= 1)

        # FAIRNESS OC (On Call 22:00-pagi): pemerataan wajib per orang
        min_oc = num_days // num_employees
        max_oc = math.ceil(num_days / num_employees)
        oc_counts = []
        for e in range(num_employees):
            oc_sum = sum(x[e, d, 3] for d in range(num_days))
            model.Add(oc_sum >= min_oc)
            model.Add(oc_sum <= max_oc)
            oc_counts.append(oc_sum)

            history_oc = history_counts[e][3]
            for d in range(num_days):
                bonus_vars.append(x[e, d, 3] * (-200 * history_oc))

        max_oc_team = model.NewIntVar(0, num_days, 'core_max_oc')
        min_oc_team = model.NewIntVar(0, num_days, 'core_min_oc')
        model.AddMaxEquality(max_oc_team, oc_counts)
        model.AddMinEquality(min_oc_team, oc_counts)
        oc_spread = model.NewIntVar(0, num_days, 'core_oc_spread')
        model.Add(oc_spread == max_oc_team - min_oc_team)
        bonus_vars.append(oc_spread * -5000)

        # FAIRNESS plain S1 (rotasi slot S1 non-OC, hanya hari weekday)
        weekday_days = sum(
            1 for d in range(num_days)
            if (start_date + timedelta(days=d)).weekday() < 5
        )
        min_plain_s1 = weekday_days // num_employees
        max_plain_s1 = math.ceil(weekday_days / num_employees)
        s1_plain_counts = []
        for e in range(num_employees):
            s1_plain = sum(x[e, d, 1] for d in range(num_days))
            s1_plain_counts.append(s1_plain)
            model.Add(s1_plain >= min_plain_s1)
            model.Add(s1_plain <= max_plain_s1)
            history_s1 = history_counts[e][1]
            for d in range(num_days):
                bonus_vars.append(x[e, d, 1] * (-80 * history_s1))

        max_s1_plain = model.NewIntVar(0, num_days, 'core_max_s1_plain')
        min_s1_plain = model.NewIntVar(0, num_days, 'core_min_s1_plain')
        model.AddMaxEquality(max_s1_plain, s1_plain_counts)
        model.AddMinEquality(min_s1_plain, s1_plain_counts)
        s1_plain_spread = model.NewIntVar(0, num_days, 'core_s1_plain_spread')
        model.Add(s1_plain_spread == max_s1_plain - min_s1_plain)
        bonus_vars.append(s1_plain_spread * -4000)

        # FAIRNESS total kerja / OFF: max - min <= 1 (≤8 jam gap for POLA_2)
        kerja_counts = []
        for e in range(num_employees):
            kerja_e = model.NewIntVar(0, num_days, f'core_kerja_e{e}')
            model.Add(kerja_e == sum(x[e, d, 1] + x[e, d, 2] + x[e, d, 3] for d in range(num_days)))
            kerja_counts.append(kerja_e)

        max_kerja = model.NewIntVar(0, num_days, 'core_max_kerja')
        min_kerja = model.NewIntVar(0, num_days, 'core_min_kerja')
        model.AddMaxEquality(max_kerja, kerja_counts)
        model.AddMinEquality(min_kerja, kerja_counts)
        model.Add(max_kerja - min_kerja <= 1)

        # Rotasi lintas bulan: yang banyak kerja bulan lalu lebih jarang dapat max_k
        PREV_KERJA_WEIGHT = 8000  # strong vs OC/S1 soft history (~200), below infeasibility
        for e in range(num_employees):
            prev_kerja = (
                history_counts[e][1] + history_counts[e][2] + history_counts[e][3]
            )
            is_max_k = model.NewBoolVar(f'core_is_max_kerja_e{e}')
            model.Add(kerja_counts[e] == max_kerja).OnlyEnforceIf(is_max_k)
            model.Add(kerja_counts[e] < max_kerja).OnlyEnforceIf(is_max_k.Not())
            # When max==min, everyone is_max; rotation term remains uniform.
            bonus_vars.append(is_max_k * (-PREV_KERJA_WEIGHT * prev_kerja))

        # FAIRNESS S2 (shift malam, sering menyusul hari OC)
        s2_counts = []
        for e in range(num_employees):
            history_s2 = history_counts[e][2]
            for d in range(num_days):
                bonus_vars.append(x[e, d, 2] * (-80 * history_s2))

            s2_sum = sum(x[e, d, 2] for d in range(num_days))
            s2_counts.append(s2_sum)
            s1_band_sum = sum(x[e, d, 1] + x[e, d, 3] for d in range(num_days))
            s1_s2_diff = model.NewIntVar(-num_days, num_days, f'core_s1_s2_diff_{e}')
            model.Add(s1_s2_diff == s1_band_sum - s2_sum)
            s1_s2_abs_diff = model.NewIntVar(0, num_days, f'core_s1_s2_abs_diff_{e}')
            model.AddAbsEquality(s1_s2_abs_diff, s1_s2_diff)
            model.Add(s1_s2_abs_diff <= 1)
            bonus_vars.append(s1_s2_abs_diff * -500)

        max_s2_team = model.NewIntVar(0, num_days, 'core_max_s2')
        min_s2_team = model.NewIntVar(0, num_days, 'core_min_s2')
        model.AddMaxEquality(max_s2_team, s2_counts)
        model.AddMinEquality(min_s2_team, s2_counts)
        s2_spread = model.NewIntVar(0, num_days, 'core_s2_spread')
        model.Add(s2_spread == max_s2_team - min_s2_team)
        bonus_vars.append(s2_spread * -3000)

        # FAIRNESS weekend duty (Sabtu S2 + tugas weekend lainnya)
        weekend_duty = []
        for e in range(num_employees):
            we_sum = sum(
                x[e, d, 2] + x[e, d, 3]
                for d in range(num_days)
                if (start_date + timedelta(days=d)).weekday() >= 5
            )
            weekend_duty.append(we_sum)
        max_we = model.NewIntVar(0, num_days, 'core_max_weekend_duty')
        min_we = model.NewIntVar(0, num_days, 'core_min_weekend_duty')
        model.AddMaxEquality(max_we, weekend_duty)
        model.AddMinEquality(min_we, weekend_duty)
        we_spread = model.NewIntVar(0, num_days, 'core_weekend_spread')
        model.Add(we_spread == max_we - min_we)
        model.Add(we_spread <= 1)
        bonus_vars.append(we_spread * -2500)

        model.Maximize(sum(bonus_vars))
        
        shift_map = {0: "OFF", 1: "S1", 2: "S2", 3: "S1+OC"}
        num_shifts = 4

    elif selected_pola == "POLA_3":
        x = {}
        for e in range(num_employees):
            for d in range(-6, num_days):
                for s in range(4): # 0=OFF, 1=S1, 2=S2, 3=S3
                    x[e, d, s] = model.NewBoolVar(f'gov_shift_e{e}_d{d}_s{s}')
                    if d < 0:
                        hist_s = history_days.get((e, d))
                        if hist_s is not None:
                            if hist_s == s:
                                model.Add(x[e, d, s] == 1)
                            else:
                                model.Add(x[e, d, s] == 0)
                model.AddExactlyOne(x[e, d, s] for s in range(4))
                    
        # Demand
        # Demand awal sudah diatur secara dinamis di dalam loop harian

        bonus_vars = []
        for d in range(num_days):
            current_date = start_date + timedelta(days=d)
            is_weekday = current_date.weekday() < 5 # Senin-Jumat
            
            s1_count = sum(x[e, d, 1] for e in range(num_employees))
            s2_count = sum(x[e, d, 2] for e in range(num_employees))
            s3_count = sum(x[e, d, 3] for e in range(num_employees))
            
            # Soft constraints for minimum staffing per day
            min_s1 = model.NewBoolVar(f'soft_min_s1_d{d}')
            model.Add(s1_count >= 1).OnlyEnforceIf(min_s1.Not())
            model.Add(s1_count < 1).OnlyEnforceIf(min_s1)
            bonus_vars.append(min_s1 * -500)

            min_s2 = model.NewBoolVar(f'soft_min_s2_d{d}')
            model.Add(s2_count >= 1).OnlyEnforceIf(min_s2.Not())
            model.Add(s2_count < 1).OnlyEnforceIf(min_s2)
            bonus_vars.append(min_s2 * -500)

            # Keep S3 hard constraints (at least 1, max 2)
            model.Add(s3_count >= 1)
            model.Add(s3_count <= 2)
            
            # Soft constraint untuk mengusahakan S1 & S2 minimal 2 orang
            s1_min_2 = model.NewBoolVar(f'gov_s1_min_2_d{d}')
            model.Add(s1_count >= 2).OnlyEnforceIf(s1_min_2)
            model.Add(s1_count < 2).OnlyEnforceIf(s1_min_2.Not())
            
            s2_min_2 = model.NewBoolVar(f'gov_s2_min_2_d{d}')
            model.Add(s2_count >= 2).OnlyEnforceIf(s2_min_2)
            model.Add(s2_count < 2).OnlyEnforceIf(s2_min_2.Not())
            
            if is_weekday:
                # Prioritas utama Senin-Jumat: S1 & S2 harus 2 orang
                bonus_vars.append(s1_min_2 * 2000)
                bonus_vars.append(s2_min_2 * 2000)

                # S1 lebih banyak dari S2
                s1_gt_s2 = model.NewBoolVar(f'gov_s1_gt_s2_d{d}')
                model.Add(s1_count >= s2_count + 1).OnlyEnforceIf(s1_gt_s2)
                model.Add(s1_count <= s2_count).OnlyEnforceIf(s1_gt_s2.Not())
                bonus_vars.append(s1_gt_s2 * 300)
                
                # Bobot dasar untuk memadatkan orang
                bonus_vars.append(s1_count * 5)
                bonus_vars.append(s2_count * 5)
            else:
                # Sabtu-Minggu hari santai (prioritas lebih rendah)
                bonus_vars.append(s1_min_2 * 100)
                bonus_vars.append(s2_min_2 * 100)
                bonus_vars.append(s1_count * 2)
                bonus_vars.append(s2_count * 2)
                
        
        # FAIRNESS LINTAS BULAN: Penyeimbang Shift Malam (S2)
        for e in range(num_employees):
            history_s2 = history_counts[e][2]
            for d in range(num_days):
                bonus_vars.append(x[e, d, 2] * (-50 * history_s2))
                
        model.Maximize(sum(bonus_vars))

        # Acak libur 2x seminggu (Tepat 2 hari libur per 7 hari)
        for e in range(num_employees):
            for d in range(-6, num_days - 6):
                model.Add(sum(x[e, d+i, 0] for i in range(7)) == 2)
                
        # Keadilan S3
        total_s3_demand = num_days * 2
        avg_s3 = math.ceil(total_s3_demand / num_employees)
        for e in range(num_employees):
            model.Add(sum(x[e, d, 3] for d in range(num_days)) <= avg_s3 + 1)
            
            # Tidak Boleh Ganti Shift Tanpa Libur (softened with penalties)
            for d in range(-1, num_days - 1):
                for s1 in [1, 2, 3]:
                    for s2 in [1, 2, 3]:
                        if s1 != s2:
                            pen_change = model.NewBoolVar(f'pen_change_e{e}_d{d}_s{s1}_{s2}')
                            model.Add(x[e, d, s1] + x[e, d+1, s2] <= 1 + pen_change)
                            bonus_vars.append(pen_change * -100)

        # Prioritas Minggu untuk Kristen (Hanya di Shift 3 atau Libur)
        for e, emp in enumerate(employees):
            if emp.religion == "Kristen":
                for d in range(num_days):
                    if (start_date + timedelta(days=d)).weekday() == 6: # Minggu
                        model.Add(x[e, d, 1] == 0) # Tidak boleh S1
                        model.Add(x[e, d, 2] == 0) # Tidak boleh S2
        
        shift_map = {0: "OFF", 1: "S1", 2: "S2", 3: "S3"}
        num_shifts = 4

    elif selected_pola == "POLA_4":
        x = {}
        for e in range(num_employees):
            for d in range(-6, num_days):
                for s in range(3): # 0=OFF, 1=S1, 2=S2
                    x[e, d, s] = model.NewBoolVar(f'p4_shift_e{e}_d{d}_s{s}')
                    if d < 0:
                        hist_s = history_days.get((e, d))
                        if hist_s is not None:
                            if hist_s == s:
                                model.Add(x[e, d, s] == 1)
                            else:
                                model.Add(x[e, d, s] == 0)
                model.AddExactlyOne(x[e, d, s] for s in range(3))
                # Jika user mengirim full_shift, bisa diabaikan atau disesuaikan
                # Kita hapus full_shift constraint yang memaksa x[e,d,0] == 0 karena
                # itu bertentangan dengan libur 3 hari per minggu.
        bonus_vars = []
        avg_off_per_day = max(1, int(round(num_employees * 3 / 7)))
        for d in range(num_days):
            s1_count = sum(x[e, d, 1] for e in range(num_employees))
            s2_count = sum(x[e, d, 2] for e in range(num_employees))
            off_count = sum(x[e, d, 0] for e in range(num_employees))
            work_count = num_employees - off_count
            
            # HARD CONSTRAINT SANGAT MINIMAL: Shift tidak boleh kosong
            model.Add(s1_count >= 1)
            model.Add(s2_count >= 1)
            # S2 maksimal 3 orang (agar shift malam tidak terlalu gemuk)
            model.Add(s2_count <= 3)

            current_date = start_date + timedelta(days=d)
            is_weekend = current_date.weekday() >= 5

            # Tiap hari wajib ada orang kerja — batasi libur harian agar tidak ada hari kosong
            if not is_weekend:
                min_work_day = min(4, num_employees - 1)
                max_off_day = num_employees - min_work_day
            else:
                min_work_day = min(3, num_employees - 1)
                max_off_day = num_employees - min_work_day
            model.Add(work_count >= min_work_day)
            model.Add(off_count <= max_off_day)

            # Usahakan libur tersebar merata (acak), hindari penumpukan libur di hari yang sama
            off_spread_day = model.NewIntVar(0, num_employees, f'p4_off_spread_d{d}')
            model.Add(off_spread_day >= off_count - avg_off_per_day)
            model.Add(off_spread_day >= avg_off_per_day - off_count)
            bonus_vars.append(off_spread_day * -1500)

            # S1 >= S2 (weekday hard, weekend soft)
            if not is_weekend:
                model.Add(s1_count >= s2_count)
            else:
                s1_ge_s2 = model.NewBoolVar(f'p4_s1_ge_s2_d{d}')
                model.Add(s1_count >= s2_count).OnlyEnforceIf(s1_ge_s2)
                model.Add(s1_count < s2_count).OnlyEnforceIf(s1_ge_s2.Not())
                bonus_vars.append(s1_ge_s2 * 1000)

            # Usahakan S1 > S2 jika memungkinkan (tim kecil-menengah)
            if num_employees >= 5:
                s1_gt_s2 = model.NewBoolVar(f'p4_s1_gt_s2_d{d}')
                model.Add(s1_count > s2_count).OnlyEnforceIf(s1_gt_s2)
                model.Add(s1_count <= s2_count).OnlyEnforceIf(s1_gt_s2.Not())
                weight = 5000 if not is_weekend else 2000
                bonus_vars.append(s1_gt_s2 * weight)
            
            # Constraint Kristen & Kuliah
            for e in range(num_employees):
                emp = employees[e]
                religion_val = (emp.religion or "").lower()
                # Kristen tidak boleh S1 di hari Minggu
                if current_date.weekday() == 6 and "kristen" in religion_val:
                    model.Add(x[e, d, 1] == 0)
                # Kuliah tidak boleh S1 di hari Sabtu
                if current_date.weekday() == 5 and "kuliah" in religion_val:
                    model.Add(x[e, d, 1] == 0)
            
            if is_weekend:
                # SABTU - MINGGU (WEEKEND)
                
                # HARD CONSTRAINT: Maksimal 3 orang per shift di akhir pekan
                model.Add(s1_count <= 3)
                model.Add(s2_count <= 3)
                
                # Weekend tim kecil: minimal hard agar hari tidak kosong
                if num_employees <= 12:
                    model.Add(s1_count >= 2)
                    model.Add(s2_count >= 1)
                else:
                    # SOFT CONSTRAINT: S1 diusahakan minimal 3 orang (Sesuai request user)
                    s1_min_3 = model.NewBoolVar(f'p4_we_s1_min_3_d{d}')
                    model.Add(s1_count >= 3).OnlyEnforceIf(s1_min_3)
                    model.Add(s1_count < 3).OnlyEnforceIf(s1_min_3.Not())
                    bonus_vars.append(s1_min_3 * 5000)

                    # SOFT CONSTRAINT: S2 diusahakan minimal 2 orang (Sesuai request user)
                    s2_min_2 = model.NewBoolVar(f'p4_we_s2_min_2_d{d}')
                    model.Add(s2_count >= 2).OnlyEnforceIf(s2_min_2)
                    model.Add(s2_count < 2).OnlyEnforceIf(s2_min_2.Not())
                    bonus_vars.append(s2_min_2 * 5000)

                # Base reward weekend yang rendah agar solver menumpuk pekerja di weekday
                bonus_vars.append(s1_count * 2)
                bonus_vars.append(s2_count * 2)
                
            else:
                # SENIN - JUMAT (WEEKDAY)
                
                # HARD CONSTRAINT: MUTLAK minimal 2 orang per shift di hari kerja
                model.Add(s1_count >= 2)
                model.Add(s2_count >= 2)
                
                # SOFT CONSTRAINT: S1 diusahakan minimal 4 orang
                s1_min_4 = model.NewBoolVar(f'p4_wd_s1_min_4_d{d}')
                model.Add(s1_count >= 4).OnlyEnforceIf(s1_min_4)
                model.Add(s1_count < 4).OnlyEnforceIf(s1_min_4.Not())
                
                # Bonus sangat besar di Rabu-Jumat agar terkonsentrasi di sana
                if current_date.weekday() in [2, 3, 4]: # Rabu, Kamis, Jumat
                    bonus_vars.append(s1_min_4 * 8000)
                else: # Senin, Selasa (tetap diusahakan tapi prioritas lebih rendah)
                    bonus_vars.append(s1_min_4 * 1000)

                # SOFT PENALTY: Hindari penumpukan S1 yang terlalu banyak (biar lebih merata)
                # Cap ini dinamis sesuai dengan jumlah pegawai agar otomatis menyesuaikan jika ada penambahan pegawai
                s1_soft_cap = max(5, int(num_employees * 4 / 7) - 1)
                s1_gt_cap = model.NewBoolVar(f'p4_wd_s1_gt_cap_d{d}')
                model.Add(s1_count > s1_soft_cap).OnlyEnforceIf(s1_gt_cap)
                model.Add(s1_count <= s1_soft_cap).OnlyEnforceIf(s1_gt_cap.Not())
                bonus_vars.append(s1_gt_cap * -10000) # Penalti besar jika melebihi soft cap

                # SOFT CONSTRAINT: S2 diusahakan minimal 3 orang (S2 + 1 jika memungkinkan)
                s2_min_3 = model.NewBoolVar(f'p4_wd_s2_min_3_d{d}')
                model.Add(s2_count >= 3).OnlyEnforceIf(s2_min_3)
                model.Add(s2_count < 3).OnlyEnforceIf(s2_min_3.Not())
                bonus_vars.append(s2_min_3 * 8000)

                # Weekday reward untuk memadatkan orang di hari kerja
                # Senin dan Selasa dikurangi bobot S1 agar tidak terlalu heavy
                if current_date.weekday() == 0:
                    # Senin
                    bonus_vars.append(s1_count * 10)
                    bonus_vars.append(s2_count * 25)
                elif current_date.weekday() == 1:
                    # Selasa
                    bonus_vars.append(s1_count * 20)
                    bonus_vars.append(s2_count * 25)
                elif current_date.weekday() in [2, 3]:
                    # Rabu - Kamis
                    bonus_vars.append(s1_count * 70)
                    bonus_vars.append(s2_count * 35)
                else:
                    # Jumat
                    bonus_vars.append(s1_count * 60)
                    bonus_vars.append(s2_count * 35)
                
                # Make S1 more evenly spread (min 3 on weekdays, target 4)
                s1_min_3_wd = model.NewBoolVar(f'p4_wd_s1_min_3_d{d}')
                model.Add(s1_count >= 3).OnlyEnforceIf(s1_min_3_wd)
                model.Add(s1_count < 3).OnlyEnforceIf(s1_min_3_wd.Not())
                bonus_vars.append(s1_min_3_wd * 9000)

        # Target libur sebulan penuh (sekitar 3 hari per minggu)
        target_off_days = int(round(num_days * 3 / 7))
        for e in range(num_employees):
            # KELENTURAN GLOBAL: Total libur sebulan direlaksasi agar solver fokus ke kalender minggu
            off_sum = sum(x[e, d, 0] for d in range(num_days))
            off_sum_target = model.NewBoolVar(f'p4_off_sum_target_{e}')
            model.Add(off_sum >= target_off_days - 2).OnlyEnforceIf(off_sum_target)
            model.Add(off_sum <= target_off_days + 2).OnlyEnforceIf(off_sum_target)
            bonus_vars.append(off_sum_target * 5000)

            # CALENDAR WEEKS HARD CONSTRAINT (Senin - Minggu mutlak 4 kerja, 3 libur)
            first_monday_idx = -1
            for i in range(min(7, num_days)):
                if (date(year, month, 1) + timedelta(days=i)).weekday() == 0:
                    first_monday_idx = i
                    break
                    
            if first_monday_idx > 0: # Partial week at the start
                partial_len = first_monday_idx
                target_partial = int(round(partial_len * 3 / 7))
                model.Add(sum(x[e, i, 0] for i in range(partial_len)) >= max(0, target_partial - 1))
                model.Add(sum(x[e, i, 0] for i in range(partial_len)) <= min(partial_len, target_partial + 1))
                
            last_monday_idx = -1
            if first_monday_idx != -1:
                # Iterate through all full weeks
                curr_monday = first_monday_idx
                while curr_monday + 6 < num_days:
                    # HARD CONSTRAINT: Exactly 3 off days per Monday-Sunday block
                    model.Add(sum(x[e, curr_monday+i, 0] for i in range(7)) == 3)
                    last_monday_idx = curr_monday
                    curr_monday += 7
                
                # Partial week at the end
                if curr_monday < num_days:
                    partial_len = num_days - curr_monday
                    target_partial = int(round(partial_len * 3 / 7))
                    model.Add(sum(x[e, i, 0] for i in range(curr_monday, num_days)) >= max(0, target_partial - 1))
                    model.Add(sum(x[e, i, 0] for i in range(curr_monday, num_days)) <= min(partial_len, target_partial + 1))

            # SANGAT KUAT: Maksimal 3 kerja beruntun (Mencegah W-W-W-W)
            for d in range(-3, num_days - 3):
                no_4_work = model.NewBoolVar(f'p4_no_4_work_e{e}_d{d}')
                model.Add(x[e, d, 0] + x[e, d+1, 0] + x[e, d+2, 0] + x[e, d+3, 0] >= 1).OnlyEnforceIf(no_4_work)
                model.Add(x[e, d, 0] + x[e, d+1, 0] + x[e, d+2, 0] + x[e, d+3, 0] == 0).OnlyEnforceIf(no_4_work.Not())
                bonus_vars.append(no_4_work * 20000)

            # SANGAT KUAT: Minimal 2 kerja beruntun (Mencegah O-W-O)
            for d in range(-1, num_days - 1):
                no_owo = model.NewBoolVar(f'p4_no_owo_e{e}_d{d}')
                model.Add(x[e, d-1, 0] - x[e, d, 0] + x[e, d+1, 0] <= 1).OnlyEnforceIf(no_owo)
                model.Add(x[e, d-1, 0] - x[e, d, 0] + x[e, d+1, 0] == 2).OnlyEnforceIf(no_owo.Not())
                bonus_vars.append(no_owo * 20000)

        # Pola libur: 1 hari misah, 2 hari nyambung
        for e in range(num_employees):
            # SANGAT KUAT: Tidak boleh 3 hari libur beruntun (O-O-O)
            for d in range(-2, num_days - 2):
                no_3_off = model.NewBoolVar(f'p4_no_3_off_e{e}_d{d}')
                model.Add(x[e, d, 0] + x[e, d+1, 0] + x[e, d+2, 0] <= 2).OnlyEnforceIf(no_3_off)
                model.Add(x[e, d, 0] + x[e, d+1, 0] + x[e, d+2, 0] == 3).OnlyEnforceIf(no_3_off.Not())
                bonus_vars.append(no_3_off * 20000)

            # Define historical S2 count for fairness
            history_s2 = history_counts[e][2]

            for d in range(-1, num_days - 1):
                # HARD CONSTRAINT: Setelah S2 (Malam) TIDAK BOLEH langsung S1 (Pagi)
                model.Add(x[e, d, 2] + x[e, d+1, 1] <= 1)

                # Soft constraints with penalties
                pen_s1_s2 = model.NewBoolVar(f'pen_s1_s2_e{e}_d{d}')
                model.Add(x[e, d, 1] + x[e, d+1, 2] <= 1 + pen_s1_s2)
                # Soft no same shift consecutively (rolling)
                pen_s1_same = model.NewBoolVar(f'pen_s1_same_e{e}_d{d}')
                model.Add(x[e, d, 1] + x[e, d+1, 1] <= 1 + pen_s1_same)
                pen_s2_same = model.NewBoolVar(f'pen_s2_same_e{e}_d{d}')
                model.Add(x[e, d, 2] + x[e, d+1, 2] <= 1 + pen_s2_same)
                # Penalties added to objective (negative bonuses)
                bonus_vars.append(pen_s1_s2 * -200)
                bonus_vars.append(pen_s1_same * -150)
                bonus_vars.append(pen_s2_same * -150)
                
                # FAIRNESS LINTAS BULAN: Penyeimbang Shift Malam (S2)
                bonus_vars.append(x[e, d, 2] * (-50 * history_s2))

            # Libur acak: rotasi hari libur, hindari pola mingguan yang sama
            for d in range(num_days - 7):
                pen_same_off = model.NewBoolVar(f'pen_same_off_e{e}_d{d}')
                model.Add(x[e, d, 0] + x[e, d+7, 0] <= 1 + pen_same_off)
                bonus_vars.append(pen_same_off * -2500)

            # Hindari libur terlalu sering di hari kalender yang sama (rotasi Senin/Minggu dll)
            for weekday in range(7):
                same_weekday_offs = []
                for d in range(num_days):
                    if (start_date + timedelta(days=d)).weekday() == weekday:
                        same_weekday_offs.append(x[e, d, 0])
                if len(same_weekday_offs) >= 2:
                    for i in range(len(same_weekday_offs) - 1):
                        pen_wd_repeat = model.NewBoolVar(f'pen_wd_off_e{e}_wd{weekday}_i{i}')
                        model.Add(same_weekday_offs[i] + same_weekday_offs[i + 1] <= 1 + pen_wd_repeat)
                        bonus_vars.append(pen_wd_repeat * -1200)

            # Soft cross-month constraint (avoid S2 on last day -> S1 on first day)
            pen_cross = model.NewBoolVar(f'pen_cross_e{e}')
            model.Add(x[e, num_days-1, 2] + x[e, 0, 1] <= 1 + pen_cross)
            bonus_vars.append(pen_cross * -300)

        # FAIRNESS: rotasi kerja & libur, S1 >= S2 per orang
        work_counts = []
        off_counts = []
        s1_emp_counts = []
        s2_emp_counts = []
        target_work = int(round(num_days * 4 / 7))
        min_s1_person = max(2, target_work // 2)
        min_s2_person = max(1, target_work // 4)
        max_s2_person = max(min_s2_person + 2, int(math.ceil(target_work * 0.45)))
        for e in range(num_employees):
            s1_sum = sum(x[e, d, 1] for d in range(num_days))
            s2_sum = sum(x[e, d, 2] for d in range(num_days))
            off_sum = sum(x[e, d, 0] for d in range(num_days))
            work_counts.append(s1_sum + s2_sum)
            off_counts.append(off_sum)
            s1_emp_counts.append(s1_sum)
            s2_emp_counts.append(s2_sum)

            model.Add(s1_sum >= min_s1_person)
            model.Add(s2_sum >= min_s2_person)
            model.Add(s2_sum <= max_s2_person)

            s2_gt_s1 = model.NewBoolVar(f'p4_s2_gt_s1_e{e}')
            model.Add(s2_sum > s1_sum).OnlyEnforceIf(s2_gt_s1)
            model.Add(s2_sum <= s1_sum).OnlyEnforceIf(s2_gt_s1.Not())
            bonus_vars.append(s2_gt_s1 * -8000)

        max_work = model.NewIntVar(0, num_days, 'p4_max_work')
        min_work = model.NewIntVar(0, num_days, 'p4_min_work')
        model.AddMaxEquality(max_work, work_counts)
        model.AddMinEquality(min_work, work_counts)
        work_spread = model.NewIntVar(0, num_days, 'p4_work_spread')
        model.Add(work_spread == max_work - min_work)
        bonus_vars.append(work_spread * -4000)

        max_off = model.NewIntVar(0, num_days, 'p4_max_off')
        min_off = model.NewIntVar(0, num_days, 'p4_min_off')
        model.AddMaxEquality(max_off, off_counts)
        model.AddMinEquality(min_off, off_counts)
        off_spread = model.NewIntVar(0, num_days, 'p4_off_spread')
        model.Add(off_spread == max_off - min_off)
        bonus_vars.append(off_spread * -3000)

        max_s1_emp = model.NewIntVar(0, num_days, 'p4_max_s1_emp')
        min_s1_emp = model.NewIntVar(0, num_days, 'p4_min_s1_emp')
        model.AddMaxEquality(max_s1_emp, s1_emp_counts)
        model.AddMinEquality(min_s1_emp, s1_emp_counts)
        s1_emp_spread = model.NewIntVar(0, num_days, 'p4_s1_emp_spread')
        model.Add(s1_emp_spread == max_s1_emp - min_s1_emp)
        bonus_vars.append(s1_emp_spread * -5000)

        max_s2_emp = model.NewIntVar(0, num_days, 'p4_max_s2_emp')
        min_s2_emp = model.NewIntVar(0, num_days, 'p4_min_s2_emp')
        model.AddMaxEquality(max_s2_emp, s2_emp_counts)
        model.AddMinEquality(min_s2_emp, s2_emp_counts)
        s2_emp_spread = model.NewIntVar(0, num_days, 'p4_s2_emp_spread')
        model.Add(s2_emp_spread == max_s2_emp - min_s2_emp)
        bonus_vars.append(s2_emp_spread * -5000)

        model.Maximize(sum(bonus_vars))
        
        shift_map = {0: "OFF", 1: "S1", 2: "S2"}
        num_shifts = 3

    elif selected_pola == "POLA_5":
        # POLA 5: Longshift 4 Kerja, 2 Libur (Siklus 6 Hari)
        # S1 (12 Jam), S2 (12 Jam), OFF
        x = {}
        for e in range(num_employees):
            for d in range(-6, num_days):
                for s in range(3): # 0: OFF, 1: S1, 2: S2
                    x[e, d, s] = model.NewBoolVar(f'x_{e}_{d}_{s}')
                    
        # Tiap orang 1 status per hari
        for e in range(num_employees):
            for d in range(-6, num_days):
                model.AddExactlyOne(x[e, d, s] for s in range(3))
                
        bonus_vars = []
        
        # Aturan Libur: Tepat 3 hari libur setiap 7 hari (Sliding Window)
        for e in range(num_employees):
            for d in range(-6, num_days - 6):
                model.Add(sum(x[e, d+i, 0] for i in range(7)) == 3)
                
            # HARD CONSTRAINT: Tidak boleh 3 hari libur beruntun
            for d in range(-2, num_days - 2):
                model.Add(x[e, d, 0] + x[e, d+1, 0] + x[e, d+2, 0] <= 2)
                
            # SOFT CONSTRAINT: Usahakan ada 2 hari libur beruntun (karena dipecah 1 dan 2)
            for d in range(-1, num_days - 1):
                is_2_off = model.NewBoolVar(f'p5_2_off_e{e}_d{d}')
                model.Add(x[e, d, 0] + x[e, d+1, 0] == 2).OnlyEnforceIf(is_2_off)
                model.Add(x[e, d, 0] + x[e, d+1, 0] < 2).OnlyEnforceIf(is_2_off.Not())
                bonus_vars.append(is_2_off * 500)
                
            # Transisi: Tidak boleh Malam -> Pagi keesokan harinya
            for d in range(-1, num_days - 1):
                model.AddImplication(x[e, d, 2], x[e, d+1, 1].Not())

        for d in range(num_days):
            s1_count = sum(x[e, d, 1] for e in range(num_employees))
            s2_count = sum(x[e, d, 2] for e in range(num_employees))
            
            # HARD CONSTRAINT: Minimal per shift 2 orang
            model.Add(s1_count >= 2)
            model.Add(s2_count >= 2)

            current_date = start_date + timedelta(days=d)
            is_weekend = current_date.weekday() >= 5
            
            if is_weekend:
                # Sabtu - Minggu
                model.Add(s2_count <= 2)
                
                # Alokasikan S1 lebih banyak (S1 > S2) - prioritas sangat tinggi
                s1_gt_s2 = model.NewBoolVar(f'p5_we_s1_gt_s2_d{d}')
                model.Add(s1_count > s2_count).OnlyEnforceIf(s1_gt_s2)
                model.Add(s1_count <= s2_count).OnlyEnforceIf(s1_gt_s2.Not())
                bonus_vars.append(s1_gt_s2 * 5000)
                
            else:
                # Senin - Jumat
                model.Add(s2_count <= 3)
                
                # Alokasikan S1 lebih banyak (S1 > S2) - prioritas sangat tinggi
                s1_gt_s2 = model.NewBoolVar(f'p5_wd_s1_gt_s2_d{d}')
                model.Add(s1_count > s2_count).OnlyEnforceIf(s1_gt_s2)
                model.Add(s1_count <= s2_count).OnlyEnforceIf(s1_gt_s2.Not())
                bonus_vars.append(s1_gt_s2 * 5000)

            # Prioritas jumlah pekerja terbanyak: Senin dan Selasa dikurangi bobotnya agar tidak terlalu heavy.
            # Distribusikan team ke Selasa-Jumat agar lebih merata. Jumat, Sabtu, Minggu tetap aman.
            weekday_map = {
                0: 3,  # Senin
                1: 5,  # Selasa
                2: 5,  # Rabu
                3: 5,  # Kamis
                4: 4,  # Jumat
                5: 2,  # Sabtu
                6: 1   # Minggu
            }
            day_weight = weekday_map[current_date.weekday()]
            bonus_vars.append(s1_count * day_weight * 10)
            bonus_vars.append(s2_count * day_weight * 10)

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

        model.Maximize(sum(bonus_vars))
        
        shift_map = {0: "OFF", 1: "S1", 2: "S2"}
        num_shifts = 3

    elif selected_pola == "POLA_6":
        # POLA 6: Kombinasi S1 Langsung S2 (Siklus 8 Hari Berotasi)
        x = {}
        for e in range(num_employees):
            for d in range(-6, num_days):
                for s in range(3): # 0: OFF, 1: S1, 2: S2
                    x[e, d, s] = model.NewBoolVar(f'x_{e}_{d}_{s}')
                    
        for e in range(num_employees):
            for d in range(-6, num_days):
                model.AddExactlyOne(x[e, d, s] for s in range(3))
                
        bonus_vars = []
        target_off_days = int(round(num_days * 3 / 7))
        
        # GLOBAL COVERAGE: Same as POLA_4 for weekend religion rules
        for d in range(num_days):
            current_date = date(year, month, 1) + timedelta(days=d)
            is_weekend = current_date.weekday() >= 5
            
            s1_count = sum(x[e, d, 1] for e in range(num_employees))
            s2_count = sum(x[e, d, 2] for e in range(num_employees))
            
            # Agama/Kuliah Bias
            for e in range(num_employees):
                emp_rel = employees[e].religion
                if emp_rel == "Kristen" and current_date.weekday() == 6:
                    model.Add(x[e, d, 1] == 0)
                elif emp_rel == "Kuliah" and current_date.weekday() == 5:
                    model.Add(x[e, d, 1] == 0)
            
            if is_weekend:
                model.Add(s1_count >= 2)
                model.Add(s2_count >= 2)
            else:
                model.Add(s1_count >= 2)
                model.Add(s2_count >= 3)
                
        for e in range(num_employees):
            off_sum = sum(x[e, d, 0] for d in range(num_days))
            off_sum_target = model.NewBoolVar(f'p6_off_sum_target_{e}')
            model.Add(off_sum >= target_off_days - 2).OnlyEnforceIf(off_sum_target)
            model.Add(off_sum <= target_off_days + 2).OnlyEnforceIf(off_sum_target)
            bonus_vars.append(off_sum_target * 5000)

            # CALENDAR WEEKS SOFT CONSTRAINT (Senin - Minggu target 4 kerja, 3 libur)
            first_monday_idx = -1
            for i in range(min(7, num_days)):
                if (date(year, month, 1) + timedelta(days=i)).weekday() == 0:
                    first_monday_idx = i
                    break
                    
            if first_monday_idx > 0:
                partial_len = first_monday_idx
                target_partial = int(round(partial_len * 3 / 7))
                model.Add(sum(x[e, i, 0] for i in range(partial_len)) >= max(0, target_partial - 1))
                model.Add(sum(x[e, i, 0] for i in range(partial_len)) <= min(partial_len, target_partial + 1))
                
            if first_monday_idx != -1:
                curr_monday = first_monday_idx
                while curr_monday + 6 < num_days:
                    # SOFT CONSTRAINT: Bonus sangat besar jika tepat 3 libur
                    is_3_off = model.NewBoolVar(f'p6_is_3_off_e{e}_w{curr_monday}')
                    model.Add(sum(x[e, curr_monday+i, 0] for i in range(7)) == 3).OnlyEnforceIf(is_3_off)
                    model.Add(sum(x[e, curr_monday+i, 0] for i in range(7)) != 3).OnlyEnforceIf(is_3_off.Not())
                    bonus_vars.append(is_3_off * 30000)
                    
                    # Tetap berikan boundary yang masuk akal walau soft constraint gagal (minimal 2, maks 4 libur)
                    model.Add(sum(x[e, curr_monday+i, 0] for i in range(7)) >= 2)
                    model.Add(sum(x[e, curr_monday+i, 0] for i in range(7)) <= 4)
                    
                    curr_monday += 7
                
                if curr_monday < num_days:
                    partial_len = num_days - curr_monday
                    target_partial = int(round(partial_len * 3 / 7))
                    model.Add(sum(x[e, i, 0] for i in range(curr_monday, num_days)) >= max(0, target_partial - 1))
                    model.Add(sum(x[e, i, 0] for i in range(curr_monday, num_days)) <= min(partial_len, target_partial + 1))
            
            # Max 4 Work
            for d in range(-4, num_days - 4):
                no_5_work = model.NewBoolVar(f'p6_no_5_work_e{e}_d{d}')
                model.Add(sum(x[e, d+i, 0] for i in range(5)) >= 1).OnlyEnforceIf(no_5_work)
                model.Add(sum(x[e, d+i, 0] for i in range(5)) == 0).OnlyEnforceIf(no_5_work.Not())
                bonus_vars.append(no_5_work * 20000)
            
            # Min 2 Work (No O-W-O)
            for d in range(-1, num_days - 1):
                no_owo = model.NewBoolVar(f'p6_no_owo_e{e}_d{d}')
                model.Add(x[e, d-1, 0] - x[e, d, 0] + x[e, d+1, 0] <= 1).OnlyEnforceIf(no_owo)
                model.Add(x[e, d-1, 0] - x[e, d, 0] + x[e, d+1, 0] == 2).OnlyEnforceIf(no_owo.Not())
                bonus_vars.append(no_owo * 20000)
            
            # Max 3 Off (No O-O-O-O)
            for d in range(-3, num_days - 3):
                no_4_off = model.NewBoolVar(f'p6_no_4_off_e{e}_d{d}')
                model.Add(sum(x[e, d+i, 0] for i in range(4)) <= 3).OnlyEnforceIf(no_4_off)
                model.Add(sum(x[e, d+i, 0] for i in range(4)) == 4).OnlyEnforceIf(no_4_off.Not())
                bonus_vars.append(no_4_off * 20000)
                
            history_s2 = history_counts[e][2]
            for d in range(-1, num_days - 1):
                # HARD: S2 -> S1 forbidden
                model.Add(x[e, d, 2] + x[e, d+1, 1] <= 1)
                bonus_vars.append(x[e, d, 2] * (-50 * history_s2))

            # BALANCE S1 & S2
            s1_sum = sum(x[e, d, 1] for d in range(num_days))
            s2_sum = sum(x[e, d, 2] for d in range(num_days))
            s1_s2_diff = model.NewIntVar(-num_days, num_days, f'p6_s1_s2_diff_{e}')
            model.Add(s1_s2_diff == s1_sum - s2_sum)
            s1_s2_abs_diff = model.NewIntVar(0, num_days, f'p6_s1_s2_abs_diff_{e}')
            model.AddAbsEquality(s1_s2_abs_diff, s1_s2_diff)
            bonus_vars.append(s1_s2_abs_diff * -5000)
            
        model.Maximize(sum(bonus_vars))
        shift_map = {0: "OFF", 1: "S1", 2: "S2"}
        num_shifts = 3

    else:
        raise HTTPException(status_code=400, detail="Unknown model_type")

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    status = solver.Solve(model)
    
    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        prefix = f"{year}-{month:02d}-"
        db.query(models.Schedule).filter(
            models.Schedule.department_id == department_id,
            models.Schedule.date.like(f"{prefix}%")
        ).delete(synchronize_session=False)
        db.commit()
        
        start_date = date(year, month, 1)
        for d in range(num_days):
            current_date = start_date + timedelta(days=d)
            for e in range(num_employees):
                for s in range(num_shifts):
                    if solver.Value(x[e, d, s]):
                        new_sched = models.Schedule(
                            date=current_date.isoformat(),
                            employee_id=employees[e].id,
                            department_id=department_id,
                            shift=shift_map[s]
                        )
                        db.add(new_sched)
        db.commit()
        return {"msg": f"Jadwal {dept.name} berhasil digenerate!"}
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
        raise HTTPException(
            status_code=400,
            detail="Tidak dapat menemukan jadwal yang sesuai.",
        )

@app.get("/view")
def view(year: int, month: int, department_id: int, db: Session = Depends(get_db)):
    prefix = f"{year}-{month:02d}-"
    schedules = db.query(models.Schedule).filter(
        models.Schedule.department_id == department_id,
        models.Schedule.date.like(f"{prefix}%")
    ).order_by(models.Schedule.date).all()
    
    employees = db.query(models.Employee).filter(models.Employee.department_id == department_id).all()
    
    emp_map = {e.id: e.name for e in employees}
    result = {e.name: {} for e in employees}
    dates = set()
    
    for s in schedules:
        if s.employee_id in emp_map:
            name = emp_map[s.employee_id]
            result[name][s.date] = s.shift
            dates.add(s.date)
            
    return {
        "schedule": result,
        "dates": sorted(list(dates))
    }

@app.get("/view_all")
def view_all(department_id: int, db: Session = Depends(get_db)):
    schedules = db.query(models.Schedule).filter(
        models.Schedule.department_id == department_id
    ).order_by(models.Schedule.date).all()
    
    employees = db.query(models.Employee).filter(models.Employee.department_id == department_id).all()
    emp_map = {e.id: e.name for e in employees}
    
    result = {}
    for s in schedules:
        month_key = s.date[:7] # Format YYYY-MM
        if month_key not in result:
            result[month_key] = {"schedule": {e.name: {} for e in employees}, "dates": set()}
            
        if s.employee_id in emp_map:
            name = emp_map[s.employee_id]
            result[month_key]["schedule"][name][s.date] = s.shift
            result[month_key]["dates"].add(s.date)
            
    for mk in result:
        result[mk]["dates"] = sorted(list(result[mk]["dates"]))
        
    return result

@app.delete("/delete_schedule")
def delete_schedule(year: int, month: int, department_id: int, db: Session = Depends(get_db)):
    prefix = f"{year}-{month:02d}-"
    db.query(models.Schedule).filter(
        models.Schedule.department_id == department_id,
        models.Schedule.date.like(f"{prefix}%")
    ).delete(synchronize_session=False)
    db.commit()
    return {"msg": "Jadwal berhasil dihapus"}


from pydantic import BaseModel, Field
from typing import List
import uuid


class SolveEmployee(BaseModel):
    id: int
    name: str = "user"
    religion: str = "Umum"


class SolveHistory(BaseModel):
    employee_id: int
    date: str
    shift: str


class SolveRequest(BaseModel):
    year: int
    month: int
    pola: str = Field(..., description="POLA_1 … POLA_6")
    employees: List[SolveEmployee]
    history: List[SolveHistory] = []


@app.get("/health")
def health():
    return {"ok": True, "service": "shift-solver"}


@app.post("/solve")
def solve(payload: SolveRequest, db: Session = Depends(get_db)):
    """
    Stateless-ish solve: seed a temporary department + employees + history,
    run the existing OR-Tools generate(), return assignments mapped to caller user ids.
    """
    if not payload.employees:
        raise HTTPException(status_code=400, detail="employees required")

    pola = payload.pola.upper().strip()
    if not pola.startswith("POLA_"):
        raise HTTPException(status_code=400, detail="pola must be POLA_1 … POLA_6")

    dept_name = f"solve-{uuid.uuid4().hex}"
    dept = models.Department(name=dept_name, model_type=pola)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    id_map = {}  # external user id -> employee row id
    for e in payload.employees:
        religion = e.religion if e.religion in ("Umum", "Kristen", "Kuliah") else "Umum"
        emp = models.Employee(
            name=f"{uuid.uuid4().hex[:8]}:{e.id}:{e.name}"[:120],
            department_id=dept.id,
            religion=religion,
        )
        db.add(emp)
        db.flush()
        id_map[int(e.id)] = emp.id
    db.commit()

    for h in payload.history:
        emp_id = id_map.get(int(h.employee_id))
        if not emp_id:
            continue
        db.add(
            models.Schedule(
                date=h.date,
                employee_id=emp_id,
                department_id=dept.id,
                shift=h.shift,
            )
        )
    db.commit()

    # Run existing generator (mutates schedules for this dept/month)
    generate(
        year=payload.year,
        month=payload.month,
        department_id=dept.id,
        pola=pola,
        full_shift=None,
        db=db,
    )

    prefix = f"{payload.year}-{payload.month:02d}-"
    rows = (
        db.query(models.Schedule)
        .filter(
            models.Schedule.department_id == dept.id,
            models.Schedule.date.like(f"{prefix}%"),
        )
        .all()
    )
    reverse = {v: k for k, v in id_map.items()}
    schedules = [
        {
            "userId": reverse[r.employee_id],
            "date": r.date,
            "shift": r.shift,
        }
        for r in rows
        if r.employee_id in reverse
    ]

    # Cleanup temp dept data (best-effort)
    try:
        db.query(models.Schedule).filter(models.Schedule.department_id == dept.id).delete(
            synchronize_session=False
        )
        db.query(models.Employee).filter(models.Employee.department_id == dept.id).delete(
            synchronize_session=False
        )
        db.query(models.Department).filter(models.Department.id == dept.id).delete(
            synchronize_session=False
        )
        db.commit()
    except Exception:
        db.rollback()

    return {"pola": pola, "count": len(schedules), "schedules": schedules}

