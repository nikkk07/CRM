import { useState } from 'react';
import { API_URL } from '../api';

export default function StudentLogin({ onLogin, onBack }) {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the backend's real message (wrong PIN, PIN not set, rate limited, …).
        setError(data.detail || `Login failed (${res.status})`);
        return;
      }
      // Store the student session under its OWN keys so it never collides with staff.
      localStorage.setItem('student_token', data.access_token);
      localStorage.setItem('student', JSON.stringify(data.student));
      onLogin(data.student);
    } catch (err) {
      setError('Could not reach the server. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0d1b3e] via-[#1d306b] to-[#2a4290]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-4xl text-center mb-3">🎓</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1 text-center tracking-tight">
          Student Portal
        </h1>
        <p className="text-sm text-slate-500 mb-7 text-center">We One Aviation · Sign in to continue</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number</label>
            <input
              type="tel"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent tracking-widest"
              placeholder="10-digit mobile number"
              maxLength={10}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent tracking-widest"
              placeholder="4-digit PIN"
              maxLength={4}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-400"
          >
            {loading ? 'Signing in… (server may take up to a minute to wake)' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200 text-center">
          <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900">
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
