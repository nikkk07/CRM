import { useState } from 'react';
import { API_URL } from '../api';
import { showToast } from '../utils/toast';

const SOURCES = ['We One Aviation', 'JustDial', 'Walk-in', 'Direct Call', 'Direct Message', 'Flying Star'];
const COURSES = ['ATPL', 'CPL', 'PPL', 'Flying'];
const QUALIFICATIONS = ['10th', '12th with Physics & Maths', '12th without Physics & Maths', 'Graduation'];

export default function AddQuery({ requiredQualification, onClose, onCreated, onOpenExisting }) {
  const [form, setForm] = useState({
    utm_source: '', name: '', guardian_name: '', phone: '', email: '', address: '', course_interest: ''
  });
  const [qualifications, setQualifications] = useState([]);
  const [niosInterested, setNiosInterested] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });

  // Eligibility trigger is the ABSENCE of the required qualification (from config), not the presence of "without PM".
  const isEligible = qualifications.includes(requiredQualification);

  const toggleQual = (q) => {
    setQualifications(qualifications.includes(q)
      ? qualifications.filter(x => x !== q)
      : [...qualifications, q]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.utm_source || !form.name || !form.phone || !form.course_interest) {
      showToast('Fill all required fields', 'error');
      return;
    }
    if (!isEligible && niosInterested === null) {
      showToast('Answer "Interested in NIOS?"', 'error');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/leads/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          qualifications,
          nios_interested: isEligible ? null : niosInterested
        })
      });
      const data = await res.json();
      setSaving(false);

      if (!res.ok) {
        showToast(data.detail || 'Failed to add query', 'error');
        return;
      }

      if (data.status === 'duplicate') {
        if (window.confirm(`A lead with this phone already exists${data.name ? ` (${data.name})` : ''}. Open the existing lead?`)) {
          onOpenExisting(data.lead_id);
        }
        return;
      }

      showToast('Query added', 'success');
      onCreated();
    } catch {
      setSaving(false);
      showToast('Failed to add query', 'error');
    }
  };

  const input = "w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">Add Query</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Lead From *</label>
            <select value={form.utm_source} onChange={(e) => set('utm_source', e.target.value)} className={input} required>
              <option value="">-- Select Source --</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <input className={input} placeholder="Name *" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <input className={input} placeholder="Parent's / Guardian's Name" value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
          <input className={input} type="tel" placeholder="Phone Number *" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
          <input className={input} type="email" placeholder="Email ID" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <input className={input} placeholder="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />

          <div>
            <label className="block text-sm font-semibold mb-1">Course Interested *</label>
            <select value={form.course_interest} onChange={(e) => set('course_interest', e.target.value)} className={input} required>
              <option value="">-- Select Course --</option>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Educational Qualification</label>
            <div className="space-y-1">
              {QUALIFICATIONS.map(q => (
                <label key={q} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={qualifications.includes(q)} onChange={() => toggleQual(q)} />
                  {q}
                </label>
              ))}
            </div>
          </div>

          {qualifications.length > 0 && !isEligible && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700 mb-2">
                Not eligible (requires "{requiredQualification}"). Interested in NIOS? *
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setNiosInterested(true)}
                  className={`px-4 py-2 rounded border-2 font-semibold ${niosInterested === true ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-300'}`}>
                  Yes
                </button>
                <button type="button" onClick={() => setNiosInterested(false)}
                  className={`px-4 py-2 rounded border-2 font-semibold ${niosInterested === false ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-300'}`}>
                  No
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400">
            {saving ? 'Saving...' : 'Save Query'}
          </button>
        </form>
      </div>
    </div>
  );
}
