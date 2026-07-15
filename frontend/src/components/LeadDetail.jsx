import { useState } from 'react';
import QuoteGenerator from './QuoteGenerator';

const DISPOSITIONS = [
  'Connected',
  'Not reachable',
  'Wrong number',
  'Interested',
  'Not interested',
  'Callback'
];

export default function LeadDetail({ lead, onClose, onContact }) {
  const [disposition, setDisposition] = useState('');
  const [note, setNote] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupReason, setFollowupReason] = useState('');
  const [showQuoteGen, setShowQuoteGen] = useState(false);
  
  const handleContact = async (channel) => {
    if (!disposition) {
      alert('Select a disposition first');
      return;
    }
    
    await onContact(lead.id, {
      channel,
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
              className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
            >
              📄 Generate Quote
            </button>
          </div>
          
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Contact Lead</h3>
            <div className="flex gap-2 mb-3">
              <a
                href={`tel:${lead.phone}`}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg text-center hover:bg-green-700"
              >
                📞 Call
              </a>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-green-500 text-white py-3 rounded-lg text-center hover:bg-green-600"
              >
                💬 WhatsApp
              </a>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Disposition *</label>
            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map(disp => (
                <button
                  key={disp}
                  onClick={() => setDisposition(disp)}
                  className={`py-2 px-3 rounded border-2 transition ${
                    disposition === disp
                      ? 'border-blue-600 bg-blue-50 font-semibold'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {disp}
                </button>
              ))}
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
            <label className="block text-sm font-semibold mb-1">Notes</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any notes about the conversation..."
              className="w-full px-3 py-2 border rounded"
              rows={3}
            />
          </div>
          
          <button
            onClick={() => handleContact('phone')}
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
