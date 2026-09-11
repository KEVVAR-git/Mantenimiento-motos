"""
Esquemas Pydantic para validación de datos de entrada y salida de la API.
Separados de los modelos ORM para mantener una arquitectura limpia.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


# ==================== AUTH ====================

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "mechanic"

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str


# ==================== VEHICLES ====================

class VehicleCreate(BaseModel):
    plate: str
    owner_name: str
    owner_phone: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None

class VehicleResponse(BaseModel):
    id: int
    plate: str
    owner_name: str
    owner_phone: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None

    class Config:
        from_attributes = True


# ==================== MAINTENANCE ====================

class MaintenanceCreate(BaseModel):
    plate: str
    description: str
    cost: Optional[float] = None
    status: Optional[str] = "pendiente"
    scheduled_date: Optional[date] = None

class MaintenanceResponse(BaseModel):
    id: int
    vehicle_id: int
    plate: Optional[str] = None  # Se llena desde la relación con Vehicle
    description: str
    cost: Optional[float] = None
    status: str
    scheduled_date: Optional[date] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== REPORTS ====================

class ActivityItem(BaseModel):
    id: int
    type: str
    plate: str
    description: str
    created_at: datetime

class DashboardSummary(BaseModel):
    total_vehicles: int
    total_maintenance_records: int
    active_maintenances: int
    total_revenue: float
    recent_activity: list[ActivityItem] = []
