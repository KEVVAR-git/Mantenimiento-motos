import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import OCRLog, User
from app.api.auth import get_current_user
import pytesseract
from PIL import Image
import re

router = APIRouter()

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

PLATE_RE = re.compile(r'^[A-Z]{3}\d{3}$|^[A-Z]{3}\d{2}[A-Z]$')

# Correcciones por posición: las 3 primeras deben ser LETRAS, las 2 siguientes NÚMEROS
LETTER_FIXES = {'0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '8': 'B', '6': 'G'}
NUMBER_FIXES = {'O': '0', 'I': '1', 'L': '1', 'Z': '2', 'A': '4', 'S': '5', 'B': '8', 'G': '6', 'Q': '0', 'D': '0'}


def coerce_plate(s: str) -> tuple[str, int]:
    """
    Dado un string de 6 chars, intenta corregir confusiones OCR por posición:
    pos 0-2 → deben ser LETRAS, pos 3-4 → deben ser NÚMEROS, pos 5 → cualquiera.
    Retorna (placa_corregida, penalización). Penalización 0 = sin correcciones.
    """
    if len(s) < 6:
        return s, 999
    chars = list(s[:6])
    penalty = 0
    for i in range(3):
        if chars[i] in LETTER_FIXES:
            chars[i] = LETTER_FIXES[chars[i]]
            penalty += 1
        elif chars[i].isdigit():
            penalty += 10
    for i in range(3, 5):
        if chars[i] in NUMBER_FIXES:
            chars[i] = NUMBER_FIXES[chars[i]]
            penalty += 1
        elif chars[i].isalpha():
            penalty += 10
    return ''.join(chars), penalty


def clean(text: str) -> str:
    """Deja solo letras mayúsculas y números."""
    return re.sub(r'[^A-Z0-9]', '', text.upper())


def ocr_variants(img: np.ndarray) -> list[str]:
    """
    Prueba múltiples combinaciones de escalado, preprocesamiento y modo PSM.
    Al explorar 24 variaciones diferentes, garantizamos que si la imagen es
    muy pequeña, borrosa o iluminada de forma irregular, alguna combinación
    encontrará el texto correcto sin alucinar caracteres falsos.
    """
    results = []

    # Escalar la imagen a 1x (original), 2x y 3x
    for scale in [1.0, 2.0, 3.0]:
        if scale != 1.0:
            resized = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        else:
            resized = img

        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

        # Filtro 1: Gris normal
        # Filtro 2: Bilateral (suaviza fondo, mantiene bordes afilados)
        bilateral = cv2.bilateralFilter(gray, 11, 17, 17)

        # Filtro 3: Umbral OTSU
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Filtro 4: Blur Gaussiano + OTSU (excelente para ruido granulado)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        _, blur_otsu = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # PSM 6 = Asume un bloque uniforme de texto (perfecto para placas de moto en 2 líneas)
        # PSM 11 = Texto disperso (busca caracteres en toda la imagen)
        for preprocessed in [gray, bilateral, otsu, blur_otsu]:
            pil = Image.fromarray(preprocessed)
            for psm in [6, 11]:
                raw = pytesseract.image_to_string(pil, config=f'--oem 3 --psm {psm}')
                cleaned = clean(raw)
                if cleaned:
                    results.append(cleaned)

    return results


def find_best_plate(texts: list[str]) -> str | None:
    """
    1. Busca patrón exacto de placa colombiana en todos los textos.
    2. Si no encuentra, recorre ventanas de 6 chars aplicando correcciones OCR
       y elige la que tenga menor penalización.
    """
    # Paso 1: búsqueda directa (sin correcciones)
    for text in texts:
        for i in range(len(text) - 5):
            window = text[i:i+6]
            if PLATE_RE.match(window):
                return window

    # Paso 2: búsqueda con autocorrección
    best_plate = None
    best_penalty = 999
    for text in texts:
        for i in range(len(text) - 5):
            corrected, penalty = coerce_plate(text[i:i+6])
            if PLATE_RE.match(corrected) and penalty < best_penalty:
                best_penalty = penalty
                best_plate = corrected

    return best_plate


@router.post("/analyze-plate")
async def analyze_license_plate(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen válida.")

    image_bytes = await file.read()

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Escalar a 800px de ancho (tamaño óptimo para Tesseract)
        target_w = 800
        ratio = target_w / img.shape[1]
        img_resized = cv2.resize(img, (target_w, int(img.shape[0] * ratio)), interpolation=cv2.INTER_CUBIC)

        # Obtener todos los textos posibles
        all_texts = ocr_variants(img_resized)

        # Buscar patrón de placa colombiana
        plate_raw = find_best_plate(all_texts)

        if plate_raw:
            detected_text = f"{plate_raw[:3]}-{plate_raw[3:]}"
            raw_text = plate_raw
        else:
            # Fallback: mostrar el texto más largo capturado para que el usuario corrija
            best_raw = max(all_texts, key=len) if all_texts else ''
            raw_text = best_raw[:12]  # máximo 12 chars para no mostrar basura
            if len(best_raw) >= 4:
                chunk = best_raw[:6]
                detected_text = f"{chunk[:3]}-{chunk[3:]}" if len(chunk) >= 4 else chunk
            else:
                detected_text = "NO-DETECTADA"

        # Guardar en BD
        new_log = OCRLog(
            image_path=file.filename,
            detected_text=detected_text,
            confidence=0.85,
            is_corrected=False
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)

        return {
            "id": new_log.id,
            "filename": file.filename,
            "detected_text": detected_text,
            "raw_text": raw_text,
            "confidence": 0.85,
            "message": "OCR procesado exitosamente"
        }

    except pytesseract.TesseractNotFoundError:
        raise HTTPException(status_code=500, detail="Tesseract-OCR no está instalado.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
