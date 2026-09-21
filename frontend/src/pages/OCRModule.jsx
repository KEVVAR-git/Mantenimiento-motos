import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Camera, Check, RefreshCw, X } from 'lucide-react';
import { analyzePlate, getVehicleByPlate } from '../api.js';
import './OCRModule.css';

const OCRModule = () => {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState('');
  const [rawText, setRawText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [hasScanned, setHasScanned] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setResult('');
      setRawText('');
      setError('');
      setIsEditing(false);
      setHasScanned(false);
    }
  };

  const processImage = async () => {
    if (!imageFile || isProcessing) return;
    setIsProcessing(true);
    setHasScanned(true);
    setError('');
    setResult('');
    setRawText('');
    
    try {
      const data = await analyzePlate(imageFile);
      const finalPlate = data.detected_text || 'NO-DETECTADA';
      
      // Guardar el texto crudo para ayudar al usuario a corregir
      if (data.raw_text) setRawText(data.raw_text);
      
      // Efecto "máquina de escribir"
      let currentText = '';
      for (let i = 0; i < finalPlate.length; i++) {
        currentText += finalPlate.charAt(i);
        setResult(currentText);
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al procesar la imagen con OCR.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setResult('');
    setError('');
    setIsEditing(false);
    setHasScanned(false);
  };

  const handleProceed = async () => {
    try {
      setIsProcessing(true);
      // Intentar buscar la placa en la base de datos
      await getVehicleByPlate(result);
      
      // Si no hay error, la placa existe. Vamos a Mantenimientos para crear un servicio.
      navigate('/mantenimientos', { state: { prefilledPlate: result } });
    } catch (err) {
      // Si lanza error (ej. 404), el vehículo NO existe.
      // Redirigir a Vehículos para registrarlo primero.
      navigate('/vehiculos', { state: { prefilledPlate: result, requireRegistration: true } });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-fade-in container ocr-container">
      <div className="page-header">
        <h1 className="page-title">Reconocimiento OCR</h1>
        <p className="text-muted">Módulo opcional para lectura automática de placas.</p>
      </div>

      <div className="ocr-grid">
        <div className="glass-panel upload-section">
          {!imagePreview ? (
            <div className="upload-placeholder" onClick={() => fileInputRef.current.click()}>
              <Camera size={48} className="text-muted mb-4" />
              <h3>Cargar imagen de placa</h3>
              <p className="text-muted">Haz clic para seleccionar o arrastra una imagen aquí</p>
              <button className="btn-primary mt-4">
                <Upload size={20} />
                Seleccionar Imagen
              </button>
            </div>
          ) : (
            <div 
              className={`image-preview ${isProcessing ? 'scanning' : ''}`}
              onMouseEnter={() => {
                if (!hasScanned && !isProcessing && !result) {
                  processImage();
                }
              }}
            >
              <div className="scanner-laser"></div>
              <img src={imagePreview} alt="Placa" />
              <button className="btn-close" onClick={clearImage}>
                <X size={20} />
              </button>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
        </div>

        <div className="glass-panel result-section">
          <h2>Procesamiento</h2>
          
          <button 
            className="btn-primary w-100" 
            disabled={!imageFile || isProcessing}
            onClick={processImage}
          >
            {isProcessing ? (
              <><RefreshCw className="spin" size={20} /> Procesando...</>
            ) : (
              <><Camera size={20} /> Ejecutar OCR</>
            )}
          </button>

          {error && (
            <div className="mt-4" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              {error}
            </div>
          )}

          {(result || isEditing) && (
            <div className="result-card animate-fade-in mt-4">
              <h3>Resultado:</h3>
              {isEditing ? (
                <div className="edit-mode">
                  <input 
                    type="text" 
                    value={result} 
                    onChange={(e) => setResult(e.target.value.toUpperCase())}
                    className="input-field result-input"
                  />
                  <button className="btn-success" onClick={() => setIsEditing(false)}>
                    <Check size={20} /> Guardar
                  </button>
                </div>
              ) : (
                <div className="display-mode">
                  <div className="plate-display">{result}</div>
                  {rawText && (
                    <p className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.5rem', letterSpacing: '0.1em' }}>
                      Texto detectado: <strong>{rawText}</strong>
                    </p>
                  )}
                  <button className="btn-outline" onClick={() => setIsEditing(true)}>
                    Corregir Manualmente
                  </button>
                </div>
              )}
              
              {!isEditing && (
                <div className="action-buttons mt-4">
                  <button className="btn-primary w-100" onClick={handleProceed}>
                    <Check size={20} /> Proceder con Placa
                  </button>
                </div>
              )}
            </div>
          )}
          
          {!result && !isProcessing && imagePreview && !error && (
            <p className="text-muted text-center mt-4">Haz clic en "Ejecutar OCR" para extraer el texto.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRModule;
