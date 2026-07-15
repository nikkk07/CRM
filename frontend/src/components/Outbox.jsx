import { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function Outbox({ onClose }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/outbox`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setMessages(data);
  };

  const handleApprove = async (msgId) => {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/outbox/${msgId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    loadMessages();
  };

  const handleMarkSent = async (msgId) => {
    if (!confirm('Mark this quote as sent?')) return;
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/outbox/${msgId}/sent`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    loadMessages();
  };

  const getWhatsAppLink = (msg) => {
    const pdfUrl = `${API_URL}/api/quotes/${msg.id}/pdf`;
    const text = `Hi ${msg.lead_name},\n\nPlease find your course quote here: ${pdfUrl}\n\nFor any queries, contact us.\n\n- We One Aviation`;
    const phone = msg.lead_phone.replace(/\D/g, '');
    const phoneWith91 = phone.startsWith('91') ? phone : `91${phone}`;
    return `https://wa.me/${phoneWith91}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">Outbox</h2>
            <p className="text-sm text-gray-600">Review quotes before sending via WhatsApp</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className="border-2 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold text-lg">{msg.lead_name}</div>
                  <div className="text-sm text-gray-600">{msg.lead_phone}</div>
                  <div className="text-sm text-gray-600 mt-1">{msg.body}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Created: {new Date(msg.created_at).toLocaleString()}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded text-xs font-semibold ${
                  msg.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  msg.status === 'approved' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {msg.status.toUpperCase()}
                </span>
              </div>

              {msg.pdf_path && (
                <div className="mb-3 p-2 bg-gray-50 rounded">
                  <a
                    href={`${API_URL}/api/quotes/${msg.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm font-semibold"
                  >
                    📄 View Quote PDF
                  </a>
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Review PDF for PLACEHOLDER values before sending
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {msg.status === 'pending' && (
                  <button
                    onClick={() => handleApprove(msg.id)}
                    className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-semibold"
                  >
                    ✓ Approve for Sending
                  </button>
                )}

                {msg.status === 'approved' && (
                  <>
                    <a
                      href={getWhatsAppLink(msg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-green-500 text-white py-2 rounded text-center hover:bg-green-600 font-semibold"
                    >
                      💬 Send via WhatsApp
                    </a>
                    <button
                      onClick={() => handleMarkSent(msg.id)}
                      className="px-4 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm"
                    >
                      Mark as Sent
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              No messages in outbox
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
