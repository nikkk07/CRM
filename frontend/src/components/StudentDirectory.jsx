import { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { showToast } from '../utils/toast';

const DOC_LABELS = {
  photo_id_proof: 'Photo ID Proof',
  passport_photo: 'Passport Photo',
  signature: 'Signature',
  marksheet_10: '10th Marksheet',
  certificate_10: '10th Certificate',
  marksheet_12: '12th Marksheet',
  certificate_12: '12th Certificate',
  board_verification_10: '10th Board Verification',
  board_verification_12: '12th Board Verification',
  passport: 'Passport',
  i20_admission_letter: 'I-20 Admission Letter',
  medical: 'Medical',
};
const ACCEPT = 'image/jpeg,image/jpg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function StudentDirectory() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const loadStudents = async (q = '') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/students?search=${encodeURIComponent(q)}`, { headers: authHeaders() });
      if (res.ok) setStudents(await res.json());
      else showToast('Failed to load students', 'error');
    } catch { showToast('Failed to load students', 'error'); }
    setLoading(false);
  };

  useEffect(() => { loadStudents(); }, []);
  useEffect(() => {
    const t = setTimeout(() => loadStudents(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  if (selectedId) {
    return <StudentDetail studentId={selectedId} onBack={() => { setSelectedId(null); loadStudents(search); }} />;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold">Students</h2>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Name, mobile, computer no., course"
            className="flex-1 sm:w-72 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap">
            ＋ Add Student
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : students.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No students found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b text-gray-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Mobile</th>
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Admission</th>
                <th className="px-3 py-2">Documents</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const complete = s.documents_complete === s.documents_total;
                return (
                  <tr key={s.id} onClick={() => setSelectedId(s.id)}
                    className="border-b hover:bg-blue-50 cursor-pointer">
                    <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-3 py-2">{s.mobile}</td>
                    <td className="px-3 py-2">{s.course || '-'}</td>
                    <td className="px-3 py-2">{s.admission_date || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${complete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {s.documents_complete}/{s.documents_total}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddStudent
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); loadStudents(search); }}
          onOpenExisting={(id) => { setShowAdd(false); setSelectedId(id); }}
        />
      )}
    </div>
  );
}

function AddStudent({ onClose, onCreated, onOpenExisting }) {
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', guardian_name: '', mobile: '',
    emergency_contact: '', address: '', course: '', computer_number: '', admission_date: '', lead_id: '',
  });
  const [leads, setLeads] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch(`${API_URL}/api/students/prefill-leads`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : [])).then(setLeads).catch(() => {});
  }, []);

  const prefill = (leadId) => {
    const l = leads.find((x) => x.id === leadId);
    if (!l) { set('lead_id', ''); return; }
    const parts = (l.name || '').trim().split(/\s+/);
    setForm((f) => ({
      ...f,
      lead_id: l.id,
      first_name: parts[0] || '',
      last_name: parts.length > 1 ? parts.slice(1).join(' ') : '',
      guardian_name: l.guardian_name || '',
      mobile: l.phone || '',
      address: l.address || '',
      course: l.course_interest || '',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.mobile) {
      showToast('First name, last name and mobile are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/students`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lead_id: form.lead_id || null }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) { showToast(data.detail || 'Failed to add student', 'error'); return; }
      if (data.status === 'duplicate') {
        if (window.confirm(`A student with this mobile already exists${data.name ? ` (${data.name})` : ''}. Open the existing record?`)) {
          onOpenExisting(data.student_id);
        }
        return;
      }
      showToast('Student added', 'success');
      onCreated();
    } catch { setSaving(false); showToast('Failed to add student', 'error'); }
  };

  const input = 'w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">Add Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        {leads.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1">Prefill from completed admission</label>
            <select value={form.lead_id} onChange={(e) => prefill(e.target.value)} className={input}>
              <option value="">-- None (enter manually) --</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>)}
            </select>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className={input} placeholder="First Name *" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
            <input className={input} placeholder="Middle Name" value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} />
            <input className={input} placeholder="Last Name *" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
          </div>
          <input className={input} placeholder="Guardian's Name" value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={input} type="tel" placeholder="Mobile *" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} required />
            <input className={input} type="tel" placeholder="Emergency Contact" value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} />
          </div>
          <input className={input} placeholder="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={input} placeholder="Course" value={form.course} onChange={(e) => set('course', e.target.value)} />
            <input className={input} placeholder="Computer Number (DGCA)" value={form.computer_number} onChange={(e) => set('computer_number', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Admission Date</label>
            <input className={input} type="date" value={form.admission_date} onChange={(e) => set('admission_date', e.target.value)} />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400">
            {saving ? 'Saving…' : 'Save Student'}
          </button>
        </form>
      </div>
    </div>
  );
}

