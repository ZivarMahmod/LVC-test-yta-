// ===========================================
// Kvittra — Global Search (Ctrl+K)
// Sök spelare, matcher, lag
// ===========================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './GlobalSearch.css';

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Ctrl+K öppnar sök
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (!open) { setQuery(''); setResults([]); }
  }, [open]);

  // Sök
  const search = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      // Sök i videor
      const res = await fetch(`/api/videos?search=${encodeURIComponent(q)}&limit=5`, { credentials: 'include' });
      const data = res.ok ? await res.json() : { videos: [] };

      const items = [];

      // Matcher
      for (const v of (data.videos || [])) {
        items.push({
          type: 'match',
          label: v.title || v.opponent,
          sub: new Date(v.matchDate).toLocaleDateString('sv-SE'),
          url: `/video/${v.id}`,
          icon: '🎥',
        });
      }

      // Spelare-sök (enkel — baserat på motståndarnamn som proxy)
      if (items.length === 0) {
        items.push({
          type: 'hint',
          label: `Inga resultat för "${q}"`,
          sub: 'Sök på motståndarnamn eller match-titel',
          icon: '🔍',
        });
      }

      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (item) => {
    if (item.url) {
      navigate(item.url);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="gs-overlay" onClick={() => setOpen(false)}>
      <div className="gs-modal" onClick={e => e.stopPropagation()}>
        <div className="gs-input-wrap">
          <span className="gs-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Sök matcher, motståndare..."
            className="gs-input"
          />
          <kbd className="gs-kbd">ESC</kbd>
        </div>

        {results.length > 0 && (
          <div className="gs-results">
            {results.map((r, i) => (
              <div
                key={i}
                className={`gs-result ${r.type === 'hint' ? 'gs-result--hint' : ''}`}
                onClick={() => handleSelect(r)}
              >
                <span className="gs-result-icon">{r.icon}</span>
                <div className="gs-result-info">
                  <span className="gs-result-label">{r.label}</span>
                  <span className="gs-result-sub">{r.sub}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && <div className="gs-loading">Söker...</div>}
      </div>
    </div>
  );
}
