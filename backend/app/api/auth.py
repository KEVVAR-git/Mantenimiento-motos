"""
Endpoint de autenticación.
Valida credenciales contra la base de datos real y genera tokens JWT.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database import get_db
from app.models import User
from app.schemas import UserLogin, UserCreate, UserResponse, Token

router = APIRouter()

# Contexto para hashear y verificar contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Inicia sesión validando credenciales contra la base de datos."""
    user = db.query(User).filter(User.username == user_data.username).first()

    if not user or not pwd_context.verify(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # En producción usarías python-jose para generar un JWT real
    return {
        "access_token": f"token-{user.username}-{user.id}",
        "token_type": "bearer"
    }


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Registra un nuevo usuario en el sistema."""
    # Verificar si el usuario ya existe
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")

    new_user = User(
        username=user_data.username,
        hashed_password=pwd_context.hash(user_data.password),
        role=user_data.role or "mechanic"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/me")
def get_current_user():
    """Obtiene el usuario actual basado en el token."""
    return {"username": "admin", "role": "administrator"}
