import { useState, useEffect } from 'react';
import { formatDate } from '../utils/formatters';
import LoadingSpinner from './LoadingSpinner';
import { API_URL } from '../api';

export default function MyProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const employee = JSON.parse(localStorage.getItem('employee'));
      
      const res = await fetch(`${API_URL}/api/employees/${employee.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwordForm.new_password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          old_password: passwordForm.old_password,
          new_password: passwordForm.new_password
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        setPasswordError(error.detail || 'Failed to change password');
        return;
      }
      
      alert('Password changed successfully! Please login again.');
      localStorage.removeItem('token');
      localStorage.removeItem('employee');
      window.location.reload();
    } catch (error) {
      setPasswordError('Failed to change password');
    }
  };

  if (loading) return <LoadingSpinner size="lg" text="Loading profile..." />;
  if (!profile) return <div className="text-center py-12 text-gray-500">Profile not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-blue-500 text-white flex items-center justify-center text-3xl font-bold shadow-lg">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{profile.name}</h1>
              <p className="text-lg text-gray-600 mt-1">{profile.job_role || 'Employee'}</p>
              <p className="text-sm text-gray-500 mt-2">Employee ID: {profile.employee_id || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Personal Information</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Contact Number</span>
                  <div className="font-medium text-gray-900">{profile.phone}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Email Address</span>
                  <div className="font-medium text-gray-900">{profile.email || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Address</span>
                  <div className="font-medium text-gray-900">{profile.address || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Employment Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Date of Joining</span>
                  <div className="font-medium text-gray-900">
                    {profile.joining_date ? formatDate(profile.joining_date) : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Status</span>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      profile.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.status === 'active' ? 'Active' : 'Non-Active'}
                    </span>
                  </div>
                </div>
                {profile.status === 'non-active' && profile.date_of_leaving && (
                  <div>
                    <span className="text-sm text-gray-600">Date of Leaving</span>
                    <div className="font-medium text-gray-900">{formatDate(profile.date_of_leaving)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Leave Summary */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Leave Summary</h3>
            
            {/* Paid Leave Quota - MONTHLY */}
            {profile.paid_leave_quota > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-blue-900">Monthly Paid Leave Quota</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {profile.paid_leave_remaining || 0} / {profile.paid_leave_quota}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${((profile.paid_leave_remaining || 0) / profile.paid_leave_quota) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Used: {profile.paid_leave_used || 0} | Remaining: {profile.paid_leave_remaining || 0}
                  {profile.paid_leave_remaining === 0 && (
                    <span className="font-bold text-red-600"> - No More Paid Leaves Available This Month</span>
                  )}
                </p>
              </div>
            )}
            
            {/* Current Month Summary with Salary Deduction */}
            <h4 className="text-sm font-medium text-gray-700 mb-3">Current Month</h4>
            <div className="flex gap-6 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-red-200"></span>
                <span className="text-sm">Leave: {profile.leave_counts?.leave || 0} days</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-yellow-200"></span>
                <span className="text-sm">Half Day: {profile.leave_counts?.half_day || 0} days</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-200"></span>
                <span className="text-sm">Paid Leave: {profile.leave_counts?.paid_leave || 0} days</span>
              </div>
            </div>
            
            {/* Salary Breakdown */}
            {profile.monthly_salary && (
              <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <h5 className="text-sm font-bold text-green-900 mb-3">💰 Salary Breakdown</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Base Salary:</span>
                    <span className="font-semibold">₹{parseFloat(profile.monthly_salary).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Days in Month:</span>
                    <span className="font-medium">{profile.days_in_month || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Per Day Salary:</span>
                    <span className="font-medium">₹{profile.per_day_salary ? parseFloat(profile.per_day_salary).toLocaleString('en-IN') : '-'}</span>
                  </div>
                  <div className="border-t border-green-200 my-2"></div>
                  <div className="flex justify-between text-red-700">
                    <span className="font-medium">Deduction (Leave + Half Day):</span>
                    <span className="font-bold">- ₹{profile.deduction_amount ? parseFloat(profile.deduction_amount).toLocaleString('en-IN') : '0'}</span>
                  </div>
                  <div className="border-t-2 border-green-300 my-2"></div>
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-green-900">Net Salary:</span>
                    <span className="font-bold text-green-600">₹{profile.net_salary ? parseFloat(profile.net_salary).toLocaleString('en-IN') : '-'}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-green-200">
                  📋 Leave = Full day deducted | Half Day = 0.5 day deducted | Paid Leave = No deduction
                </p>
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-4">
              Use the "My Leave" tab to mark your leave days. Quota resets monthly.
            </p>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              ℹ️ This is a read-only view of your profile. Contact your admin for any changes.
            </p>
          </div>

          <div className="mt-6">
            <button
              onClick={() => setShowChangePassword(true)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              🔒 Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Change Password</h2>
            
            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {passwordError}
              </div>
            )}
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.old_password}
                  onChange={(e) => setPasswordForm({...passwordForm, old_password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                >
                  Change Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
                    setPasswordError('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
