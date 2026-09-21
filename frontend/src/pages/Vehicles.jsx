import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, X, ClipboardList } from 'lucide-react';
import { getVehicles, createVehicle } from '../api.js';
import './Vehicles.css';

const API_URL = 'http://127.0.0.1:8000/api';

const Vehicles = () => {
  const location = useLocation();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal and Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formData, setFormData] = useState({
    plate: '',
    owner: '',
    phone: '',
    brand: '',
    model: '',
    year: ''
  });

  // History modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleViewHistory = async (vehicle) => {
    setHistoryVehicle(vehicle);
    setHistoryRecords([]);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/maintenance/${vehicle.plate}`);
      if (!res.ok) throw new Error('No se pudo cargar el historial.');
      const data = await res.json();
      setHistoryRecords(data);
    } catch (err) {
      console.error(err);
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getVehicles();
      setVehicles(data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setError(error.message || 'Error al cargar los vehículos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // Check if OCR redirected here because the vehicle doesn't exist
  useEffect(() => {
    if (location.state && location.state.requireRegistration) {
      setFormData(prev => ({ ...prev, plate: location.state.prefilledPlate }));
      setModalError(`El vehículo con placa ${location.state.prefilledPlate} no existe en la base de datos. Por favor, regístralo primero.`);
      setIsModalOpen(true);
      
      // Clear state to avoid infinite reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenModal = () => {
    setModalError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalError('');
    setIsModalOpen(false);
    setFormData({ plate: '', owner: '', phone: '', brand: '', model: '', year: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setIsSubmitting(true);
    try {
      const apiData = {
        plate: formData.plate.trim(),
        owner_name: formData.owner.trim(),
        owner_phone: formData.phone ? formData.phone.trim() : null,
        brand: formData.brand ? formData.brand.trim() : null,
        model: formData.model ? formData.model.trim() : null,
        year: formData.year ? parseInt(formData.year) : new Date().getFullYear()
      };
      await createVehicle(apiData);
      handleCloseModal();
      await loadVehicles();
    } catch (error) {
      console.error('Error creating vehicle:', error);
      setModalError(error.message || 'No se pudo registrar el vehículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Vehículos</h1>
          <p className="text-muted">Gestión de motocicletas registradas.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenModal}>
          <Plus size={20} />
          Registrar Vehículo
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div className="search-bar">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Buscar por placa o propietario..."
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger, #ef4444)',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <div className="table-container">
          {loading ? (
            <p>Cargando vehículos...</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Propietario</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Año</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay vehículos registrados.
                    </td>
                  </tr>
                ) : (
                  vehicles.map(v => (
                    <tr key={v.id}>
                      <td><strong>{v.plate}</strong></td>
                      <td>{v.owner_name}</td>
                      <td>{v.brand || '-'}</td>
                      <td>{v.model || '-'}</td>
                      <td>{v.year || '-'}</td>
                      <td>
                        <button className="btn-action" onClick={() => handleViewHistory(v)}>
                          <ClipboardList size={14} style={{ marginRight: '4px' }} />
                          Ver Historial
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div className="modal-header">
              <h2>Registrar Nuevo Vehículo</h2>
              <button className="btn-close" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              {modalError && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--danger, #ef4444)',
                  color: '#f87171',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  marginBottom: '1rem'
                }}>
                  {modalError}
                </div>
              )}

              <div className="form-group">
                <label>Placa *</label>
                <input 
                  type="text" 
                  name="plate" 
                  value={formData.plate} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Ej. XYZ-123"
                  className="input-field"
                />
              </div>
              <div className="form-group">
                <label>Propietario *</label>
                <input 
                  type="text" 
                  name="owner" 
                  value={formData.owner} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Nombre completo"
                  className="input-field"
                />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  placeholder="Número de contacto"
                  className="input-field"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Marca</label>
                  <input 
                    type="text" 
                    name="brand" 
                    value={formData.brand} 
                    onChange={handleInputChange} 
                    placeholder="Ej. Yamaha"
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label>Modelo</label>
                  <input 
                    type="text" 
                    name="model" 
                    value={formData.model} 
                    onChange={handleInputChange} 
                    placeholder="Ej. MT-09"
                    className="input-field"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Año</label>
                <input 
                  type="number" 
                  name="year" 
                  value={formData.year} 
                  onChange={handleInputChange} 
                  placeholder="Ej. 2023"
                  className="input-field"
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-danger" onClick={handleCloseModal} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Vehículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryOpen(false)}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '700px', width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Historial de Mantenimiento</h2>
                {historyVehicle && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {historyVehicle.plate} — {historyVehicle.owner_name} ({historyVehicle.brand || 'Sin marca'} {historyVehicle.model || ''})
                  </p>
                )}
              </div>
              <button className="btn-close" onClick={() => setIsHistoryOpen(false)}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '1rem 0', maxHeight: '60vh', overflowY: 'auto' }}>
              {historyLoading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando historial...</p>
              ) : historyRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <ClipboardList size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <p>Este vehículo no tiene registros de mantenimiento.</p>
                </div>
              ) : (
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th>Costo</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map(r => {
                      const statusColors = {
                        pendiente:    { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
                        en_progreso:  { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
                        completado:   { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
                      };
                      const sc = statusColors[r.status] || { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af' };
                      return (
                        <tr key={r.id}>
                          <td>{r.description}</td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              backgroundColor: sc.bg,
                              color: sc.color
                            }}>
                              {r.status === 'en_progreso' ? 'En Progreso' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                            </span>
                          </td>
                          <td>
                            {r.cost != null
                              ? `$${Number(r.cost).toLocaleString('es-CO')} COP`
                              : '-'}
                          </td>
                          <td>{r.scheduled_date ? r.scheduled_date.split('T')[0] : (r.created_at ? r.created_at.split('T')[0] : '-')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setIsHistoryOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
