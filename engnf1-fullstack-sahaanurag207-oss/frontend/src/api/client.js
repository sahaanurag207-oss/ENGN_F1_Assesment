const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('ts_token');
  const agentEmail = localStorage.getItem('ts_agent_email');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(agentEmail ? { 'X-Agent': agentEmail } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Request failed');
    err.code = data?.error?.code || 'UNKNOWN_ERROR';
    err.status = response.status;
    throw err;
  }
  return data;
}
