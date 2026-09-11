"""
Modelos ORM (SQLAlchemy) que representan las tablas en la base de datos.
Cada clase mapea directamente a una tabla en PostgreSQL (Supabase).
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """Tabla de usuarios del sistema."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="mechanic")


class Vehicle(Base):
    """Tabla de vehículos (motocicletas) registrados."""
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    plate = Column(String(20), unique=True, nullable=False, index=True)
    owner_name = Column(String(100), nullable=False)
    owner_phone = Column(String(20), nullable=True)
    brand = Column(String(50), nullable=True)
    model = Column(String(50), nullable=True)
    year = Column(Integer, nullable=True)

    # Relación: un vehículo tiene muchos mantenimientos
    maintenances = relationship("Maintenance", back_populates="vehicle", cascade="all, delete-orphan")


class Maintenance(Base):
    """Tabla de registros de mantenimiento."""
    __tablename__ = "maintenances"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    cost = Column(Float, nullable=True)
    status = Column(String(20), default="pendiente")
    scheduled_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relación inversa al vehículo
    vehicle = relationship("Vehicle", back_populates="maintenances")


class OCRLog(Base):
    """Tabla de registros de escaneo OCR."""
    __tablename__ = "ocr_logs"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String(255), nullable=True)
    detected_text = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    is_corrected = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
