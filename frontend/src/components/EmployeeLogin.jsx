import { useState } from 'react';
import { showToast } from '../utils/toast';

export default function EmployeeLogin({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/auth/employee-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, pin })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('employee', JSON.stringify(data.employee));
        onLogin(data.employee);
        showToast(`Welcome, ${data.employee.name}!`, 'success');
      } else {
        const error = await res.json();
        showToast(error.detail || 'Login failed', 'error');
      }
    } catch (error) {
      showToast('Login error', 'error');
    }

    setLoading(false);
  };

  const handleBackToAdmin = () => {
    window.location.reload(); // Simple way to go back to admin login
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-white">👤</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Portal</h1>
          <p className="text-sm text-gray-600 mt-2">Sign in to access your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee ID / Mobile / Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter ID, phone, or email"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">Mobile: 10 digits without +91</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIN (if set)
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="4-digit PIN (optional)"
              maxLength={4}
              pattern="[0-9]*"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <button
            onClick={handleBackToAdmin}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Admin Login
          </button>
        </div>
      </div>
    </div>
  );
}
