import { useState } from 'react';

export default function PolicyQA({ onClose }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch('http://localhost:8000/api/ai/policy-qa', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
      });
      
      const data = await res.json();
      setAnswer(data);
    } catch (err) {
      console.error('Policy Q&A error:', err);
      setAnswer({ answer: 'Error fetching answer. Please try again.', sources: [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">DGCA Policy Q&A</h2>
          <button onClick={onClose} className="text-2xl text-gray-400">×</button>
        </div>

        <div className="mb-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about DGCA policies or regulations..."
            className="w-full px-3 py-2 border rounded"
            rows={3}
          />
          <button
            onClick={handleAsk}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Asking...' : 'Ask'}
          </button>
        </div>

        {answer && (
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Answer:</h3>
            <p className="whitespace-pre-wrap mb-4">{answer.answer}</p>
            
            {answer.sources && answer.sources.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Sources:</h4>
                <ul className="space-y-1">
                  {answer.sources.map(s => (
                    <li key={s.id} className="text-sm text-gray-600">
                      • {s.title} (similarity: {(s.similarity * 100).toFixed(1)}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
