import { useState, useEffect } from 'react';
import { formatDate } from '../utils/formatters';
import { showToast } from '../utils/toast';
import LoadingSpinner from './LoadingSpinner';
import { API_URL } from '../api';

export default function TaskBoard() {
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [formData, setFormData] = useState({});
  const [currentEmployee, setCurrentEmployee] = useState(null);

  const isEmployeeSession = currentEmployee?.is_employee_session === true;
  const permissionLevel = currentEmployee?.permission_level || 'regular';
  const isOwnerOrAdmin = currentEmployee?.role === 'owner' || currentEmployee?.role === 'admin';
  const canViewAllEmployees = isOwnerOrAdmin || permissionLevel === 'full_access';

  useEffect(() => {
    // Get current employee from localStorage
    const empStr = localStorage.getItem('employee');
    if (empStr) {
      const emp = JSON.parse(empStr);
      setCurrentEmployee(emp);
    }
  }, []);

  useEffect(() => {
    if (currentEmployee) {
      loadData();
    }
  }, [currentEmployee]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch tasks (backend already filters for employee sessions)
      const tasksRes = await fetch(`${API_URL}/api/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tasksData = await tasksRes.json();
      setTasks(tasksData);
      
      // Fetch employees based on permission_level
      if (canViewAllEmployees) {
        try {
          const empRes = await fetch(`${API_URL}/api/employees`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (empRes.ok) {
            const empData = await empRes.json();
            setEmployees(empData);
          }
        } catch (error) {
          console.error('Failed to load employees:', error);
          // Fallback to showing only current user
          if (currentEmployee) {
            setEmployees([{
              id: currentEmployee.id,
              name: currentEmployee.name,
              job_role: currentEmployee.job_role
            }]);
          }
        }
      } else {
        // sales and regular: show only their own card
        if (currentEmployee) {
          setEmployees([{
            id: currentEmployee.id,
            name: currentEmployee.name,
            job_role: currentEmployee.job_role
          }]);
        }
      }
    } catch (error) {
      showToast('Failed to load task board', 'error');
    }
    setLoading(false);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      showToast('Task added', 'success');
      setShowAddTask(false);
      setFormData({});
      loadData();
    } catch (error) {
      showToast('Failed to add task', 'error');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const payload = { status: newStatus };
      
      if (newStatus === 'aborted') {
        const reason = prompt('Abort reason (required):');
        if (!reason) return;
        payload.abort_reason = reason;
      }
      
      await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      showToast('Task updated', 'success');
      loadData();
    } catch (error) {
      showToast('Failed to update task', 'error');
    }
  };

  const getEmployeeTasks = (employeeId) => {
    return tasks.filter(t => t.assigned_to === employeeId);
  };

  const getPendingCount = (employeeId) => {
    return tasks.filter(t => t.assigned_to === employeeId && t.status === 'pending').length;
  };

  const STATUS_COLORS = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    done: 'bg-green-100 text-green-800 border-green-200',
    aborted: 'bg-red-100 text-red-800 border-red-200'
  };

  const STATUS_LABELS = {
    pending: 'Pending',
    done: 'Completed',
    aborted: 'Aborted'
  };

  if (loading) return <LoadingSpinner size="lg" text="Loading task board..." />;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{canViewAllEmployees ? 'Task Board' : 'My Tasks'}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {canViewAllEmployees ? 'Manage tasks across your team' : 'Manage your assigned tasks'}
          </p>
        </div>
        <button
          onClick={() => { 
            setFormData(canViewAllEmployees ? {} : { assigned_to: currentEmployee.id }); 
            setShowAddTask(true); 
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          + Add Task
        </button>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map(emp => {
          const employeeTasks = getEmployeeTasks(emp.id);
          const pendingCount = getPendingCount(emp.id);
          
          return (
            <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
              {/* Employee Header */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold shadow-sm">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-lg truncate">{emp.name}</h3>
                    <p className="text-sm text-gray-600 truncate">{emp.job_role || 'Employee'}</p>
                  </div>
                </div>
                
                {/* Pending Count Badge */}
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm">
                  <span className="text-sm font-medium text-gray-700">Pending Tasks:</span>
                  <span className={`text-lg font-bold ${pendingCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {pendingCount}
                  </span>
                </div>
              </div>

              {/* Tasks List */}
              <div className="p-4">
                {employeeTasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">✓</div>
                    <p className="text-sm">No tasks assigned</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {employeeTasks.map(task => (
                      <div key={task.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="font-medium text-gray-900 text-sm flex-1">{task.title}</h4>
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="done">Completed</option>
                            <option value="aborted">Aborted</option>
                          </select>
                        </div>
                        
                        {task.description && (
                          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>Assigned: {formatDate(task.created_at)}</span>
                          {task.status === 'done' && task.finish_date && (
                            <span className="text-green-600 font-medium">
                              ✓ Finished: {formatDate(task.finish_date)}
                            </span>
                          )}
                          {task.status === 'aborted' && task.abort_reason && (
                            <span className="text-red-600 font-medium" title={task.abort_reason}>
                              ✕ Aborted: {task.abort_reason.substring(0, 30)}{task.abort_reason.length > 30 ? '...' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {employees.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">No employees found</h3>
          <p className="text-sm">Add employees to start assigning tasks</p>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Add New Task</h2>
            
            <form onSubmit={handleAddTask} className="space-y-4">
              {canViewAllEmployees && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
                  <select
                    value={formData.assigned_to || ''}
                    onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Follow up with lead"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Task details..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                >
                  Add Task
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddTask(false); setFormData({}); }}
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
