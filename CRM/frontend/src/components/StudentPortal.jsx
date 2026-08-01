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

// Student session token — kept separate from the staff `token` so sessions never collide.
const studentAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('student_token')}` });

export default function StudentPortal({ onLogout }) {
  const [student, setStudent] = useState(null);
  const [docs, setDocs] = useState({ doc_types: [], documents: {} });
  const [form, setForm] = useState({ guardian_name: '', emergency_contact: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');

  const loadProfile = async () => {
    const res = await fetch(`${API_URL}/api/student/me`, { headers: studentAuthHeaders() });
    if (res.ok) {
      const s = await res.json();
      setStudent(s);
      setForm({
        guardian_name: s.guardian_name || '',
        emergency_contact: s.emergency_contact || '',
        address: s.address || '',
      });
    } else if (res.status === 401 || res.status === 403) {
      showToast('Session expired. Please sign in again.', 'error');
      onLogout();
    } else {
      showToast('Failed to load your profile', 'error');
    }
  };

  const loadDocs = async () => {
    const res = await fetch(`${API_URL}/api/student/me/documents`, { headers: studentAuthHeaders() });
    if (res.ok) setDocs(await res.json());
  };

  useEffect(() => { loadProfile(); loadDocs(); }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/student/me`, {
        method: 'PATCH',
        headers: { ...studentAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(data.detail || 'Failed to save', 'error');
      else { showToast('Profile updated', 'success'); await loadProfile(); }
    } catch { showToast('Failed to save', 'error'); }
    setSaving(false);
  };

  const upload = async (docType, file) => {
    if (!file) return;
    setBusy(docType);
    try {
      const fd = new FormData();
      fd.append('doc_type', docType);
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/student/me/documents`, {
        method: 'POST', headers: studentAuthHeaders(), body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(data.detail || 'Upload failed', 'error');
      else { showToast('Uploaded', 'success'); await loadDocs(); }
    } catch { showToast('Upload failed', 'error'); }
    setBusy('');
  };

  const view = async (docId) => {
    const res = await fetch(`${API_URL}/api/student/me/documents/${docId}/url`, { headers: studentAuthHeaders() });
    if (res.ok) { const { url } = await res.json(); window.open(url, '_blank', 'noopener'); }
    else showToast('Could not open document', 'error');
  };

  const input = 'w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500';
  // Institutional fields are read-only and visibly greyed.
  const readOnly = 'w-full px-3 py-2 border rounded bg-slate-100 text-slate-500 cursor-not-allowed';

  const fullName = student
    ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
    : '';

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-gradient-to-r from-[#0d1b3e] to-[#2a4290] text-white px-4 sm:px-6 py-3 flex justify-between items-center shadow-md">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight">
          🎓 We One Aviation <span className="font-normal text-indigo-200">· Student Portal</span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-indigo-100">👤 {fullName}</span>
          <button onClick={onLogout} className="text-sm px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        {!student ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-slate-500">Loading…</div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-2xl font-bold text-slate-900">{fullName}</h2>
              <p className="text-slate-600 mb-4">{student.course || 'Student'}</p>

              {/* Read-only institutional fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Mobile</label>
                  <input className={readOnly} value={student.mobile || '-'} disabled readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Course</label>
                  <input className={readOnly} value={student.course || '-'} disabled readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Computer Number (DGCA)</label>
                  <input className={readOnly} value={student.computer_number || '-'} disabled readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Admission Date</label>
                  <input className={readOnly} value={student.admission_date || '-'} disabled readOnly />
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Course, computer number, admission date and mobile are managed by the institute and cannot be edited here.
              </p>

              {/* Editable fields */}
              <form onSubmit={saveProfile} className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Editable details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Guardian's Name</label>
                    <input className={input} value={form.guardian_name}
                      onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Contact</label>
                    <input className={input} type="tel" value={form.emergency_contact}
                      onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input className={input} value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-slate-400">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </div>

            {/* Documents — upload & view only, no delete (compliance records) */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-3">My Documents</h3>
              <div className="divide-y border rounded-lg">
                {docs.doc_types.map((t) => {
                  const doc = docs.documents[t];
                  return (
                    <div key={t} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
                      <div className="flex items-center gap-2">
                        <span className={doc ? 'text-green-600' : 'text-gray-300'}>{doc ? '✓' : '○'}</span>
                        <span className="font-medium text-gray-800">{DOC_LABELS[t] || t}</span>
                        {doc && <span className="text-xs text-gray-400 truncate max-w-[160px]">{doc.original_filename}</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {doc && (
                          <button onClick={() => view(doc.id)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">View</button>
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
          </>
        )}
      </div>
    </div>
  );
}
