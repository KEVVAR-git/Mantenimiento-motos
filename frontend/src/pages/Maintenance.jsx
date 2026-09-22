import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, CheckCircle, Clock, X, Search, Trash2, Edit, AlertCircle, Calendar, DollarSign, Tag } from 'lucide-react';
import { getMaintenances, createMaintenance, updateMaintenance, deleteMaintenance } from '../api.js';
import './Maintenance.css';

const Maintenance = () => {
  const location = useLocation();
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // New record modal states
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

  // Details & Edit modal states
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [editRecord, setEditRecord] = useState(null);

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
    if (name === 'plate') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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

    const cleanPlate = formData.plate.replace(/[-\s]/g, '').toUpperCase();
    if (!cleanPlate) {
      setModalError('La placa es obligatoria.');
      return;
    }

    if (formData.cost !== '' && parseFloat(formData.cost) < 0) {
      setModalError('El costo no puede ser un número negativo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiData = {
        plate: cleanPlate,
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

  const handleOpenDetail = (record) => {
    setDetailError('');
    setEditRecord({
      id: record.id,
      plate: record.plate,
      description: record.description,
      status: record.status,
      cost: record.cost != null ? record.cost : '',
      scheduled_date: record.scheduled_date ? record.scheduled_date.split('T')[0] : ''
    });
    setIsDetailOpen(true);
  };

  const handleSaveDetail = async (e) => {
    if (e) e.preventDefault();
    if (!editRecord) return;
    setDetailError('');

    if (editRecord.cost !== '' && parseFloat(editRecord.cost) < 0) {
      setDetailError('El costo no puede ser un número negativo.');
      return;
    }

    setIsUpdating(true);
    try {
      await updateMaintenance(editRecord.id, {
        description: editRecord.description.trim(),
        status: editRecord.status,
        cost: editRecord.cost !== '' ? parseFloat(editRecord.cost) : null,
        scheduled_date: editRecord.scheduled_date || null
      });
      setIsDetailOpen(false);
      await loadMaintenances();
    } catch (err) {
      console.error('Error updating maintenance:', err);
      setDetailError(err.message || 'No se pudo actualizar el registro.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickStatus = async (newStatus) => {
    if (!editRecord) return;
    setIsUpdating(true);
    setDetailError('');
    try {
      await updateMaintenance(editRecord.id, {
        status: newStatus
      });
      setEditRecord(prev => ({ ...prev, status: newStatus }));
      await loadMaintenances();
    } catch (err) {
      setDetailError(err.message || 'Error al cambiar estado.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este registro de mantenimiento?')) {
      return;
    }
    try {
      await deleteMaintenance(id);
      if (isDetailOpen && editRecord && editRecord.id === id) {
        setIsDetailOpen(false);
      }
      await loadMaintenances();
    } catch (err) {
      alert(err.message || 'Error al eliminar el registro.');
    }
  };

  const filteredMaintenances = maintenances.filter(m => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (m.plate && m.plate.toLowerCase().includes(q)) ||
                          (m.description && m.description.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'todos' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-bar" style={{ flex: '1', minWidth: '240px', maxWidth: '400px' }}>
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Buscar por placa o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'pendiente', label: 'Pendientes' },
              { id: 'en_progreso', label: 'En Progreso' },
              { id: 'completado', label: 'Completados' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  border: statusFilter === f.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: statusFilter === f.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: statusFilter === f.id ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
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
                {filteredMaintenances.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      {searchTerm || statusFilter !== 'todos' ? 'No se encontraron registros con los filtros aplicados.' : 'No hay registros de mantenimiento.'}
                    </td>
                  </tr>
                ) : (
                  filteredMaintenances.map(m => (
                    <tr key={m.id}>
                      <td><strong>{m.plate}</strong></td>
                      <td>{m.description}</td>
                      <td>{m.scheduled_date ? m.scheduled_date.split('T')[0] : '-'}</td>
                      <td>{getStatusBadge(m.status)}</td>
                      <td>{formatCost(m.cost)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button className="btn-action" onClick={() => handleOpenDetail(m)}>
                            Detalles
                          </button>
                          <button 
                            className="btn-action"
                            style={{ 
                              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                              color: '#f87171', 
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              padding: '0.35rem 0.5rem'
                            }}
                            onClick={() => handleDeleteRecord(m.id)}
                            title="Eliminar registro"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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

      {/* Details & Edit Maintenance Modal */}
      {isDetailOpen && editRecord && (
        <div className="modal-overlay" onClick={() => setIsDetailOpen(false)}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '600px', width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Detalles del Mantenimiento</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Placa: <strong>{editRecord.plate}</strong>
                </p>
              </div>
              <button className="btn-close" onClick={() => setIsDetailOpen(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveDetail} className="modal-form">
              {detailError && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--danger, #ef4444)',
                  color: '#f87171',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  marginBottom: '1rem'
                }}>
                  {detailError}
                </div>
              )}

              <div className="form-group">
                <label>Descripción del Servicio</label>
                <textarea
                  value={editRecord.description}
                  onChange={(e) => setEditRecord(prev => ({ ...prev, description: e.target.value }))}
                  required
                  rows={3}
                  className="input-field maintenance-textarea"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estado del Servicio</label>
                  <select
                    value={editRecord.status}
                    onChange={(e) => setEditRecord(prev => ({ ...prev, status: e.target.value }))}
                    className="input-field"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha Programada</label>
                  <input
                    type="date"
                    value={editRecord.scheduled_date}
                    onChange={(e) => setEditRecord(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Costo del Servicio (COP)</label>
                <input
                  type="number"
                  value={editRecord.cost}
                  onChange={(e) => setEditRecord(prev => ({ ...prev, cost: e.target.value }))}
                  placeholder="Ej. 65000"
                  className="input-field"
                  min="0"
                  step="0.01"
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '0.5rem',
                margin: '1rem 0',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>Cambio rápido:</span>
                <button
                  type="button"
                  className="btn-action"
                  disabled={isUpdating || editRecord.status === 'pendiente'}
                  onClick={() => handleQuickStatus('pendiente')}
                  style={{ fontSize: '0.75rem' }}
                >
                  🟡 Pendiente
                </button>
                <button
                  type="button"
                  className="btn-action"
                  disabled={isUpdating || editRecord.status === 'en_progreso'}
                  onClick={() => handleQuickStatus('en_progreso')}
                  style={{ fontSize: '0.75rem' }}
                >
                  🔵 En Progreso
                </button>
                <button
                  type="button"
                  className="btn-action"
                  disabled={isUpdating || editRecord.status === 'completado'}
                  onClick={() => handleQuickStatus('completado')}
                  style={{ fontSize: '0.75rem' }}
                >
                  🟢 Completado
                </button>
              </div>

              <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="btn-action"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={() => handleDeleteRecord(editRecord.id)}
                  disabled={isUpdating}
                >
                  <Trash2 size={16} style={{ marginRight: '4px' }} />
                  Eliminar
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn-danger" onClick={() => setIsDetailOpen(false)} disabled={isUpdating}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={isUpdating}>
                    {isUpdating ? 'Actualizando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
