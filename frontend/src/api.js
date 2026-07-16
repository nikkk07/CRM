export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function login(login_id, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id, password })
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function syncData(token) {
  const res = await fetch(`${API_URL}/api/sync`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}
