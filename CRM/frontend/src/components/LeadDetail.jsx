import { useState } from 'react';
import { createPortal } from 'react-dom';
import QuoteGenerator from './QuoteGenerator';

export default function LeadDetail({ lead, onClose, onContact }) {
  const [disposition, setDisposition] = useState('');
  const [closureOutcome, setClosureOutcome] = useState('');
  const [track, setTrack] = useState(lead.interest_track || '');
  const [note, setNote] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupReason, setFollowupReason] = useState('');
  const [showQuoteGen, setShowQuoteGen] = useState(false);

  const handleSave = async () => {
    if (!disposition) { alert('Select a disposition first'); return; }
    if (disposition === 'Closed') { if (!closureOutcome) { alert('Select Admission Completed or Admission Aborted'); return; } await onContact(lead.id, { closure_outcome: closureOutcome, note }); setDisposition(''); setClosureOutcome(''); setTrack(''); setNote(''); onClose(); return; }
    if (disposition === 'Interested' && !track) { alert('Select a track (CPL / PPL / Flying)'); return; }
    await onContact(lead.id, { channel: 'phone', disposition, note, ...(disposition === 'Interested' ? { interest_track: track } : {}) });
    if (disposition === 'Callback' && followupDate) { await onContact(lead.id, { followup: true, due_date: followupDate, reason: followupReason }); }
    setDisposition(''); setTrack(''); setNote(''); onClose();
  };

  const waLink = `https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hello ' + lead.name + ', this is We One Aviation regarding your enquiry.')}`;

  const dispoBtn = (val, label, activeCls, icon) => (
    <button onClick={() => setDisposition(val)} className={`py-3 px-3 rounded-lg border-2 transition font-semibold ${disposition === val ? activeCls : 'glass-subtle text-glass-secondary hover:text-glass-primary'}`} style={disposition === val ? {} : { borderColor: '#d2d2d7' }}>{icon} {label}</button>
  );

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 glass-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="glass-strong max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto p-6 animate-glass-in">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-glass-primary">{lead.name}</h2>
              <p className="text-glass-secondary">{lead.phone}</p>
              <p className="text-glass-muted">{lead.email}</p>
            </div>
            <button onClick={() => { setTrack(''); onClose(); }} className="text-glass-muted hover:text-glass-primary text-2xl">×</button>
          </div>
          <div className="mb-6 space-y-2 text-sm text-glass-primary">
            <div><span className="font-semibold">Course:</span> {lead.course_interest}</div>
            <div><span className="font-semibold">Address:</span> {lead.address || 'N/A'}</div>
            {lead.utm_source && <div><span className="font-semibold">Source:</span> {lead.utm_source} / {lead.utm_medium} / {lead.utm_campaign}</div>}
            <div><span className="font-semibold">Status:</span> {lead.status}{lead.first_contacted_at && <span className="ml-2 text-green-600">✓ Contacted</span>}</div>
          </div>
          <div className="mb-4"><button onClick={() => setShowQuoteGen(true)} className="glass-btn w-full py-3" style={{ background: '#7c3aed' }}>📄 Generate Quote</button></div>
          <div className="mb-4">
            <h3 className="font-semibold mb-3 text-lg text-glass-primary">Contact Lead</h3>
            <div className="flex gap-3 mb-4">
              <a href={`tel:${lead.phone}`} className="glass-btn flex-1 py-3 text-center" style={{ background: '#22c55e' }}>📞 Call</a>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="glass-btn flex-1 py-3 text-center" style={{ background: '#16a34a' }}>💬 WhatsApp</a>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2 text-glass-primary">Mark as *</label>
            <div className="grid grid-cols-2 gap-2">
              {dispoBtn('Interested', 'Interested', 'border-green-600 bg-green-50 text-green-700', '✓')}
              {dispoBtn('Not interested', 'Not Interested', 'border-gray-600 bg-gray-50 text-gray-700', '✗')}
              {dispoBtn('Not reachable', 'Not Reachable', 'border-yellow-600 bg-yellow-50 text-yellow-700', '📵')}
              {dispoBtn('Callback', 'Callback', 'border-purple-600 bg-purple-50 text-purple-700', '🔄')}
              <button onClick={() => { setDisposition('Closed'); setClosureOutcome(''); }} className={`py-3 px-3 rounded-lg border-2 transition font-semibold col-span-2 ${disposition === 'Closed' ? 'border-slate-800 bg-slate-50 text-slate-800' : 'glass-subtle text-glass-secondary hover:text-glass-primary'}`} style={disposition === 'Closed' ? {} : { borderColor: '#d2d2d7' }}>🔒 Closed</button>
            </div>
          </div>
          {disposition === 'Interested' && (
            <div className="mb-4 p-3 glass-subtle">
              <label className="block text-sm font-semibold mb-2 text-glass-primary">Course Track *</label>
              <div className="flex flex-wrap gap-2">
                {['CPL', 'PPL', 'Flying'].map(t => (
                  <button key={t} onClick={() => setTrack(t)} className={`flex-1 min-w-[90px] py-3 px-3 rounded-lg border-2 transition font-semibold ${track === t ? 'border-green-600 bg-green-100 text-green-700' : 'glass-subtle text-glass-secondary'}`} style={track === t ? {} : { borderColor: '#d2d2d7' }}>{t}</button>
                ))}
              </div>
            </div>
          )}
          {disposition === 'Closed' && (
            <div className="mb-4 p-3 glass-subtle">
              <label className="block text-sm font-semibold mb-2 text-glass-primary">Closure Outcome *</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setClosureOutcome('admission_completed')} className={`py-3 px-3 rounded-lg border-2 transition font-semibold ${closureOutcome === 'admission_completed' ? 'border-green-600 bg-green-50 text-green-700' : 'glass-subtle text-glass-secondary'}`} style={closureOutcome === 'admission_completed' ? {} : { borderColor: '#d2d2d7' }}>✓ Admission Completed</button>
                <button onClick={() => setClosureOutcome('admission_aborted')} className={`py-3 px-3 rounded-lg border-2 transition font-semibold ${closureOutcome === 'admission_aborted' ? 'border-red-600 bg-red-50 text-red-700' : 'glass-subtle text-glass-secondary'}`} style={closureOutcome === 'admission_aborted' ? {} : { borderColor: '#d2d2d7' }}>✗ Admission Aborted</button>
              </div>
            </div>
          )}
          {disposition === 'Callback' && (
            <div className="mb-4 p-3 glass-subtle">
              <label className="block text-sm font-semibold mb-1 text-glass-primary">Follow-up Date</label>
              <input type="datetime-local" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} className="glass-input w-full px-3 py-2 mb-2" />
              <label className="block text-sm font-semibold mb-1 text-glass-primary">Reason</label>
              <input type="text" value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} placeholder="e.g., Student wanted callback after 3pm" className="glass-input w-full px-3 py-2" />
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2 text-glass-primary">Notes (will show in lead list)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add notes about the conversation..." className="glass-input w-full px-3 py-2" rows={3} />
          </div>
          <button onClick={handleSave} disabled={!disposition} className="glass-btn w-full py-3">Save Contact Attempt</button>
        </div>
        </div>,
        document.body
      )}
      {showQuoteGen && <QuoteGenerator lead={lead} onClose={() => setShowQuoteGen(false)} />}
    </>
  );
}
