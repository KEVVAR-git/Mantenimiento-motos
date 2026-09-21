"""
Endpoints CRUD para vehículos (motocicletas).
Todas las operaciones se hacen contra la base de datos real en Supabase.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Vehicle, User
from app.schemas import VehicleCreate, VehicleResponse
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[VehicleResponse])
def get_vehicles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtiene la lista de todos los vehículos registrados."""
    vehicles = db.query(Vehicle).all()
    return vehicles


@router.post("/", response_model=VehicleResponse)
def create_vehicle(vehicle_data: VehicleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Registra un nuevo vehículo en la base de datos."""
    # Verificar si la placa ya existe
    existing = db.query(Vehicle).filter(Vehicle.plate == vehicle_data.plate).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un vehículo con esa placa")

    new_vehicle = Vehicle(
        plate=vehicle_data.plate,
        owner_name=vehicle_data.owner_name,
        owner_phone=vehicle_data.owner_phone,
        brand=vehicle_data.brand,
        model=vehicle_data.model,
        year=vehicle_data.year
    )
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle


@router.get("/{plate}", response_model=VehicleResponse)
def get_vehicle_by_plate(plate: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Busca un vehículo por su número de placa."""
    vehicle = db.query(Vehicle).filter(Vehicle.plate == plate).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return vehicle


@router.delete("/{plate}")
def delete_vehicle(plate: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Elimina un vehículo por su placa."""
    vehicle = db.query(Vehicle).filter(Vehicle.plate == plate).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    db.delete(vehicle)
    db.commit()
    return {"message": f"Vehículo con placa {plate} eliminado exitosamente"}
