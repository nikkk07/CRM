import { useState } from 'react';

export default function LeadList({ leads, onSelectLead }) {
  const [filter, setFilter] = useState('all');
  
  const filteredLeads = leads.filter(l => {
    if (filter === 'pending') return !l.first_contacted_at;
    if (filter === 'interested') return l.status === 'Interested';
    if (filter === 'not-interested') return l.status === 'Not interested';
    if (filter === 'not-reachable') return l.status === 'Not reachable';
    if (filter === 'callback') return l.status === 'Callback';
    if (filter === 'connected') return l.status === 'Connected';
    if (filter === 'wrong-number') return l.status === 'Wrong number';
    if (filter === 'parked') return l.parked === true;
    if (filter === 'closed') return l.closed === true;
    return true;
  });
  
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          All ({leads.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1 rounded text-sm ${filter === 'pending' ? 'bg-orange-600 text-white' : 'bg-gray-200'}`}
        >
          Pending ({leads.filter(l => !l.first_contacted_at).length})
        </button>
        <button
          onClick={() => setFilter('interested')}
          className={`px-3 py-1 rounded text-sm ${filter === 'interested' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
        >
          Interested ({leads.filter(l => l.status === 'Interested').length})
        </button>
        <button
          onClick={() => setFilter('callback')}
          className={`px-3 py-1 rounded text-sm ${filter === 'callback' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
        >
          Callback ({leads.filter(l => l.status === 'Callback').length})
        </button>
        <button
          onClick={() => setFilter('connected')}
          className={`px-3 py-1 rounded text-sm ${filter === 'connected' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Connected ({leads.filter(l => l.status === 'Connected').length})
        </button>
        <button
          onClick={() => setFilter('not-reachable')}
          className={`px-3 py-1 rounded text-sm ${filter === 'not-reachable' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
        >
          Not Reachable ({leads.filter(l => l.status === 'Not reachable').length})
        </button>
        <button
          onClick={() => setFilter('wrong-number')}
          className={`px-3 py-1 rounded text-sm ${filter === 'wrong-number' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
        >
          Wrong Number ({leads.filter(l => l.status === 'Wrong number').length})
        </button>
        <button
          onClick={() => setFilter('not-interested')}
          className={`px-3 py-1 rounded text-sm ${filter === 'not-interested' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}
        >
          Not Interested ({leads.filter(l => l.status === 'Not interested').length})
        </button>
        <button
          onClick={() => setFilter('parked')}
          className={`px-3 py-1 rounded text-sm ${filter === 'parked' ? 'bg-amber-600 text-white' : 'bg-gray-200'}`}
        >
          Parked ({leads.filter(l => l.parked === true).length})
        </button>
        <button
          onClick={() => setFilter('closed')}
          className={`px-3 py-1 rounded text-sm ${filter === 'closed' ? 'bg-stone-600 text-white' : 'bg-gray-200'}`}
        >
          Closed ({leads.filter(l => l.closed === true).length})
        </button>
      </div>
      
      <div className="space-y-3">
        {filteredLeads.map(lead => {
          return (
            <div
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className="p-4 rounded-lg border-2 border-gray-200 cursor-pointer hover:shadow-lg hover:border-blue-400 transition bg-white"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="font-semibold text-lg">{lead.name}</div>
                  <div className="text-sm text-gray-600">{lead.phone}</div>
                  <div className="text-sm text-gray-500">{lead.course_interest}</div>
                </div>
                <div className="text-right">
                  <div className="flex flex-col gap-1 items-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      lead.status === 'Interested' ? 'bg-green-100 text-green-800' :
                      lead.status === 'Not interested' ? 'bg-gray-100 text-gray-800' :
                      lead.status === 'Not reachable' ? 'bg-yellow-100 text-yellow-800' :
                      lead.status === 'Callback' ? 'bg-purple-100 text-purple-800' :
                      lead.status === 'Connected' ? 'bg-blue-100 text-blue-800' :
                      lead.status === 'Wrong number' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {lead.status}
                    </span>
                    {lead.parked && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                        🅿️ Parked
                      </span>
                    )}
                    {lead.closed && (
                      <span className="px-2 py-0.5 rounded text-xs bg-stone-100 text-stone-800">
                        🔒 Closed
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {lead.last_note && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700 text-center">
                  💬 {lead.last_note}
                </div>
              )}
              
              <div className="mt-2 text-xs text-gray-500">
                📅 Created: {formatDate(lead.created_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
