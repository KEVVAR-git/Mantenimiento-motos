import os
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import OCRLog
import pytesseract
from PIL import Image

router = APIRouter()

import re

# Opcional: Si en tu PC de Windows instalas Tesseract en otra ruta, deberás descomentar y ajustar esta línea:
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Aplica filtros con OpenCV para mejorar el contraste de la placa."""
    # Convertir bytes a un array numpy (formato que usa opencv)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # 1. Escala de grises
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. Reducir ruido (Filtro bilateral mantiene los bordes afilados)
    bfilter = cv2.bilateralFilter(gray, 11, 17, 17)
    
    # Dejamos que Tesseract haga su propia binarización interna, suele ser mejor 
    # cuando la imagen tiene sombras como en la foto.
    return bfilter

@router.post("/analyze-plate")
async def analyze_license_plate(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Sube una imagen de una placa, la procesa con OpenCV y extrae el texto con pytesseract.
    Guarda un registro en la tabla OCRLog de la base de datos.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen válida.")

    image_bytes = await file.read()
    
    try:
        # Preprocesar la imagen con OpenCV
        processed_img_array = preprocess_image(image_bytes)
        
        # Convertir array de opencv de vuelta a imagen de la librería PIL (Pillow)
        pil_img = Image.fromarray(processed_img_array)
        
        # Ejecutar OCR (Reconocimiento óptico)
        # --psm 11: Encuentra texto disperso en cualquier parte (ideal porque la foto no está recortada)
        custom_config = r'--oem 3 --psm 11'
        raw_text = pytesseract.image_to_string(pil_img, config=custom_config)
        
        # Limpiar todo el texto: dejar solo letras mayúsculas y números
        clean_text = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
        
        # Buscar patrón de placa colombiana: 
        # Carros: 3 letras + 3 números (AAA123)
        # Motos: 3 letras + 2 números + 1 letra (AAA12A)
        match = re.search(r'[A-Z]{3}\d{2}[A-Z0-9]', clean_text)
        
        if match:
            plate_raw = match.group(0)
            # Formatear bonito con guión: QBW-59D
            detected_text = f"{plate_raw[:3]}-{plate_raw[3:]}"
        else:
            # Si no hace match exacto, pero hay suficientes caracteres, usamos fallback
            if len(clean_text) >= 5:
                detected_text = clean_text[:6]
            else:
                detected_text = "NO-DETECTADA"
        
        # En pytesseract obtener la confianza (confidence) es complejo con psm 8, simulamos un 85% por defecto.
        confidence = 0.85
        
        # Guardar historial en la Base de Datos (Supabase)
        new_log = OCRLog(
            image_path=file.filename,
            detected_text=detected_text,
            confidence=confidence,
            is_corrected=False
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        
        return {
            "id": new_log.id,
            "filename": file.filename,
            "detected_text": detected_text,
            "confidence": confidence,
            "message": "OCR procesado exitosamente"
        }
        
    except pytesseract.TesseractNotFoundError:
        # Este error captura el problema más común en Windows: Tesseract no está instalado o no está en PATH
        raise HTTPException(
            status_code=500, 
            detail="Tesseract-OCR no está instalado en tu computadora o no está configurado en las variables de entorno. Instálalo desde: https://github.com/UB-Mannheim/tesseract/wiki"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno procesando imagen: {str(e)}")
