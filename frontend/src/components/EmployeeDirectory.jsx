import { useState, useEffect } from 'react';
import { formatDate, formatPhone } from '../utils/formatters';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import { showToast } from '../utils/toast';
import { API_URL } from '../api';

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      showToast('Failed to load employees', 'error');
    }
    setLoading(false);
  };

  const loadEmployeeDetail = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/employees/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSelectedEmployee(data);
    } catch (error) {
      showToast('Failed to load employee details', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = formData.id 
        ? `${API_URL}/api/employees/${formData.id}`
        : `${API_URL}/api/employees`;
      
      await fetch(url, {
        method: formData.id ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      showToast(formData.id ? 'Employee updated' : 'Employee created', 'success');
      setShowForm(false);
      setFormData({});
      loadEmployees();
    } catch (error) {
      showToast('Failed to save employee', 'error');
    }
  };

  const markLeaveDay = async (date, type) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/employees/${selectedEmployee.id}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leave_date: date, leave_type: type })
      });
      
      if (!res.ok) {
        const error = await res.json();
        showToast(error.detail || 'Failed to mark leave', 'error');
        return;
      }
      
      showToast('Leave marked', 'success');
      loadEmployeeDetail(selectedEmployee.id);
    } catch (error) {
      showToast('Failed to mark leave', 'error');
    }
  };

  const unmarkLeaveDay = async (date) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/employees/${selectedEmployee.id}/leave/${date}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showToast('Leave unmarked', 'success');
      loadEmployeeDetail(selectedEmployee.id);
    } catch (error) {
      showToast('Failed to unmark leave', 'error');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return emp.name.toLowerCase().includes(query) ||
             (emp.employee_id && emp.employee_id.toLowerCase().includes(query)) ||
             (emp.job_role && emp.job_role.toLowerCase().includes(query));
    }
    return true;
  });

  const STATUS_COLORS = {
    active: 'bg-green-100 text-green-800',
    'non-active': 'bg-gray-100 text-gray-800'
  };

  const LEAVE_TYPE_COLORS = {
    leave: 'bg-red-100 text-red-800',
    half_day: 'bg-yellow-100 text-yellow-800',
    paid_leave: 'bg-blue-100 text-blue-800'
  };

  const LEAVE_TYPE_LABELS = {
    leave: 'Leave',
    half_day: 'Half Day',
    paid_leave: 'Paid Leave'
  };

  // Generate calendar for current month
  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const getDayLeaveType = (day) => {
    if (!day || !selectedEmployee) return null;
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const leaveDay = selectedEmployee.leave_days?.find(ld => ld.date === dateStr);
    return leaveDay?.type || null;
  };

  if (loading) return <LoadingSpinner size="lg" text="Loading employees..." />;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Employee Directory</h2>
        <button
          onClick={() => { setFormData({}); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="🔍 Search by name, ID, role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="non-active">Non-Active</option>
        </select>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600 mb-3">
        Showing {filteredEmployees.length} of {employees.length} employees
      </div>

      {/* Employee Table */}
      {filteredEmployees.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No employees found"
          description={searchQuery ? "Try adjusting your search or filters" : "Click 'Add Employee' to get started"}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date of Joining</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm text-gray-900">{emp.employee_id || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-sm">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="font-medium text-gray-900">{emp.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{emp.job_role || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {emp.joining_date ? formatDate(emp.joining_date) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[emp.status] || 'bg-gray-100 text-gray-800'}`}>
                      {emp.status === 'active' ? 'Active' : 'Non-Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => loadEmployeeDetail(emp.id)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
                  {selectedEmployee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedEmployee.name}</h2>
                  <p className="text-gray-600">{selectedEmployee.job_role || 'Employee'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Employee Fields - Sequential Order */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Employee ID</label>
                  <div className="mt-1 text-gray-900 font-medium">{selectedEmployee.employee_id || '-'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Employee Name</label>
                  <div className="mt-1 text-gray-900 font-medium">{selectedEmployee.name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Joining</label>
                  <div className="mt-1 text-gray-900 font-medium">
                    {selectedEmployee.joining_date ? formatDate(selectedEmployee.joining_date) : '-'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[selectedEmployee.status]}`}>
                      {selectedEmployee.status === 'active' ? 'Active' : 'Non-Active'}
                    </span>
                  </div>
                </div>
                {selectedEmployee.status === 'non-active' && selectedEmployee.date_of_leaving && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date of Leaving</label>
                    <div className="mt-1 text-gray-900 font-medium">{formatDate(selectedEmployee.date_of_leaving)}</div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Monthly Salary</label>
                  <div className="mt-1 text-gray-900 font-medium">
                    {selectedEmployee.monthly_salary ? `₹${parseFloat(selectedEmployee.monthly_salary).toLocaleString('en-IN')}` : '-'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Paid Leave Quota (Monthly)</label>
                  <div className="mt-1 text-gray-900 font-medium">
                    {selectedEmployee.paid_leave_quota || 0} days/month
                    {selectedEmployee.paid_leave_quota > 0 && (
                      <span className="ml-2 text-sm text-blue-600">
                        (This month: {selectedEmployee.paid_leave_used || 0} used, {selectedEmployee.paid_leave_remaining || 0} left)
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Department</label>
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedEmployee.department === 'Admin' ? 'bg-purple-100 text-purple-800' :
                      selectedEmployee.department === 'Sales' ? 'bg-blue-100 text-blue-800' :
                      selectedEmployee.department === 'IT' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedEmployee.department}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Contact Number</label>
                  <div className="mt-1 text-gray-900 font-medium">{formatPhone(selectedEmployee.phone)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email Address</label>
                  <div className="mt-1 text-gray-900 font-medium">{selectedEmployee.email || '-'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Job Role</label>
                  <div className="mt-1 text-gray-900 font-medium">{selectedEmployee.job_role || '-'}</div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <div className="mt-1 text-gray-900 font-medium">{selectedEmployee.address || '-'}</div>
                </div>
              </div>

              {/* Leave Section - Admin Only */}
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Leave Calendar</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      ←
                    </button>
                    <span className="px-3 py-1 font-medium">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* Monthly Tally */}
                <div className="flex gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-red-200"></span>
                    <span>Leave: {selectedEmployee.leave_counts?.leave || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-yellow-200"></span>
                    <span>Half Day: {selectedEmployee.leave_counts?.half_day || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-blue-200"></span>
                    <span>Paid Leave: {selectedEmployee.leave_counts?.paid_leave || 0}</span>
                  </div>
                </div>

                {/* Paid Leave Quota Info for Admin - MONTHLY */}
                {selectedEmployee.paid_leave_quota > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-blue-900">Paid Leave Status (This Month)</span>
                      <span className="text-lg font-bold text-blue-600">
                        {selectedEmployee.paid_leave_remaining || 0} / {selectedEmployee.paid_leave_quota} remaining
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                      Used: {selectedEmployee.paid_leave_used || 0} days this month (resets monthly)
                    </p>
                  </div>
                )}

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                  {generateCalendar().map((day, idx) => {
                    if (!day) {
                      return <div key={idx} className="aspect-square"></div>;
                    }
                    const leaveType = getDayLeaveType(day);
                    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    
                    return (
                      <div key={idx} className="relative group">
                        <button
                          className={`w-full aspect-square border rounded flex items-center justify-center text-sm font-medium transition
                            ${leaveType ? LEAVE_TYPE_COLORS[leaveType].replace('text-', 'border-') : 'border-gray-200 hover:border-blue-400'}
                            ${leaveType ? 'font-bold' : ''}
                          `}
                          onClick={() => {
                            if (leaveType) {
                              unmarkLeaveDay(dateStr);
                            } else {
                              const paidLeaveQuota = selectedEmployee.paid_leave_quota || 0;
                              const paidLeaveRemaining = selectedEmployee.paid_leave_remaining || 0;
                              
                              let type = null;
                              if (paidLeaveQuota > 0) {
                                type = prompt(`Admin: Mark leave for ${selectedEmployee.name}:
1. Leave (Full day salary deducted)
2. Half Day (0.5 day salary deducted)
3. Paid Leave (No deduction) - ${paidLeaveRemaining}/${paidLeaveQuota} left this month

Enter 1, 2, or 3:`);
                              } else {
                                type = prompt('Select leave type:\n1. Leave\n2. Half Day');
                              }
                              
                              if (type === '1') markLeaveDay(dateStr, 'leave');
                              else if (type === '2') markLeaveDay(dateStr, 'half_day');
                              else if (type === '3') {
                                if (paidLeaveRemaining > 0 || paidLeaveQuota === 0) {
                                  markLeaveDay(dateStr, 'paid_leave');
                                } else {
                                  alert('No paid leaves remaining for this employee');
                                }
                              }
                            }
                          }}
                        >
                          {day}
                        </button>
                        {leaveType && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500"></div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Click a day to mark leave. Click marked day to unmark. Monthly tally resets but records are preserved.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setFormData(selectedEmployee);
                  setSelectedEmployee(null);
                  setShowForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit Employee
              </button>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Employee Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
            <h2 className="text-xl font-bold mb-4">{formData.id ? 'Edit' : 'Add'} Employee</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="text" 
                  placeholder="Employee ID" 
                  value={formData.employee_id || ''} 
                  onChange={(e) => setFormData({...formData, employee_id: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                />
                <input 
                  type="text" 
                  placeholder="Login ID *" 
                  value={formData.login_id || ''} 
                  onChange={(e) => setFormData({...formData, login_id: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                  required 
                />
                <input 
                  type="text" 
                  placeholder="Full Name *" 
                  value={formData.name || ''} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                  required 
                />
                <input 
                  type="date" 
                  placeholder="Date of Joining" 
                  value={formData.joining_date || ''} 
                  onChange={(e) => setFormData({...formData, joining_date: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                />
                <select 
                  value={formData.status || 'active'} 
                  onChange={(e) => setFormData({...formData, status: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="non-active">Non-Active</option>
                </select>
                {formData.status === 'non-active' && (
                  <input 
                    type="date" 
                    placeholder="Date of Leaving *" 
                    value={formData.date_of_leaving || ''} 
                    onChange={(e) => setFormData({...formData, date_of_leaving: e.target.value})} 
                    className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                    required 
                  />
                )}
                <input 
                  type="number" 
                  placeholder="Monthly Salary (₹)" 
                  value={formData.monthly_salary || ''} 
                  onChange={(e) => setFormData({...formData, monthly_salary: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                />
                <input 
                  type="number" 
                  placeholder="Paid Leave Quota (Monthly)" 
                  value={formData.paid_leave_quota || ''} 
                  onChange={(e) => setFormData({...formData, paid_leave_quota: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <select 
                  value={formData.department || ''} 
                  onChange={(e) => setFormData({...formData, department: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Department *</option>
                  <option value="Admin">Admin</option>
                  <option value="IT">IT</option>
                  <option value="Sales">Sales</option>
                  <option value="Instructors">Instructors</option>
                </select>
                <input 
                  type="tel" 
                  placeholder="Contact Number *" 
                  value={formData.phone || ''} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                  required 
                />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={formData.email || ''} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                />
                <input 
                  type="text" 
                  placeholder="Job Role" 
                  value={formData.job_role || ''} 
                  onChange={(e) => setFormData({...formData, job_role: e.target.value})} 
                  className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <textarea 
                placeholder="Address" 
                value={formData.address || ''} 
                onChange={(e) => setFormData({...formData, address: e.target.value})} 
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                rows={2} 
              />
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                >
                  {formData.id ? 'Update' : 'Create'} Employee
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowForm(false); setFormData({}); }} 
                  className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300 font-medium"
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
