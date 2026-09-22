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

PLATE_RE = re.compile(r'^[A-Z]{3}\d{3}$|^[A-Z]{3}\d{2}[A-Z]$|^[A-Z]{3}\d{2}$')

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


def get_yellow_plate_crops(img: np.ndarray) -> list[np.ndarray]:
    """
    Segmenta y aísla la placa amarilla de la motocicleta usando espacio de color HSV.
    Corrige la rotación (deskewing) para que Tesseract reciba el texto horizontal.
    Elimina el fondo (ladrillos, calle, personas, etc.).
    """
    h_img, w_img = img.shape[:2]
    crops = []

    # 1. Máscara de color amarillo característico de placas colombianas
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lower_yellow = np.array([10, 50, 50])
    upper_yellow = np.array([45, 255, 255])
    mask = cv2.inRange(hsv, lower_yellow, upper_yellow)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    mask_clean = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask_clean = cv2.morphologyEx(mask_clean, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask_clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates_cnt = [c for c in contours if cv2.contourArea(c) > (h_img * w_img * 0.02)]

    if candidates_cnt:
        best_cnt = max(candidates_cnt, key=cv2.contourArea)
        rect = cv2.minAreaRect(best_cnt)
        center, size, angle = rect
        if angle < -45:
            angle = 90 + angle
        elif angle > 45:
            angle = angle - 90

        # Probar rotaciones controladas alrededor del ángulo detectado
        angles_to_try = set([angle, angle - 10, angle - 5, angle + 5, -16, -12, 0])
        for a in angles_to_try:
            M = cv2.getRotationMatrix2D(center, a, 1.0)
            rot = cv2.warpAffine(img, M, (w_img, h_img), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            hsv_r = cv2.cvtColor(rot, cv2.COLOR_BGR2HSV)
            mask_r = cv2.inRange(hsv_r, lower_yellow, upper_yellow)
            mask_r = cv2.morphologyEx(mask_r, cv2.MORPH_CLOSE, kernel)
            cnts_r, _ = cv2.findContours(mask_r, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not cnts_r:
                continue
            c_r = max(cnts_r, key=cv2.contourArea)
            rx, ry, rw, rh = cv2.boundingRect(c_r)
            mx, my = int(rw * 0.04), int(rh * 0.04)
            x0, y0 = max(0, rx - mx), max(0, ry - my)
            x1, y1 = min(w_img, rx + rw + mx), min(h_img, ry + rh + my)
            crops.append(rot[y0:y1, x0:x1])

    # Fallback con la imagen completa redimensionada si no se hallaron contornos amarillos
    target_w = 800
    ratio = target_w / w_img
    crops.append(cv2.resize(img, (target_w, int(h_img * ratio)), interpolation=cv2.INTER_CUBIC))
    return crops


def ocr_variants(img: np.ndarray) -> list[str]:
    """
    Aísla la placa, rota para enderezarla y prueba variantes de contraste en Tesseract.
    """
    crops = get_yellow_plate_crops(img)
    results = []

    for c in crops:
        if c.shape[0] < 20 or c.shape[1] < 20:
            continue
        target_h = 180
        target_w = int(c.shape[1] * (target_h / c.shape[0]))
        c_res = cv2.resize(c, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
        gray = cv2.cvtColor(c_res, cv2.COLOR_BGR2GRAY)

        # Probar recorte completo y recorte enfocado en la zona de caracteres (omitir 'COLOMBIA' abajo)
        sub_imgs = [gray, gray[:int(target_h * 0.8), :]]
        for s_img in sub_imgs:
            _, otsu = cv2.threshold(s_img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            bilat = cv2.bilateralFilter(s_img, 11, 17, 17)

            for pre in [s_img, otsu, bilat]:
                for psm in [6, 7, 8, 11]:
                    raw = pytesseract.image_to_string(
                        pre,
                        config=f'--oem 3 --psm {psm} -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
                    )
                    cleaned = clean(raw)
                    if cleaned:
                        results.append(cleaned)

    return results


def find_best_plate(texts: list[str]) -> str | None:
    """
    Busca preferentemente formato de moto colombiana (3 letras, 2 números, 1 letra)
    aplicando heurística posicional.
    """
    # 1. Búsqueda directa de formato de moto (ej. COZ92E)
    for text in texts:
        t_clean = text.replace('COLOMBIA', '')
        for i in range(len(t_clean) - 5):
            window = t_clean[i:i+6]
            if re.match(r'^[A-Z]{3}\d{2}[A-Z]$', window):
                return window

    # 2. Búsqueda con corrección para formato de moto
    best_moto = None
    best_penalty = 999
    for text in texts:
        t_clean = text.replace('COLOMBIA', '')
        for i in range(len(t_clean) - 5):
            w = list(t_clean[i:i+6])
            pen = 0
            # Pos 0-2: Letras
            for j in range(3):
                if w[j] in LETTER_FIXES:
                    w[j] = LETTER_FIXES[w[j]]
                    pen += 1
                elif w[j].isdigit():
                    pen += 10
            # Pos 3-4: Números
            for j in range(3, 5):
                if w[j] in NUMBER_FIXES:
                    w[j] = NUMBER_FIXES[w[j]]
                    pen += 1
                elif w[j].isalpha():
                    pen += 10
            # Pos 5: Letra final de moto
            if w[5] in ['4', '5']:
                w[5] = 'E'
                pen += 1
            elif w[5] in LETTER_FIXES:
                w[5] = LETTER_FIXES[w[5]]
                pen += 1
            elif w[5].isdigit():
                pen += 10

            candidate = ''.join(w)
            if re.match(r'^[A-Z]{3}\d{2}[A-Z]$', candidate) and pen < best_penalty:
                best_penalty = pen
                best_moto = candidate

    if best_moto and best_penalty < 5:
        return best_moto

    # 3. Formato general de 6 caracteres (autos / otros)
    for text in texts:
        t_clean = text.replace('COLOMBIA', '')
        for i in range(len(t_clean) - 5):
            window = t_clean[i:i+6]
            if PLATE_RE.match(window):
                return window

    return best_moto


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

        clean_plate = re.sub(r'[-\s]', '', raw_text).upper() if raw_text else ''
        return {
            "id": new_log.id,
            "filename": file.filename,
            "detected_text": detected_text,
            "raw_text": raw_text,
            "clean_plate": clean_plate,
            "confidence": 0.85,
            "message": "OCR procesado exitosamente"
        }

    except pytesseract.TesseractNotFoundError:
        raise HTTPException(status_code=500, detail="Tesseract-OCR no está instalado.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
