import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, vehicles, maintenance, ocr, reports
from app.database import engine, Base
from app.models import User, Vehicle, Maintenance, OCRLog
from passlib.context import CryptContext
from app.database import SessionLocal

app = FastAPI(title="Sistema de Mantenimiento con OCR", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Contexto para hashear contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@app.on_event("startup")
def startup_event():
    """
    Al iniciar el servidor:
    1. Crear todas las tablas en la base de datos (si no existen)
    2. Crear un usuario admin por defecto (si no existe)
    """
    print("[INFO] Conectando a la base de datos Supabase...")
    Base.metadata.create_all(bind=engine)
    print("[OK] Tablas creadas/verificadas exitosamente.")

    # Crear usuario admin por defecto
    db = SessionLocal()
    try:
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if not existing_admin:
            admin_user = User(
                username="admin",
                hashed_password=pwd_context.hash("admin123"),
                role="administrator"
            )
            db.add(admin_user)
            db.commit()
            print("[OK] Usuario admin creado (usuario: admin, contrasena: admin123)")
        else:
            print("[INFO] Usuario admin ya existe.")
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API del Sistema de Mantenimiento de Motocicletas"}


# Incluir los enrutadores de los diferentes endpoints
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(vehicles.router, prefix="/api/vehicles", tags=["vehicles"])
app.include_router(maintenance.router, prefix="/api/maintenance", tags=["maintenance"])
app.include_router(ocr.router, prefix="/api/ocr", tags=["ocr"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
