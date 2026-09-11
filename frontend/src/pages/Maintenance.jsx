import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, CheckCircle, Clock, X } from 'lucide-react';
import { getMaintenances, createMaintenance } from '../api.js';
import './Maintenance.css';

const Maintenance = () => {
  const location = useLocation();
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal and Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formData, setFormData] = useState({
    plate: '',
    desc: '',
    cost: '',
    status: 'pendiente',
    date: ''
  });

  const loadMaintenances = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getMaintenances();
      setMaintenances(data);
    } catch (error) {
      console.error('Error fetching maintenances:', error);
      setError(error.message || 'Error al cargar registros de mantenimiento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaintenances();
  }, []);

  // Effect to handle incoming plate from OCR Module
  useEffect(() => {
    if (location.state && location.state.prefilledPlate) {
      setFormData(prev => ({ ...prev, plate: location.state.prefilledPlate }));
      setIsModalOpen(true);
      
      // Clear the state so it doesn't reopen if the user refreshes the page
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

  const handleClose = () => {
    setModalError('');
    setIsModalOpen(false);
    setFormData({ plate: '', desc: '', cost: '', status: 'pendiente', date: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setIsSubmitting(true);
    try {
      const apiData = {
        plate: formData.plate.trim(),
        description: formData.desc.trim(),
        scheduled_date: formData.date,
        status: formData.status,
        cost: formData.cost ? parseFloat(formData.cost) : null
      };
      
      await createMaintenance(apiData);
      
      handleClose();
      await loadMaintenances();
    } catch (error) {
      console.error('Error creating maintenance:', error);
      setModalError(error.message || 'No se pudo crear el registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completado':
        return <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16}/> Completado</span>;
      case 'en_progreso':
        return <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={16}/> En Progreso</span>;
      default:
        return <span style={{ color: 'var(--text-muted)' }}>Pendiente</span>;
    }
  };

  const formatCost = (cost) => {
    if (cost == null) return 'Pendiente';
    return `$${parseFloat(cost).toLocaleString('es-CO')} COP`;
  };

  return (
    <div className="animate-fade-in container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Mantenimientos</h1>
          <p className="text-muted">Registro y seguimiento de servicios.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenModal}>
          <Plus size={20} />
          Nuevo Registro
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
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
            <p>Cargando mantenimientos...</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Descripción</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Costo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {maintenances.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay registros de mantenimiento.
                    </td>
                  </tr>
                ) : (
                  maintenances.map(m => (
                    <tr key={m.id}>
                      <td><strong>{m.plate}</strong></td>
                      <td>{m.description}</td>
                      <td>{m.scheduled_date || '-'}</td>
                      <td>{getStatusBadge(m.status)}</td>
                      <td>{formatCost(m.cost)}</td>
                      <td>
                        <button className="btn-action">Detalles</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New Maintenance Record Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div className="modal-header">
              <h2>Nuevo Registro de Mantenimiento</h2>
              <button className="btn-close" onClick={handleClose}>
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
                <label>Placa del Vehículo *</label>
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
                <label>Descripción del Servicio *</label>
                <textarea
                  name="desc"
                  value={formData.desc}
                  onChange={handleInputChange}
                  required
                  placeholder="Ej. Cambio de aceite, revisión de frenos, ajuste de cadena..."
                  className="input-field maintenance-textarea"
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="input-field"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha Programada *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="input-field"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Costo (COP)</label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleInputChange}
                  placeholder="Ej. 45000 — Dejar vacío si está pendiente"
                  className="input-field"
                  min="0"
                  step="0.01"
                />
                <span className="field-hint">Dejar en blanco si el costo aún no está definido.</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-danger" onClick={handleClose} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
