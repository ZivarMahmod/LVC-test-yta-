// ===========================================
// Kvittra — Publik Vy
// Publicerade matcher synliga utan inloggning
// ===========================================
import { useState, useEffect } from 'react';
import './PublicMatchesPage.css';

export default function PublicMatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);

  useEffect(() => {
    fetch('/api/public/matches')
      .then(res => res.ok ? res.json() : { matches: [] })
      .then(data => setMatches(data.matches || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="pub-page">
      <div className="pub-loading"><div className="spinner" /></div>
    </div>
  );

  return (
    <div className="pub-page">
      <header className="pub-header">
        <div className="pub-logo">K</div>
        <h1>Kvittra</h1>
        <p>Sports Video Analysis</p>
      </header>

      {selectedMatch ? (
        <div className="pub-player-view">
          <button className="pub-back" onClick={() => setSelectedMatch(null)}>Tillbaka</button>
          <h2>{selectedMatch.title}</h2>
          <p className="pub-date">{new Date(selectedMatch.matchDate).toLocaleDateString('sv-SE')}</p>
          {selectedMatch.streamUrl ? (
            <video
              className="pub-video"
              src={selectedMatch.streamUrl}
              controls
              autoPlay
            />
          ) : (
            <div className="pub-no-video">Video ej tillgänglig</div>
          )}
        </div>
      ) : (
        <>
          {matches.length === 0 ? (
            <div className="pub-empty">
              <h2>Inga publicerade matcher</h2>
              <p>Kontakta din klubbadmin för att publicera matcher.</p>
            </div>
          ) : (
            <div className="pub-grid">
              {matches.map(m => (
                <div
                  key={m.id}
                  className="pub-card"
                  onClick={() => setSelectedMatch(m)}
                >
                  <div className="pub-card-thumb">
                    {m.thumbnailUrl ? (
                      <img src={m.thumbnailUrl} alt={m.title} />
                    ) : (
                      <div className="pub-card-placeholder">
                        <span>▶</span>
                      </div>
                    )}
                  </div>
                  <div className="pub-card-info">
                    <h3>{m.title}</h3>
                    <span className="pub-card-date">
                      {new Date(m.matchDate).toLocaleDateString('sv-SE')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <footer className="pub-footer">
        <p>Powered by <strong>Kvittra</strong></p>
        <a href="/login">Logga in</a>
      </footer>
    </div>
  );
}
