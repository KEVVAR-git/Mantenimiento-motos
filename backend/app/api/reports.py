"""
Endpoint de reportes y estadísticas del dashboard.
Consulta datos reales de la base de datos en Supabase.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Maintenance, Vehicle, User
from app.schemas import DashboardSummary
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtiene un resumen de estadísticas reales para el dashboard."""
    total_vehicles = db.query(func.count(Vehicle.id)).scalar() or 0
    total_maintenance = db.query(func.count(Maintenance.id)).scalar() or 0
    active_maintenances = db.query(func.count(Maintenance.id)).filter(
        Maintenance.status.in_(["en_progreso", "pendiente"])
    ).scalar() or 0
    total_revenue = db.query(func.coalesce(func.sum(Maintenance.cost), 0)).scalar() or 0

    # Obtener los 5 mantenimientos más recientes
    recent_records = db.query(Maintenance).order_by(Maintenance.created_at.desc()).limit(5).all()
    
    recent_activity = []
    for r in recent_records:
        vehicle = db.query(Vehicle).filter(Vehicle.id == r.vehicle_id).first()
        plate = vehicle.plate if vehicle else "Desconocida"
        
        # Determinar el tipo de actividad basado en el estado
        activity_type = "completed" if r.status == "completado" else "in_progress"
        
        recent_activity.append({
            "id": r.id,
            "type": activity_type,
            "plate": plate,
            "description": f"Mantenimiento {r.status} - {r.description}",
            "created_at": r.created_at
        })

    return {
        "total_vehicles": total_vehicles,
        "total_maintenance_records": total_maintenance,
        "active_maintenances": active_maintenances,
        "total_revenue": float(total_revenue),
        "recent_activity": recent_activity
    }
