import { useState, useEffect } from 'react';
import { API_URL } from '../api';

// Merged Leave + Biometric Attendance calendar.
// Used by the Employee Directory detail modal (Admin, editable) and MyProfile
// (employee, read-only). Attendance is fetched here from
// GET /api/employees/:id/attendance/:year/:month (source: cctv_attendance via crm_id).
//
// Each day cell shows ONE state, in priority order:
//   Leave / Half-day / Paid-leave (existing)  >  Present  >  Absent  >  Sunday/neutral
export default function AttendanceCalendar({
  employeeId,
  employeeName,
  month,
  setMonth,
  leaveDays = [],
  leaveCounts = {},
  paidLeaveQuota = 0,
  paidLeaveRemaining = 0,
  readOnly = false,
  onMarkLeave,
  onUnmarkLeave,
}) {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);

  const year = month.getFullYear();
  const monthIdx = month.getMonth(); // 0-based

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${API_URL}/api/employees/${employeeId}/attendance/${year}/${monthIdx + 1}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok && !cancelled) {
          setAttendance(await res.json());
        } else if (!cancelled) {
          setAttendance(null);
        }
      } catch {
        if (!cancelled) setAttendance(null);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [employeeId, year, monthIdx]);

  const LEAVE_TYPE_COLORS = {
    leave: 'bg-red-100 text-red-800 border-red-300',
    half_day: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    paid_leave: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  // Biometric day-status colours. short_day / missing_exit are review states and
  // get a distinct warning colour so they are never mistaken for a full day.
  const ATT_STATUS_COLORS = {
    full_day: 'bg-green-100 text-green-800 border-green-300 font-bold',
    half_day: 'bg-yellow-100 text-yellow-800 border-yellow-300 font-bold',
    short_day: 'bg-orange-100 text-orange-800 border-orange-300 font-semibold',
    missing_exit: 'bg-red-100 text-red-700 border-red-300 font-semibold',
    absent: 'bg-rose-100 text-rose-700 border-rose-300',
    leave: 'bg-blue-100 text-blue-800 border-blue-300',
  };
  const ATT_STATUS_LABEL = {
    full_day: 'Full day', half_day: 'Half day', short_day: 'Short day (review)',
    missing_exit: 'Missing exit (review)', absent: 'Absent', leave: 'Leave',
  };

  const dateStrFor = (day) =>
    `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Build a quick lookup of attendance days keyed by ISO date.
  const attByDate = {};
  (attendance?.days || []).forEach((d) => { attByDate[d.date] = d; });

  const summary = attendance?.summary || {};
  const mapped = attendance ? attendance.mapped : true;

  const getDayLeaveType = (day) => {
    const ds = dateStrFor(day);
    return leaveDays?.find((ld) => ld.date === ds)?.type || null;
  };

  // Calendar grid (leading blanks for the first weekday).
  const firstDay = new Date(year, monthIdx, 1);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isFuture = (day) => new Date(year, monthIdx, day) > today;
  const isSunday = (day) => new Date(year, monthIdx, day).getDay() === 0;

  const handleDayClick = (day, leaveType) => {
    if (readOnly) return;
    const ds = dateStrFor(day);
    if (leaveType) {
      onUnmarkLeave && onUnmarkLeave(ds);
      return;
    }
    let type = null;
    if (paidLeaveQuota > 0) {
      type = prompt(`Mark leave for ${employeeName || 'employee'}:
1. Leave (Full day salary deducted)
2. Half Day (0.5 day salary deducted)
3. Paid Leave (No deduction) - ${paidLeaveRemaining}/${paidLeaveQuota} left this month

Enter 1, 2, or 3:`);
    } else {
      type = prompt('Select leave type:\n1. Leave\n2. Half Day');
    }
    if (type === '1') onMarkLeave && onMarkLeave(ds, 'leave');
    else if (type === '2') onMarkLeave && onMarkLeave(ds, 'half_day');
    else if (type === '3') {
      if (paidLeaveRemaining > 0 || paidLeaveQuota === 0) onMarkLeave && onMarkLeave(ds, 'paid_leave');
      else alert('No paid leaves remaining for this employee');
    }
  };

  const fmt = (v) => (v === null || v === undefined ? '—' : v);

  return (
    <div className="animate-glass-in">
      {/* Header + month navigation (shared by leave + attendance) */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-glass-primary">Attendance &amp; Leave</h3>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setMonth(new Date(year, monthIdx - 1))}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            ←
          </button>
          <span className="px-3 py-1 font-medium">
            {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setMonth(new Date(year, monthIdx + 1))}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            →
          </button>
        </div>
      </div>

      {/* Unmapped notice — do NOT render as absent every day */}
      {!loading && !mapped && (
        <div className="mb-4 p-3 glass-subtle rounded text-sm text-amber-800" style={{ backgroundColor: '#fffbeb' }}>
          🔗 This employee is not linked to a biometric device id, so no attendance
          can be shown. Link them under <span className="font-semibold">Attendance → Device People</span>.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Days Present', value: fmt(summary.days_present), cls: 'text-green-700' },
          { label: 'Full Days', value: fmt(summary.full_days), cls: 'text-green-700' },
          { label: 'Half Days', value: fmt(summary.half_days), cls: 'text-yellow-700' },
          { label: 'Needs Review', value: fmt(summary.days_needing_review), cls: 'text-orange-700' },
          { label: 'Days Absent', value: fmt(summary.days_absent), cls: 'text-rose-700' },
          { label: 'Total Hours', value: summary.total_hours != null ? summary.total_hours : '—', cls: 'text-glass-primary' },
          { label: 'Avg Entry', value: fmt(summary.average_entry_time), cls: 'text-glass-primary' },
          { label: 'Avg Exit', value: fmt(summary.average_exit_time), cls: 'text-glass-primary' },
        ].map((c) => (
          <div key={c.label} className="glass-stat p-3 text-center">
            <div className={`text-xl font-bold ${c.cls}`}>{mapped ? c.value : '—'}</div>
            <div className="text-xs text-glass-muted mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Colour legend (leave + attendance) */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-red-200"></span>
          <span>Leave: {leaveCounts?.leave || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-yellow-200"></span>
          <span>Half Day: {leaveCounts?.half_day || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-blue-200"></span>
          <span>Paid Leave: {leaveCounts?.paid_leave || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-green-200"></span>
          <span>Full day</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-orange-200"></span>
          <span>Short / Missing (review)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-rose-200"></span>
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-100 border"></span>
          <span>Sunday / off</span>
        </div>
      </div>

      {/* Merged calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-glass-muted py-2">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="aspect-square"></div>;

          const leaveType = getDayLeaveType(day);
          const att = attByDate[dateStrFor(day)];
          const attStatus = att?.status;
          const present = mapped && att && att.entry_time;
          const sunday = isSunday(day);
          const future = isFuture(day);

          // Resolve to a single visual state by priority.
          let cellCls = 'border-gray-200 bg-white';
          let tooltip = null;
          if (leaveType) {
            cellCls = LEAVE_TYPE_COLORS[leaveType];
          } else if (att && attStatus && ATT_STATUS_COLORS[attStatus]) {
            cellCls = ATT_STATUS_COLORS[attStatus];
            tooltip = `In: ${att.entry_time || '—'} · Out: ${att.exit_time || '—'}` +
              (att.hours_worked != null ? ` · ${att.hours_worked}h` : '') +
              ` · ${ATT_STATUS_LABEL[attStatus] || attStatus}`;
          } else if (present) {
            // status not yet computed (e.g. old row) — still show as present.
            cellCls = 'bg-green-100 text-green-800 border-green-300 font-bold';
            tooltip = `In: ${att.entry_time || '—'} · Out: ${att.exit_time || '—'}` +
              (att.hours_worked != null ? ` · ${att.hours_worked}h` : '');
          } else if (sunday) {
            cellCls = 'bg-gray-100 text-gray-400 border-gray-200';
          } else if (mapped && !future) {
            // A working day with neither leave nor a punch = absent.
            cellCls = 'bg-orange-100 text-orange-800 border-orange-300';
          } else {
            cellCls = 'border-gray-200 bg-white';
          }

          const clickable = !readOnly;
          return (
            <div key={idx} className="relative group">
              <button
                disabled={!clickable}
                onClick={() => handleDayClick(day, leaveType)}
                title={tooltip || undefined}
                className={`w-full aspect-square border rounded flex items-center justify-center text-sm font-medium transition ${cellCls} ${clickable ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
              >
                {day}
              </button>
              {tooltip && (
                <div className="pointer-events-none absolute z-10 left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block whitespace-nowrap bg-gray-900 text-white text-xs rounded px-2 py-1 shadow">
                  {tooltip}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <p className="text-xs text-glass-muted mt-4">
          Click a day to mark leave; click a marked day to unmark. Present/Absent come from the
          biometric device and update automatically.
        </p>
      )}
      {readOnly && (
        <p className="text-xs text-glass-muted mt-4">
          Present/Absent are recorded automatically from the biometric device. Hover a green day to see entry/exit.
        </p>
      )}
    </div>
  );
}
