import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../api';

// Camera dashboard runs on the institute's Mac Mini. Override with
// VITE_CCTV_URL at build time if you access it via the Mac's LAN IP.
const CCTV_URL = import.meta.env.VITE_CCTV_URL || 'http://localhost:8100';

const todayStr = () => new Date().toISOString().slice(0, 10);

// Canonical roles are student | employee | visitor. Legacy rows may say 'staff'.
const normRole = (r) => (r === 'staff' ? 'employee' : r || 'student');

const ROLE_BADGE = {
  student: 'bg-indigo-100 text-indigo-700',
  employee: 'bg-amber-100 text-amber-800',
  visitor: 'bg-purple-100 text-purple-700',
};

const ROLE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'student', label: 'Students' },
  { key: 'employee', label: 'Employees' },
  { key: 'visitor', label: 'Visitors' },
];

export default function Attendance() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');

  const load = useCallback(async (d) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/attendance?date=${d}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        setError('Only the Admin department can view CCTV attendance.');
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError('Could not load attendance. Is the CRM server reachable?');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const rows = data?.rows || [];
  const visitorCount = rows.filter((r) => normRole(r.role) === 'visitor').length;
  const filteredRows =
    roleFilter === 'all' ? rows : rows.filter((r) => normRole(r.role) === roleFilter);
  const isSunday = new Date(date + 'T12:00:00').getDay() === 0;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">CCTV Attendance</h2>
          <p className="text-sm text-slate-500">
            Marked automatically by the camera system at the institute.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={() => load(date)}
            className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            ↻ Refresh
          </button>
          <a
            href={CCTV_URL}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
            title="Opens the live camera dashboard (Admin login required there too)"
          >
            📷 Camera Monitoring
          </a>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Marked present', value: data ? data.present : '—' },
          { label: 'Currently inside', value: data ? data.inside : '—', accent: 'text-emerald-600' },
          { label: 'Left for the day', value: data ? data.present - data.inside : '—', accent: 'text-slate-500' },
          { label: 'Visitors today', value: data ? visitorCount : '—', accent: 'text-purple-600' },
          { label: 'Date', value: date, small: true },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className={`${c.small ? 'text-base' : 'text-2xl'} font-bold ${c.accent || 'text-slate-900'}`}>
              {c.value}
            </div>
            <div className="text-xs text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {/* Role filter */}
      <div className="flex flex-wrap items-center gap-2">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setRoleFilter(f.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${
              roleFilter === f.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Entry</th>
                <th className="px-4 py-3">Exit</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((r) => (
                <tr key={r.person_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      ROLE_BADGE[normRole(r.role)] || ROLE_BADGE.student
                    }`}>{normRole(r.role)}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.entry_time || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{r.exit_time || '—'}</td>
                  <td className="px-4 py-3">
                    {r.exit_time ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Left</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Inside</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 && !error && (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-slate-400">
                    {rows.length > 0
                      ? 'No people match this role filter.'
                      : isSunday
                        ? 'Sunday — attendance is not taken.'
                        : 'No attendance synced for this date yet.'}
                  </td>
                </tr>
              )}
              {loading && (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
