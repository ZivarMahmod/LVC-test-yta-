// ===========================================
// LVC Media Hub — TeamsPage
// Startsida som visar tillgängliga lag
// ===========================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamApi, teamAdminApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import React from 'react';
import './TeamsPage.css';

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAdmin } = useAuth();
  const thumbInputRef = React.useRef(null);
  const [thumbTeamId, setThumbTeamId] = React.useState(null);

  const handleThumbUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !thumbTeamId) return;
    try {
      await teamAdminApi.uploadThumbnail(thumbTeamId, file);
      const data = await teamApi.listTeams();
      setTeams(data.teams);
    } catch {}
    setThumbTeamId(null);
    if (thumbInputRef.current) thumbInputRef.current.value = '';
  };
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchTeams() {
      try {
        const data = await teamApi.listTeams();
        setTeams(data.teams);
      } catch {
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
      <input type="file" ref={thumbInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleThumbUpload} />
      <h1 className="teams-title">Välj lag</h1>
      {teams.length === 0 ? (
        <div className="teams-empty">
          <div className="teams-onboarding">
            <h2>Välkommen till LVC Media Hub</h2>
            <p>Kom igång med volleybollanalys i 3 steg:</p>
            <div className="teams-steps">
              <div className="teams-step" onClick={() => isAdmin && navigate('/admin')}>
                <span className="teams-step-num">1</span>
                <div>
                  <strong>Skapa lag & säsong</strong>
                  <p>Gå till Admin → Lag & Säsonger</p>
                </div>
              </div>
              <div className="teams-step" onClick={() => navigate('/upload')}>
                <span className="teams-step-num">2</span>
                <div>
                  <strong>Ladda upp en match</strong>
                  <p>Video + DVW scout-fil</p>
                </div>
              </div>
              <div className="teams-step">
                <span className="teams-step-num">3</span>
                <div>
                  <strong>Analysera</strong>
                  <p>Heatmaps, statistik, spelarjämförelse</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="teams-grid">
          {teams.map(team => (
            <button
              key={team.id}
              className="team-card-overlay"
              onClick={() => navigate(`/team/${team.id}`)}
            >
              {team.thumbnailPath ? (
                <img className="team-card-img" src={'/api/team-thumbnail/' + team.thumbnailPath.replace('/teams/', '')} alt={team.name} />
              ) : (
                <div className="team-card-bg" />
              )}
              <div className="team-card-gradient" />
              <div className="team-card-content">
                <div className="team-card-name">{team.name}</div>
                <div className="team-card-meta">
                  {team._count?.seasons ?? 0} säsonger · {team._count?.videos ?? 0} matcher
                </div>
              </div>
              {isAdmin && (
                <div className="team-card-upload" onClick={(e) => { e.stopPropagation(); setThumbTeamId(team.id); thumbInputRef.current?.click(); }}>
                  📷
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
