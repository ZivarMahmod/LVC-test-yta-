// ===========================================
// LVC Media Hub — TeamsPage
// Startsida som visar tillgängliga lag
// ===========================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamApi } from '../utils/api.js';
import './TeamsPage.css';

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchTeams() {
      try {
        const data = await teamApi.listTeams();
        setTeams(data.teams);
      } catch (err) {
        setError('Kunde inte hämta lag.');
      } finally {
        setLoading(false);
      }
    }
    fetchTeams();
  }, []);

  if (loading) return <div className="teams-loading"><div className="spinner" /></div>;
  if (error) return <div className="teams-error">{error}</div>;

  return (
    <div className="teams-page">
      <h1 className="teams-title">Välj lag</h1>
      {teams.length === 0 ? (
        <div className="teams-empty">
          <p>Inga lag har skapats ännu.</p>
          <p>En admin kan skapa lag under <strong>Admin → Lag & Säsonger</strong>.</p>
        </div>
      ) : (
        <div className="teams-grid">
          {teams.map(team => (
            <button
              key={team.id}
              className="team-card"
              onClick={() => navigate(`/team/${team.id}`)}
            >
              <div className="team-card-icon">🏐</div>
              <div className="team-card-name">{team.name}</div>
              <div className="team-card-meta">
                {team._count?.seasons ?? 0} säsonger &middot; {team._count?.videos ?? 0} matcher
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
