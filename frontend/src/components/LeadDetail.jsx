import { useState } from 'react';
import QuoteGenerator from './QuoteGenerator';

export default function LeadDetail({ lead, onClose, onContact }) {
  const [disposition, setDisposition] = useState('');
  const [note, setNote] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupReason, setFollowupReason] = useState('');
  const [showQuoteGen, setShowQuoteGen] = useState(false);
  
  const handleSave = async () => {
    if (!disposition) {
      alert('Select a disposition first');
      return;
    }
    
    await onContact(lead.id, {
      channel: 'phone',
      disposition,
      note
    });
    
    if (disposition === 'Callback' && followupDate) {
      await onContact(lead.id, {
        followup: true,
        due_date: followupDate,
        reason: followupReason
      });
    }
    
    setDisposition('');
    setNote('');
    onClose();
  };
  
  const waLink = `https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hello ' + lead.name + ', this is We One Aviation regarding your enquiry.')}`;
  
  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{lead.name}</h2>
              <p className="text-gray-600">{lead.phone}</p>
              <p className="text-gray-500">{lead.email}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="mb-6 space-y-2 text-sm">
            <div><span className="font-semibold">Course:</span> {lead.course_interest}</div>
            <div><span className="font-semibold">Address:</span> {lead.address || 'N/A'}</div>
            {lead.utm_source && (
              <div>
                <span className="font-semibold">Source:</span> {lead.utm_source} / {lead.utm_medium} / {lead.utm_campaign}
              </div>
            )}
            <div>
              <span className="font-semibold">Status:</span> {lead.status}
              {lead.first_contacted_at && <span className="ml-2 text-green-600">✓ Contacted</span>}
            </div>
          </div>
          
          <div className="mb-4">
            <button
              onClick={() => setShowQuoteGen(true)}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700"
            >
              📄 Generate Quote
            </button>
          </div>
          
          <div className="mb-4">
            <h3 className="font-semibold mb-3 text-lg">Contact Lead</h3>
            <div className="flex gap-3 mb-4">
              <a
                href={`tel:${lead.phone}`}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg text-center hover:bg-green-700 font-semibold"
              >
                📞 Call
              </a>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-green-500 text-white py-3 rounded-lg text-center hover:bg-green-600 font-semibold"
              >
                💬 WhatsApp
              </a>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Mark as *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDisposition('Interested')}
                className={`py-3 px-3 rounded-lg border-2 transition font-semibold ${
                  disposition === 'Interested'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:border-green-400'
                }`}
              >
                ✓ Interested
              </button>
              <button
                onClick={() => setDisposition('Not interested')}
                className={`py-3 px-3 rounded-lg border-2 transition font-semibold ${
                  disposition === 'Not interested'
                    ? 'border-gray-600 bg-gray-50 text-gray-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                ✗ Not Interested
              </button>
              <button
                onClick={() => setDisposition('Not reachable')}
                className={`py-3 px-3 rounded-lg border-2 transition font-semibold ${
                  disposition === 'Not reachable'
                    ? 'border-yellow-600 bg-yellow-50 text-yellow-700'
                    : 'border-gray-300 hover:border-yellow-400'
                }`}
              >
                📵 Not Reachable
              </button>
              <button
                onClick={() => setDisposition('Callback')}
                className={`py-3 px-3 rounded-lg border-2 transition font-semibold ${
                  disposition === 'Callback'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                🔄 Callback
              </button>
            </div>
          </div>
          
          {disposition === 'Callback' && (
            <div className="mb-4 p-3 bg-yellow-50 rounded">
              <label className="block text-sm font-semibold mb-1">Follow-up Date</label>
              <input
                type="datetime-local"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-2"
              />
              <label className="block text-sm font-semibold mb-1">Reason</label>
              <input
                type="text"
                value={followupReason}
                onChange={(e) => setFollowupReason(e.target.value)}
                placeholder="e.g., Student wanted callback after 3pm"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Notes (will show in lead list)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add notes about the conversation..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          
          <button
            onClick={handleSave}
            disabled={!disposition}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Save Contact Attempt
          </button>
        </div>
      </div>

      {showQuoteGen && (
        <QuoteGenerator lead={lead} onClose={() => setShowQuoteGen(false)} />
      )}
    </>
  );
}
