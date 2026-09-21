const API_URL = 'http://127.0.0.1:8000/api';

async function fetchAPI(endpoint, options = {}) {
  let response;
  try {
    const token = localStorage.getItem('token');
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  } catch (err) {
    throw new Error('No se pudo conectar con el backend (http://127.0.0.1:8000). Asegúrate de iniciar el servidor con `python main.py`.');
  }

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
    return;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let detailMessage = `Error ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) {
        detailMessage = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch (e) {
      if (errorText) detailMessage = errorText;
    }
    throw new Error(detailMessage);
  }

  // Try parsing JSON if content exists
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return await response.json();
  }
  return await response.text();
}

export async function getVehicles() {
  return await fetchAPI('/vehicles/');
}

export async function getVehicleByPlate(plate) {
  return await fetchAPI(`/vehicles/${plate}`);
}

export async function createVehicle(data) {
  return await fetchAPI('/vehicles/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteVehicle(plate) {
  return await fetchAPI(`/vehicles/${plate}`, {
    method: 'DELETE',
  });
}

export async function getMaintenances() {
  return await fetchAPI('/maintenance/');
}

export async function createMaintenance(data) {
  return await fetchAPI('/maintenance/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteMaintenance(id) {
  return await fetchAPI(`/maintenance/${id}`, {
    method: 'DELETE',
  });
}

export async function getDashboardSummary() {
  return await fetchAPI('/reports/summary');
}

export async function loginUser(username, password) {
  return await fetchAPI('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function analyzePlate(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/ocr/analyze-plate`, {
    method: 'POST',
    body: formData,
    headers,
    // Do not set Content-Type header manually when sending FormData,
    // the browser will automatically set it with the correct boundary.
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error ${response.status}: ${errorText}`);
  }

  return await response.json();
}
