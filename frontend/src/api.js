const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function login(phone, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function getMe(token) {
  const res = await fetch(`${API_BASE}/api/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Auth failed');
  return res.json();
}

export async function syncData(token) {
  const res = await fetch(`${API_BASE}/api/sync`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Sync failed');
  return res.json();
}
