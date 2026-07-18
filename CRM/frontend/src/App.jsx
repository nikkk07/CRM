import { useState, useEffect } from 'react';
import Login from './components/Login';
import EmployeeLogin from './components/EmployeeLogin';
import LeadList from './components/LeadList';
import LeadDetail from './components/LeadDetail';
import Outbox from './components/Outbox';
import TaskBoard from './components/TaskBoard';
import EmployeeDirectory from './components/EmployeeDirectory';
import MyProfile from './components/MyProfile';
import LeaveCalendar from './components/LeaveCalendar';
import PolicyDocs from './components/PolicyDocs';
import AddQuery from './components/AddQuery';
import StudentDirectory from './components/StudentDirectory';
import Attendance from './components/Attendance';
import { syncData, API_URL } from './api';

export default function App() {
  const [employee, setEmployee] = useState(null);
  const [showEmployeeLogin, setShowEmployeeLogin] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsError, setLeadsError] = useState('');
  const [followups, setFollowups] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showOutbox, setShowOutbox] = useState(false);
  const [showAddQuery, setShowAddQuery] = useState(false);
  const [config, setConfig] = useState({});
  const [activeTab, setActiveTab] = useState('leads');
  const [slaMinutes, setSlaMinutes] = useState(15);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordError, setPasswordError] = useState('');

  const isEmployeeSession = employee?.is_employee_session === true;
  const department = employee?.department || '';
  
  // Access control via department
  const canAccessLeads = department === 'Admin' || department === 'Sales';
  const canAccessDirectory = department === 'Admin';
  const canAccessAllTasks = department === 'Admin';
  // Camera monitoring & CCTV attendance: strictly Admin — never Sales/IT/Instructors
  const canAccessCameras = department === 'Admin';

  useEffect(() => {
    const token = localStorage.getItem('token');
    const empStr = localStorage.getItem('employee');
    if (token && empStr) {
      setEmployee(JSON.parse(empStr));
    }
  }, []);

  useEffect(() => {
    if (employee) {
      syncNow();
      const interval = setInterval(syncNow, 60000);
      return () => clearInterval(interval);
    }
  }, [employee]);

  const syncNow = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Admin/owner always fetch leads; employees only if Sales department
      const shouldFetchLeads = !isEmployeeSession || canAccessLeads;
      
      if (shouldFetchLeads) {
        const leadsRes = await fetch(`${API_URL}/api/leads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (leadsRes.ok) {
          const leadsData = await leadsRes.json();
          setLeads(leadsData);
          setLeadsError('');

          const followupsRes = await fetch(`${API_URL}/api/followups/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (followupsRes.ok) {
            const followupsData = await followupsRes.json();
            setFollowups(followupsData);
          }
        } else {
          // Non-2xx: the server responded with an error. A 500 must not silently render as "0 leads".
          let detail = '';
          try { detail = (await leadsRes.json()).detail || ''; } catch { /* non-JSON body */ }
          setLeadsError(`Server error (HTTP ${leadsRes.status})${detail ? `: ${detail}` : ''}. Data was not loaded.`);
        }
      }

      if (!isEmployeeSession) {
        const snapshot = await syncData(token);
        setLastSync(new Date(snapshot.synced_at));
        setConfig(snapshot.config || {});

        if (snapshot.config.sla_first_response_minutes) {
          setSlaMinutes(parseInt(snapshot.config.sla_first_response_minutes));
        }
      }
    } catch (err) {
      console.error('Sync failed:', err);
      if (err && err.status) {
        // The server responded with a non-2xx (e.g. from /api/sync) — a real server-side error
        setLeadsError(`Server error (HTTP ${err.status})${err.detail ? `: ${err.detail}` : ''}. Data was not loaded.`);
      } else {
        // No HTTP response at all — network/DNS/CORS/connection failure
        setLeadsError('Could not reach the server. Check your connection and retry.');
      }
    }
  };

  const handleContact = async (leadId, data) => {
    const token = localStorage.getItem('token');

    if (data.closure_outcome) {
      await fetch(`${API_URL}/api/leads/${leadId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ closure_outcome: data.closure_outcome, note: data.note })
      });
      await syncNow();
      return;
    }

    if (data.followup) {
      await fetch(`${API_URL}/api/leads/${leadId}/followup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          due_date: data.due_date,
          reason: data.reason
        })
      });
    } else {
      await fetch(`${API_URL}/api/leads/${leadId}/contact`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
    }
    
    await syncNow();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    setEmployee(null);
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
      handleLogout();
    } catch (error) {
      setPasswordError('Failed to change password');
    }
  };

  if (!employee) {
    return showEmployeeLogin ? (
      <EmployeeLogin onLogin={setEmployee} />
    ) : (
      <Login onLogin={setEmployee} onSwitchToEmployee={() => setShowEmployeeLogin(true)} />
    );
  }

  // Tabs are data-driven: order, label, and visibility in one place.
  const tabs = [
    canAccessLeads && { id: 'leads', label: 'Leads' },
    canAccessLeads && { id: 'students', label: 'Students' },
    { id: 'tasks', label: isEmployeeSession ? 'My Tasks' : 'Tasks' },
    canAccessCameras && { id: 'attendance', label: '📷 Attendance' },
    canAccessDirectory && { id: 'team', label: 'Team' },
    department === 'Admin' && { id: 'policy', label: 'Policy Docs' },
    isEmployeeSession && { id: 'profile', label: 'My Profile' },
    isEmployeeSession && { id: 'leave', label: 'My Leave' },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-gradient-to-r from-[#0d1b3e] to-[#2a4290] text-white px-4 sm:px-6 py-3 flex justify-between items-center shadow-md">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight">
          ✈️ We One Aviation <span className="font-normal text-indigo-200">· CRM</span>
        </h1>
        <div className="flex items-center gap-2 sm:gap-3">
          {canAccessLeads && (
            <button
              onClick={() => setShowOutbox(true)}
              className="px-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition"
            >
              📤 Outbox
            </button>
          )}
          <span className="hidden sm:inline text-sm text-indigo-100">👤 {employee.name}</span>
          <button
            onClick={() => setShowChangePassword(true)}
            className="text-sm px-2.5 py-1.5 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition"
            title="Change Password"
          >
            🔒
          </button>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="flex border-b bg-white overflow-x-auto whitespace-nowrap shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-5 sm:px-6 py-3 text-sm sm:text-[15px] transition border-b-2 ${
              activeTab === t.id
                ? 'border-indigo-600 font-semibold text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {activeTab === 'leads' && canAccessLeads && leadsError && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center">
            <div className="text-lg font-semibold text-red-800 mb-1">⚠️ Couldn’t load leads</div>
            <p className="text-sm text-red-700 mb-4">{leadsError}</p>
            <button
              onClick={syncNow}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {activeTab === 'leads' && canAccessLeads && !leadsError && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Total Leads</div>
                <div className="text-2xl font-bold">{leads.length}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Untouched</div>
                <div className="text-2xl font-bold text-orange-600">
                  {leads.filter(l => !l.first_contacted_at).length}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Pending Follow-ups</div>
                <div className="text-2xl font-bold text-blue-600">{followups.length}</div>
              </div>
            </div>

            {followups.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-2">⏰ Follow-ups Due</h3>
                <div className="space-y-2">
                  {followups.slice(0, 3).map(f => (
                    <div key={f.id} className="flex justify-between items-center text-sm">
                      <span>
                        <span className="font-semibold">{f.lead_name}</span> - {f.reason}
                      </span>
                      <button
                        onClick={() => {
                          const lead = leads.find(l => l.id === f.lead_id);
                          if (lead) setSelectedLead(lead);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Contact
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Leads</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddQuery(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ＋ Add Query
                  </button>
                  <button
                    onClick={syncNow}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Sync
                  </button>
                </div>
              </div>
              
              <LeadList
                leads={leads}
                onSelectLead={setSelectedLead}
              />
            </div>
          </>
        )}

        {activeTab === 'students' && canAccessLeads && (
          <StudentDirectory />
        )}

        {activeTab === 'tasks' && (
          <TaskBoard />
        )}

        {activeTab === 'attendance' && canAccessCameras && (
          <Attendance />
        )}

        {activeTab === 'team' && canAccessDirectory && (
          <EmployeeDirectory />
        )}

        {activeTab === 'policy' && department === 'Admin' && (
          <PolicyDocs />
        )}

        {activeTab === 'profile' && isEmployeeSession && (
          <MyProfile />
        )}

        {activeTab === 'leave' && isEmployeeSession && (
          <LeaveCalendar employeeId={employee.id} />
        )}
      </div>

      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onContact={handleContact}
        />
      )}

      {showOutbox && (
        <Outbox onClose={() => setShowOutbox(false)} />
      )}

      {showAddQuery && (
        <AddQuery
          requiredQualification={config.eligibility_required_qualification || '12th with Physics & Maths'}
          onClose={() => setShowAddQuery(false)}
          onCreated={() => { setShowAddQuery(false); syncNow(); }}
          onOpenExisting={(leadId) => {
            setShowAddQuery(false);
            const existing = leads.find(l => l.id === leadId);
            if (existing) setSelectedLead(existing);
          }}
        />
      )}

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
