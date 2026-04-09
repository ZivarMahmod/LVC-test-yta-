import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOrg } from '../../context/OrgContext.jsx';
import { kvittraApi } from '../../utils/apiSwitch.js';
import './PublicMatchesPage.css';

export default function PublicMatchesPage() {
  const { org } = useOrg();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await kvittraApi.getPublicMatches(org.id);
        if (!cancelled) setMatches(data);
      } catch (err) {
        console.error('Failed to load matches:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [org?.id]);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  if (matches.length === 0) {
    return (
      <div className="public-empty">
        <h2>Inga publicerade matcher</h2>
        <p>Det finns inga publika matcher att visa just nu.</p>
      </div>
    );
  }

  return (
    <div className="public-matches">
      <h1 className="public-matches-title">Matcher</h1>
      <div className="public-matches-grid">
        {matches.map(match => (
          <Link
            key={match.id}
            to={`match/${match.id}`}
            className="public-match-card"
          >
            {match.team?.thumbnail_url ? (
              <img
                src={match.team.thumbnail_url}
                alt={match.team.name}
                className="public-match-thumb"
              />
            ) : (
              <div className="public-match-thumb-placeholder">
                <span>{match.title?.charAt(0) || '?'}</span>
              </div>
            )}
            <div className="public-match-info">
              <h3 className="public-match-title">{match.title}</h3>
              {match.team?.name && (
                <span className="public-match-team">{match.team.name}</span>
              )}
              <span className="public-match-date">
                {match.match_date
                  ? new Date(match.match_date).toLocaleDateString('sv-SE', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })
                  : 'Datum saknas'}
              </span>
              <span className="public-match-type badge">
                {match.match_type === 'scout' ? 'Scout' : 'Match'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
