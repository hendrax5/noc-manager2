from sqlalchemy import Column, Integer, String, ForeignKey
from database import Base

class Department(Base):
    __tablename__ = "departments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    model_type = Column(String)  # "NOC_JAKARTA" or "NOC_CORE"

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    religion = Column(String, default="Umum")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)  # YYYY-MM-DD
    employee_id = Column(Integer, ForeignKey("employees.id"))
    department_id = Column(Integer, ForeignKey("departments.id"))
    shift = Column(String)  # "S1", "S2", "S3", "OFF"
