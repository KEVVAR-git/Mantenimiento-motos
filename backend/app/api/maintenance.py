"""
Endpoints CRUD para registros de mantenimiento.
Todas las operaciones se hacen contra la base de datos real en Supabase.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Maintenance, Vehicle, User
from app.schemas import MaintenanceCreate, MaintenanceResponse, MaintenanceUpdate
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[MaintenanceResponse])
def get_all_maintenance_records(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtiene todos los registros de mantenimiento con la placa del vehículo."""
    records = db.query(Maintenance).all()
    result = []
    for r in records:
        vehicle = db.query(Vehicle).filter(Vehicle.id == r.vehicle_id).first()
        result.append(MaintenanceResponse(
            id=r.id,
            vehicle_id=r.vehicle_id,
            plate=vehicle.plate if vehicle else "Desconocido",
            description=r.description,
            cost=r.cost,
            status=r.status,
            scheduled_date=r.scheduled_date,
            created_at=r.created_at
        ))
    return result


@router.post("/", response_model=MaintenanceResponse)
def create_maintenance_record(record: MaintenanceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Crea un nuevo registro de mantenimiento."""
    # Buscar el vehículo por placa (limpiando guiones o espacios)
    clean_plate = re.sub(r'[-\s]', '', record.plate).upper()
    vehicle = db.query(Vehicle).filter(Vehicle.plate == clean_plate).first()
    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró un vehículo con placa '{clean_plate}'. Registra el vehículo primero."
        )

    new_record = Maintenance(
        vehicle_id=vehicle.id,
        description=record.description,
        cost=record.cost,
        status=record.status or "pendiente",
        scheduled_date=record.scheduled_date
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    return MaintenanceResponse(
        id=new_record.id,
        vehicle_id=new_record.vehicle_id,
        plate=vehicle.plate,
        description=new_record.description,
        cost=new_record.cost,
        status=new_record.status,
        scheduled_date=new_record.scheduled_date,
        created_at=new_record.created_at
    )


@router.get("/{plate}", response_model=List[MaintenanceResponse])
def get_maintenance_history(plate: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtiene el historial de mantenimiento de un vehículo por su placa."""
    clean_plate = re.sub(r'[-\s]', '', plate).upper()
    vehicle = db.query(Vehicle).filter(Vehicle.plate == clean_plate).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    records = db.query(Maintenance).filter(Maintenance.vehicle_id == vehicle.id).all()
    return [
        MaintenanceResponse(
            id=r.id,
            vehicle_id=r.vehicle_id,
            plate=vehicle.plate,
            description=r.description,
            cost=r.cost,
            status=r.status,
            scheduled_date=r.scheduled_date,
            created_at=r.created_at
        )
        for r in records
    ]


@router.put("/{record_id}", response_model=MaintenanceResponse)
def update_maintenance_record(record_id: int, update_data: MaintenanceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Actualiza los datos o el estado de un registro de mantenimiento."""
    record = db.query(Maintenance).filter(Maintenance.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro de mantenimiento no encontrado")

    if update_data.description is not None:
        record.description = update_data.description
    if update_data.cost is not None:
        record.cost = update_data.cost
    if update_data.status is not None:
        record.status = update_data.status
    if update_data.scheduled_date is not None:
        record.scheduled_date = update_data.scheduled_date

    db.commit()
    db.refresh(record)

    vehicle = db.query(Vehicle).filter(Vehicle.id == record.vehicle_id).first()

    return MaintenanceResponse(
        id=record.id,
        vehicle_id=record.vehicle_id,
        plate=vehicle.plate if vehicle else "Desconocido",
        description=record.description,
        cost=record.cost,
        status=record.status,
        scheduled_date=record.scheduled_date,
        created_at=record.created_at
    )


@router.delete("/{record_id}")
def delete_maintenance_record(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Elimina un registro de mantenimiento por su ID."""
    record = db.query(Maintenance).filter(Maintenance.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro de mantenimiento no encontrado")

    db.delete(record)
    db.commit()
    return {"message": f"Registro de mantenimiento #{record_id} eliminado exitosamente"}
