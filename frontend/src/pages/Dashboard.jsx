import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Bike, Wrench, PlusCircle, Camera, ArrowRight } from 'lucide-react';
import { getDashboardSummary } from '../api.js';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    total_vehicles: 0,
    total_maintenance_records: 0,
    active_maintenances: 0,
    total_revenue: 0,
    recent_activity: []
  });

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await getDashboardSummary();
        if (data && typeof data === 'object') {
          setSummary({
            total_vehicles: data.total_vehicles ?? 0,
            total_maintenance_records: data.total_maintenance_records ?? 0,
            active_maintenances: data.active_maintenances ?? 0,
            total_revenue: data.total_revenue ?? 0,
            recent_activity: Array.isArray(data.recent_activity) ? data.recent_activity : []
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard summary:', error);
      }
    };
    fetchSummary();
  }, []);

  // Helper to format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', { 
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="animate-fade-in container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Panel de Control</h1>
          <p className="text-muted">Resumen del sistema de mantenimiento.</p>
        </div>

        {/* Quick Action Buttons in Header */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn-primary" 
            onClick={() => navigate('/vehiculos')}
            style={{ fontSize: '0.875rem' }}
          >
            <Bike size={18} />
            Ver Vehículos
          </button>
          <button 
            className="btn-primary" 
            onClick={() => navigate('/mantenimientos')}
            style={{ fontSize: '0.875rem' }}
          >
            <Wrench size={18} />
            Mantenimientos
          </button>
          <button 
            className="btn-primary" 
            onClick={() => navigate('/ocr')}
            style={{ fontSize: '0.875rem', backgroundColor: '#8b5cf6' }}
          >
            <Camera size={18} />
            Escanear Placa
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div 
          className="stat-card glass-panel" 
          onClick={() => navigate('/vehiculos')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
          title="Ver todos los vehículos"
        >
          <div className="stat-icon bg-primary-light">
            <Bike className="text-primary" size={24} />
          </div>
          <div className="stat-info">
            <h3>Vehículos Registrados</h3>
            <p className="stat-value">{summary?.total_vehicles ?? 0}</p>
          </div>
        </div>

        <div 
          className="stat-card glass-panel"
          onClick={() => navigate('/mantenimientos')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
          title="Ver mantenimientos activos"
        >
          <div className="stat-icon bg-warning-light">
            <Wrench className="text-warning" size={24} />
          </div>
          <div className="stat-info">
            <h3>En Mantenimiento</h3>
            <p className="stat-value">{summary?.active_maintenances ?? 0}</p>
          </div>
        </div>

        <div 
          className="stat-card glass-panel"
          onClick={() => navigate('/mantenimientos')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
          title="Ver todos los mantenimientos"
        >
          <div className="stat-icon bg-success-light">
            <Activity className="text-success" size={24} />
          </div>
          <div className="stat-info">
            <h3>Completados (Mes)</h3>
            <p className="stat-value">{summary?.total_maintenance_records ?? 0}</p>
          </div>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="glass-panel recent-activity">
          <h2>Actividad Reciente</h2>
          <ul className="activity-list">
            {summary.recent_activity && summary.recent_activity.length > 0 ? (
              summary.recent_activity.map(activity => (
                <li key={activity.id}>
                  <div className={`activity-indicator ${activity.type === 'completed' ? 'bg-success' : 'bg-warning'}`}></div>
                  <div className="activity-details">
                    <p>{activity.description} - Moto <strong>{activity.plate}</strong></p>
                    <span>{formatDate(activity.created_at)}</span>
                  </div>
                </li>
              ))
            ) : (
              <p className="text-muted" style={{ padding: '1rem' }}>No hay actividad reciente.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
