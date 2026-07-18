import { useState } from 'react';
import { login } from '../api';

export default function Login({ onLogin, onSwitchToEmployee }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(loginId, password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('employee', JSON.stringify(data.employee));
      onLogin(data.employee);
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0d1b3e] via-[#1d306b] to-[#2a4290]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-4xl text-center mb-3">✈️</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1 text-center tracking-tight">
          We One Aviation
        </h1>
        <p className="text-sm text-slate-500 mb-7 text-center">CRM · Sign in to continue</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Login ID
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Your login ID"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
          <button
            onClick={onSwitchToEmployee}
            className="text-sm text-indigo-600 font-medium hover:underline"
          >
            Employee Login →
          </button>
        </div>
      </div>
    </div>
  );
}
