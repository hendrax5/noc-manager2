from pydantic import BaseModel
from typing import Optional

class DepartmentBase(BaseModel):
    name: str
    model_type: str

class DepartmentCreate(DepartmentBase):
    pass

class Department(DepartmentBase):
    id: int

    class Config:
        orm_mode = True
        from_attributes = True

class EmployeeBase(BaseModel):
    name: str
    department_id: int
    religion: Optional[str] = "Umum"

class EmployeeCreate(EmployeeBase):
    pass

class Employee(EmployeeBase):
    id: int

    class Config:
        orm_mode = True
        from_attributes = True

class ScheduleBase(BaseModel):
    date: str
    employee_id: int
    department_id: int
    shift: str

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: int

    class Config:
        orm_mode = True
        from_attributes = True
