import { useState } from 'react';

function bucketOf(l) {
  if (l.status === 'closed') return 'closed';
  if (!l.first_contacted_at) return 'pending';
  if (l.status === 'Interested') { if (l.interest_track === 'PPL') return 'ppl'; if (l.interest_track === 'Flying') return 'flying'; return 'interested'; }
  if (l.status === 'Not interested') return 'not-interested';
  if (l.status === 'Not reachable') return 'not-reachable';
  if (l.status === 'Callback') return 'callback';
  return 'in-progress';
}

export default function LeadList({ leads, onSelectLead }) {
  const [filter, setFilter] = useState('all');
  const [closedSub, setClosedSub] = useState('successful');

  const buckets = leads.reduce((acc, l) => { const b = bucketOf(l); (acc[b] = acc[b] || []).push(l); return acc; }, {});
  const count = (b) => (buckets[b] || []).length;
  let filteredLeads;
  if (filter === 'all') filteredLeads = leads;
  else if (filter === 'closed') { const outcome = closedSub === 'successful' ? 'admission_completed' : 'admission_aborted'; filteredLeads = (buckets.closed || []).filter(l => l.closure_outcome === outcome); }
  else filteredLeads = buckets[filter] || [];

  const formatDate = (dateStr) => new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  const tab = (key, label, activeClass) => (
    <button onClick={() => setFilter(key)} className={`px-3 py-1 rounded text-sm font-medium transition ${filter === key ? activeClass : 'glass-subtle text-glass-secondary hover:text-glass-primary'}`}>{label}</button>
  );

  const badgeClass = (lead) => {
    const base = 'glass-badge ';
    if (lead.status === 'closed') return base + (lead.closure_outcome === 'admission_completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800');
    if (lead.status === 'Interested') return base + 'bg-green-100 text-green-800';
    if (lead.status === 'Not interested') return base + 'bg-gray-100 text-gray-800';
    if (lead.status === 'Not reachable') return base + 'bg-yellow-100 text-yellow-800';
    if (lead.status === 'Callback') return base + 'bg-purple-100 text-purple-800';
    return base + 'bg-blue-100 text-blue-800';
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {tab('all', `All (${leads.length})`, 'bg-indigo-600 text-white')}
        {tab('pending', `Pending (${count('pending')})`, 'bg-orange-600 text-white')}
        {tab('in-progress', `In Progress (${count('in-progress')})`, 'bg-sky-600 text-white')}
        {tab('interested', `Interested (${count('interested')})`, 'bg-green-600 text-white')}
        {tab('ppl', `PPL (${count('ppl')})`, 'bg-teal-600 text-white')}
        {tab('flying', `Flying (${count('flying')})`, 'bg-cyan-600 text-white')}
        {tab('callback', `Callback (${count('callback')})`, 'bg-purple-600 text-white')}
        {tab('not-reachable', `Not Reachable (${count('not-reachable')})`, 'bg-yellow-600 text-white')}
        {tab('not-interested', `Not Interested (${count('not-interested')})`, 'bg-gray-600 text-white')}
        {tab('closed', `Closed (${count('closed')})`, 'bg-slate-800 text-white')}
      </div>

      {filter === 'closed' && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => setClosedSub('successful')} className={`px-3 py-1 rounded text-sm font-medium transition ${closedSub === 'successful' ? 'bg-green-600 text-white' : 'glass-subtle text-green-800'}`}>Successful Admissions ({(buckets.closed || []).filter(l => l.closure_outcome === 'admission_completed').length})</button>
          <button onClick={() => setClosedSub('failed')} className={`px-3 py-1 rounded text-sm font-medium transition ${closedSub === 'failed' ? 'bg-red-600 text-white' : 'glass-subtle text-red-800'}`}>Failed Admissions ({(buckets.closed || []).filter(l => l.closure_outcome === 'admission_aborted').length})</button>
        </div>
      )}

      <div className="space-y-3">
        {filteredLeads.map(lead => (
          <div key={lead.id} onClick={() => onSelectLead(lead)} className="glass-card p-4 cursor-pointer animate-glass-in">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="font-semibold text-lg text-glass-primary">{lead.name}</div>
                <div className="text-sm text-glass-secondary">{lead.phone}</div>
                <div className="text-sm text-glass-muted">{lead.course_interest}</div>
              </div>
              <div className="text-right">
                <span className={badgeClass(lead)}>{lead.status === 'closed' ? (lead.closure_outcome === 'admission_completed' ? 'Admission Completed' : 'Admission Aborted') : lead.status}</span>
              </div>
            </div>
            {lead.last_note && <div className="mt-2 p-2 glass-subtle text-sm text-glass-primary text-center">💬 {lead.last_note}</div>}
            <div className="mt-2 text-xs text-glass-muted">📅 Created: {formatDate(lead.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
