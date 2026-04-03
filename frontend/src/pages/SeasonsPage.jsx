// ===========================================
// LVC Media Hub — SeasonsPage
// Visar säsonger för ett valt lag
// ===========================================
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { teamApi } from '../utils/api.js';
import './SeasonsPage.css';

export default function SeasonsPage() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const [teamsData, seasonsData] = await Promise.all([
          teamApi.listTeams(),
          teamApi.listSeasons(teamId)
        ]);
        const foundTeam = teamsData.teams.find(t => t.id === parseInt(teamId));
        if (!foundTeam) {
          setError('Laget kunde inte hittas.');
          return;
        }
        setTeam(foundTeam);
        setSeasons(seasonsData.seasons);
      } catch {
        setError('Kunde inte hämta säsonger.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [teamId]);

  if (loading) return <div className="seasons-loading"><div className="spinner" /></div>;
  if (error) return <div className="seasons-error">{error}</div>;

  return (
    <div className="seasons-page">
      <nav className="seasons-breadcrumb">
        <Link to="/">Lag</Link>
        <span className="breadcrumb-sep">›</span>
        <span>{team?.name}</span>
      </nav>

      <h1 className="seasons-title">{team?.name}</h1>

      {seasons.length === 0 ? (
        <div className="seasons-empty">
          <p>Inga säsonger har skapats ännu.</p>
          <p>En admin kan skapa säsonger under <strong>Admin → Lag & Säsonger</strong>.</p>
        </div>
      ) : (
        <div className="seasons-grid">
          {seasons.map(season => (
            <button
              key={season.id}
              className="season-card"
              onClick={() => navigate(`/team/${teamId}/season/${season.id}`)}
            >
              <div className="season-card-name">{season.name}</div>
              <div className="season-card-meta">
                {season._count?.videos ?? 0} matcher
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
