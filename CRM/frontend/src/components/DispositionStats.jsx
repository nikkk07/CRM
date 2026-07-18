import { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function DispositionStats() {
  const [stats, setStats] = useState({
    interested: 0,
    not_interested: 0,
    not_reachable: 0,
    callback: 0
  });
  const [selectedDisposition, setSelectedDisposition] = useState(null);
  const [dispositionData, setDispositionData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/dispositions/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load disposition stats:', err);
    }
  };

  const loadDispositionData = async (disposition) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/dispositions/${disposition}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDispositionData(data);
        setSelectedDisposition(disposition);
      }
    } catch (err) {
      console.error('Failed to load disposition data:', err);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="mb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <button
          onClick={() => loadDispositionData('interested')}
          className="bg-green-100 hover:bg-green-200 border-2 border-green-300 rounded-lg p-4 text-left transition cursor-pointer"
        >
          <div className="text-sm text-green-700 font-semibold">Interested</div>
          <div className="text-3xl font-bold text-green-900">{stats.interested}</div>
        </button>

        <button
          onClick={() => loadDispositionData('not-interested')}
          className="bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg p-4 text-left transition cursor-pointer"
        >
          <div className="text-sm text-gray-700 font-semibold">Not Interested</div>
          <div className="text-3xl font-bold text-gray-900">{stats.not_interested}</div>
        </button>

        <button
          onClick={() => loadDispositionData('not-reachable')}
          className="bg-yellow-100 hover:bg-yellow-200 border-2 border-yellow-300 rounded-lg p-4 text-left transition cursor-pointer"
        >
          <div className="text-sm text-yellow-700 font-semibold">Not Reachable</div>
          <div className="text-3xl font-bold text-yellow-900">{stats.not_reachable}</div>
        </button>

        <button
          onClick={() => loadDispositionData('callback')}
          className="bg-purple-100 hover:bg-purple-200 border-2 border-purple-300 rounded-lg p-4 text-left transition cursor-pointer"
        >
          <div className="text-sm text-purple-700 font-semibold">Callback</div>
          <div className="text-3xl font-bold text-purple-900">{stats.callback}</div>
        </button>
      </div>

      {selectedDisposition && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold capitalize">{selectedDisposition.replace('-', ' ')} Leads</h3>
            <button
              onClick={() => {
                setSelectedDisposition(null);
                setDispositionData([]);
              }}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {dispositionData.map(item => (
                <div key={item.id} className="border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{item.name}</div>
                      <div className="text-sm text-gray-600">{item.phone}</div>
                      <div className="text-sm text-gray-500">{item.course_interest}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      📅 {formatDate(item.marked_at)}
                    </div>
                  </div>
                  
                  {item.note && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700 italic">
                      💬 {item.note}
                    </div>
                  )}
                  
                  {item.callback_reason && (
                    <div className="mt-2 text-sm text-purple-700">
                      🔄 Callback: {item.callback_reason}
                      {item.callback_date && ` (${formatDate(item.callback_date)})`}
                    </div>
                  )}
                </div>
              ))}

              {dispositionData.length === 0 && (
                <div className="text-center py-8 text-gray-500">No leads found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
