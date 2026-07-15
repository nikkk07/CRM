export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

import { API_URL } from '../api';

export async function login(phone, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
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
