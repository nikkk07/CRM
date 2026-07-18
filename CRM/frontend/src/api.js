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
  if (!res.ok) {
    // Carry the HTTP status so callers can distinguish a server error from an unreachable server
    const err = new Error(`Sync failed (HTTP ${res.status})`);
    err.status = res.status;
    try { err.detail = (await res.json()).detail; } catch { /* non-JSON body */ }
    throw err;
  }
  return res.json();
}
