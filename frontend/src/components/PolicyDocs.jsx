import { useState, useEffect } from 'react';

export default function PolicyDocs() {
  const [docs, setDocs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:8000/api/policy-docs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setDocs(data);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    await fetch('http://localhost:8000/api/policy-docs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    setFormData({ title: '', content: '' });
    setShowForm(false);
    loadDocs();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    
    await fetch('http://localhost:8000/api/policy-docs/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    setUploading(false);
    loadDocs();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Policy Documents</h2>
        <div className="flex gap-2">
          <label className="px-3 py-2 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700 text-sm">
            {uploading ? 'Uploading...' : '📄 Upload'}
            <input type="file" onChange={handleUpload} className="hidden" accept=".txt,.md" disabled={uploading} />
          </label>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            + Add
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded shadow mb-4">
          <div className="mb-3">
            <input
              type="text"
              placeholder="Document title"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div className="mb-3">
            <textarea
              placeholder="Document content"
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              className="w-full px-3 py-2 border rounded"
              rows={6}
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-300 rounded">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {docs.map(doc => (
          <div key={doc.id} className="bg-white p-3 rounded shadow">
            <div className="font-semibold">{doc.title}</div>
            <div className="text-sm text-gray-600 mt-1">{doc.content}</div>
            <div className="text-xs text-gray-500 mt-1">
              Added: {new Date(doc.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
