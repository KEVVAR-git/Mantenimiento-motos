"""
Esquemas Pydantic para validación de datos de entrada y salida de la API.
Separados de los modelos ORM para mantener una arquitectura limpia.
"""
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime
import re


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

    @field_validator('plate')
    @classmethod
    def validate_plate(cls, v: str) -> str:
        clean = re.sub(r'[-\s]', '', v).upper()
        # Formato colombiano:
        # - 3 letras + 2 dígitos + 1 letra (Motos colombianas actuales: ej. ABC12D)
        # - 3 letras + 3 dígitos (Automóviles / Servicio público: ej. ABC123)
        # - 3 letras + 2 dígitos (Motos clásicas: ej. ABC12)
        if not re.match(r'^[A-Z]{3}\d{2}[A-Z\d]?$', clean):
            raise ValueError('Formato de placa inválido. Debe ser como ABC12D (motos), ABC123 o ABC12.')
        return clean

    @field_validator('year')
    @classmethod
    def validate_year(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            max_year = datetime.now().year + 1
            if v < 1970 or v > max_year:
                raise ValueError(f'El año debe ser un valor válido entre 1970 y {max_year}.')
        return v

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

    @field_validator('plate')
    @classmethod
    def clean_plate(cls, v: str) -> str:
        clean = re.sub(r'[-\s]', '', v).upper()
        if not clean:
            raise ValueError('La placa es obligatoria.')
        return clean

    @field_validator('cost')
    @classmethod
    def validate_cost(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('El costo no puede ser un número negativo.')
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        allowed = ['pendiente', 'en_progreso', 'completado']
        if v and v.lower() not in allowed:
            raise ValueError(f"Estado inválido. Debe ser uno de: {', '.join(allowed)}.")
        return v.lower() if v else "pendiente"

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


class MaintenanceUpdate(BaseModel):
    description: Optional[str] = None
    cost: Optional[float] = None
    status: Optional[str] = None
    scheduled_date: Optional[date] = None

    @field_validator('cost')
    @classmethod
    def validate_cost(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('El costo no puede ser un número negativo.')
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        allowed = ['pendiente', 'en_progreso', 'completado']
        if v and v.lower() not in allowed:
            raise ValueError(f"Estado inválido. Debe ser uno de: {', '.join(allowed)}.")
        return v.lower() if v else None


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
