import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bike, Wrench, Camera, LogOut } from 'lucide-react';

const Sidebar = () => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Bike size={32} />
        <span>MotoSys</span>
      </div>
      <nav className="nav-links">
        <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/vehiculos" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <Bike size={20} />
          <span>Vehículos</span>
        </NavLink>
        <NavLink to="/mantenimientos" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <Wrench size={20} />
          <span>Mantenimiento</span>
        </NavLink>
        <NavLink to="/ocr" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <Camera size={20} />
          <span>Lector OCR</span>
        </NavLink>
      </nav>
      
      <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <button onClick={handleLogout} className="nav-item" style={{ width: '100%', color: 'var(--danger)' }}>
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
