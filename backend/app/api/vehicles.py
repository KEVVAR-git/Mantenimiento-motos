"""
Endpoints CRUD para vehículos (motocicletas).
Todas las operaciones se hacen contra la base de datos real en Supabase.
"""
import re
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models import Vehicle, User
from app.schemas import VehicleCreate, VehicleResponse
from app.api.auth import get_current_user

router = APIRouter()


def find_vehicle(db: Session, plate: str):
    """
    Busca un vehículo de forma flexible y tolerante a fallos:
    1. Búsqueda exacta
    2. Búsqueda insensible a mayúsculas/minúsculas
    3. Búsqueda normalizada sin guiones ni espacios
    4. Búsqueda iterativa en memoria
    """
    if not plate:
        return None
    raw_plate = plate.strip()
    clean_search = re.sub(r'[-\s]', '', raw_plate).upper()

    # 1. Coincidencia exacta
    v = db.query(Vehicle).filter(Vehicle.plate == raw_plate).first()
    if v:
        return v

    # 2. Insensible a mayúsculas/minúsculas
    v = db.query(Vehicle).filter(func.upper(Vehicle.plate) == clean_search).first()
    if v:
        return v

    # 3. Comparación ignorando guiones y espacios en la base de datos
    v = db.query(Vehicle).filter(
        func.upper(func.replace(func.replace(Vehicle.plate, '-', ''), ' ', '')) == clean_search
    ).first()
    if v:
        return v

    # 4. Fallback iterativo en memoria
    for item in db.query(Vehicle).all():
        if re.sub(r'[-\s]', '', item.plate).upper() == clean_search:
            return item

    return None


@router.get("/", response_model=List[VehicleResponse])
def get_vehicles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtiene la lista de todos los vehículos registrados."""
    vehicles = db.query(Vehicle).all()
    return vehicles


@router.post("/", response_model=VehicleResponse)
def create_vehicle(vehicle_data: VehicleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Registra un nuevo vehículo en la base de datos."""
    clean_plate = re.sub(r'[-\s]', '', vehicle_data.plate).upper()
    # Verificar si la placa ya existe con búsqueda flexible
    existing = find_vehicle(db, clean_plate)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un vehículo con esa placa")

    new_vehicle = Vehicle(
        plate=clean_plate,
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
    """Busca un vehículo por su número de placa (flexible)."""
    vehicle = find_vehicle(db, plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail=f"Vehículo con placa '{plate}' no encontrado")
    return vehicle


@router.put("/{plate}", response_model=VehicleResponse)
def update_vehicle(plate: str, vehicle_data: VehicleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Actualiza la información de un vehículo registrado."""
    vehicle = find_vehicle(db, plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    if vehicle_data.owner_name is not None:
        vehicle.owner_name = vehicle_data.owner_name
    if vehicle_data.owner_phone is not None:
        vehicle.owner_phone = vehicle_data.owner_phone
    if vehicle_data.brand is not None:
        vehicle.brand = vehicle_data.brand
    if vehicle_data.model is not None:
        vehicle.model = vehicle_data.model
    if vehicle_data.year is not None:
        vehicle.year = vehicle_data.year

    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{plate}")
def delete_vehicle(plate: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Elimina un vehículo por su placa."""
    vehicle = find_vehicle(db, plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    deleted_plate = vehicle.plate
    db.delete(vehicle)
    db.commit()
    return {"message": f"Vehículo con placa {deleted_plate} eliminado exitosamente"}