function StudentDetail({ studentId, onBack }) {
  const [student, setStudent] = useState(null);
  const [busy, setBusy] = useState('');

  const load = async () => {
    const res = await fetch(`${API_URL}/api/students/${studentId}`, { headers: authHeaders() });
    if (res.ok) setStudent(await res.json());
    else showToast('Failed to load student', 'error');
  };
  useEffect(() => { load(); }, [studentId]);

  const upload = async (docType, file) => {
    if (!file) return;
    setBusy(docType);
    try {
      const fd = new FormData();
      fd.append('doc_type', docType);
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/students/${studentId}/documents`, {
        method: 'POST', headers: authHeaders(), body: fd,
      });
      const data = await res.json();
      if (!res.ok) showToast(data.detail || 'Upload failed', 'error');
      else { showToast('Uploaded', 'success'); await load(); }
    } catch { showToast('Upload failed', 'error'); }
    setBusy('');
  };

  const view = async (docId) => {
    const res = await fetch(`${API_URL}/api/students/${studentId}/documents/${docId}/url`, { headers: authHeaders() });
    if (res.ok) { const { url } = await res.json(); window.open(url, '_blank', 'noopener'); }
    else showToast('Could not open document', 'error');
  };

  const remove = async (docId, label) => {
    if (!window.confirm(`Delete "${label}"? This permanently removes the file.`)) return;
    const res = await fetch(`${API_URL}/api/students/${studentId}/documents/${docId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (res.ok) { showToast('Deleted', 'success'); await load(); }
    else showToast('Delete failed', 'error');
  };

  if (!student) return <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">Loading…</div>;

  const uploadedCount = student.doc_types.filter((t) => student.documents[t]).length;
  const field = (label, val) => (
    <div>
      <label className="text-sm font-medium text-gray-500">{label}</label>
      <div className="mt-1 text-gray-900 font-medium">{val || '-'}</div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <button onClick={onBack} className="text-blue-600 hover:underline mb-4">← Back to Students</button>

      <h2 className="text-2xl font-bold text-gray-900">
        {[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')}
      </h2>
      <p className="text-gray-600 mb-4">{student.course || 'Student'}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {field('Mobile', student.mobile)}
        {field('Guardian', student.guardian_name)}
        {field('Emergency Contact', student.emergency_contact)}
        {field('Computer Number (DGCA)', student.computer_number)}
        {field('Admission Date', student.admission_date)}
        {field('Address', student.address)}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Documents</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${uploadedCount === student.doc_types.length ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {uploadedCount}/{student.doc_types.length} uploaded
        </span>
      </div>

      <div className="divide-y border rounded-lg">
        {student.doc_types.map((t) => {
          const doc = student.documents[t];
          return (
            <div key={t} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
              <div className="flex items-center gap-2">
                <span className={doc ? 'text-green-600' : 'text-gray-300'}>{doc ? '✓' : '○'}</span>
                <span className="font-medium text-gray-800">{DOC_LABELS[t]}</span>
                {doc && <span className="text-xs text-gray-400 truncate max-w-[160px]">{doc.original_filename}</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {doc && (
                  <>
                    <button onClick={() => view(doc.id)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">View</button>
                    <button onClick={() => remove(doc.id, DOC_LABELS[t])} className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200">Delete</button>
                  </>
                )}
                <label className={`px-3 py-1 text-sm rounded cursor-pointer ${doc ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                  {busy === t ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                  <input type="file" accept={ACCEPT} className="hidden" disabled={busy === t}
                    onChange={(e) => { upload(t, e.target.files[0]); e.target.value = ''; }} />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
