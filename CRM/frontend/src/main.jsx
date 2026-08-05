import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// NOTE: React.StrictMode intentionally double-invokes effects/mounts in dev,
// which made every data-fetching useEffect fire TWICE (duplicate GET /api/leads,
// GET /api/followups/pending, etc. seen in the backend logs). Rendering without
// it so each page load issues each request exactly once.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
