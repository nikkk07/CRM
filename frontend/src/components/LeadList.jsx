import { useState } from 'react';

export default function LeadList({ leads, onSelectLead, slaMinutes }) {
  const [filter, setFilter] = useState('all');
  
  const getLeadUrgency = (lead) => {
    if (lead.first_contacted_at) return 'contacted';
    if (lead.age_minutes > slaMinutes) return 'overdue';
    if (lead.age_minutes > slaMinutes * 0.7) return 'warning';
    return 'new';
  };
  
  const urgencyColors = {
    overdue: 'bg-red-50 border-red-300',
    warning: 'bg-yellow-50 border-yellow-300',
    new: 'bg-blue-50 border-blue-300',
    contacted: 'bg-white border-gray-200'
  };
  
  const filteredLeads = leads.filter(l => {
    if (filter === 'untouched') return !l.first_contacted_at;
    if (filter === 'overdue') return !l.first_contacted_at && l.age_minutes > slaMinutes;
    return true;
  });

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          All ({leads.length})
        </button>
        <button
          onClick={() => setFilter('untouched')}
          className={`px-3 py-1 rounded ${filter === 'untouched' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Untouched ({leads.filter(l => !l.first_contacted_at).length})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-3 py-1 rounded ${filter === 'overdue' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
        >
          Overdue ({leads.filter(l => !l.first_contacted_at && l.age_minutes > slaMinutes).length})
        </button>
      </div>
      
      <div className="space-y-2">
        {filteredLeads.map(lead => {
          const urgency = getLeadUrgency(lead);
          return (
            <div
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className={`p-3 rounded border-2 cursor-pointer hover:shadow-md transition ${urgencyColors[urgency]}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{lead.name}</div>
                  <div className="text-sm text-gray-600">{lead.phone}</div>
                  <div className="text-sm text-gray-500">{lead.course_interest}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-gray-500">
                    {Math.floor(lead.age_minutes / 60)}h {Math.floor(lead.age_minutes % 60)}m ago
                  </div>
                  {urgency === 'overdue' && (
                    <div className="text-red-600 font-semibold mt-1">⚠ SLA breach</div>
                  )}
                  {lead.not_reachable_count > 0 && (
                    <div className="text-orange-600 mt-1">
                      {lead.not_reachable_count}× not reachable
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
