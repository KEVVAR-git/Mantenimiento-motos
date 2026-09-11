import { useState } from 'react';
import { User, Lock, Bike } from 'lucide-react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: normalizedUsername, password: normalizedPassword }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        onLogin(true);
        return;
      }

      if (normalizedUsername === 'admin' && normalizedPassword === 'admin123') {
        localStorage.setItem('token', 'mock-token');
        onLogin(true);
        return;
      }

      setError('Credenciales incorrectas. Intenta con admin / admin123');
    } catch (err) {
      if (normalizedUsername === 'admin' && normalizedPassword === 'admin123') {
        localStorage.setItem('token', 'mock-token');
        onLogin(true);
      } else {
        setError('No se pudo conectar con el backend. Usa admin / admin123 o inicia el servidor en http://127.0.0.1:8000');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-glass-panel">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Bike size={40} />
          </div>
          <h1>MotoSys</h1>
          <p>Bienvenido al Sistema de Mantenimiento</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Usuario</label>
            <div className="input-wrapper">
              <input
                type="text"
                className="login-input"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <User size={20} />
            </div>
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <div className="input-wrapper">
              <input
                type="password"
                className="login-input"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={20} />
            </div>
          </div>

          <button 
            type="submit" 
            className={`btn-login ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? '' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
