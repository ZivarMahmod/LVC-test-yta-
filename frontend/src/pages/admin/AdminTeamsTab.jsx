import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../utils/apiSwitch.js';

export default function AdminTeamsTab() {
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonTeamId, setNewSeasonTeamId] = useState('');
  const [teamMsg, setTeamMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTeamsAdmin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const teamsData = await adminApi.listTeams();
      setTeams(Array.isArray(teamsData) ? teamsData : (teamsData?.teams || []));
      setNewSeasonTeamId(prev => {
        if (!prev && teamsData.teams.length > 0) return String(teamsData.teams[0].id);
        return prev;
      });
    } catch {
      setError('Kunde inte hämta lag.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTeamsAdmin();
  }, [fetchTeamsAdmin]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      await adminApi.createTeam(newTeamName.trim());
      setNewTeamName('');
      setTeamMsg('Laget skapades!');
      await fetchTeamsAdmin();
      setTimeout(() => setTeamMsg(''), 3000);
    } catch (err) {
      setTeamMsg(err.message);
    }
  };

  const handleDeleteTeam = async (id, name) => {
    if (!confirm(`Ta bort "${name}"? Alla säsonger för laget tas också bort.`)) return;
    try {
      await adminApi.deleteTeam(id);
      await fetchTeamsAdmin();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateSeason = async () => {
    if (!newSeasonName.trim() || !newSeasonTeamId) return;
    try {
      await adminApi.createSeason(newSeasonName.trim(), parseInt(newSeasonTeamId));
      setNewSeasonName('');
      setTeamMsg('Säsongen skapades!');
      await fetchTeamsAdmin();
      setTimeout(() => setTeamMsg(''), 3000);
    } catch (err) {
      setTeamMsg(err.message);
    }
  };

  const handleDeleteSeason = async (id, name) => {
    if (!confirm(`Ta bort säsongen "${name}"?`)) return;
    try {
      await adminApi.deleteSeason(id);
      await fetchTeamsAdmin();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="admin-section">
      {error && <div className="alert alert-error">{error}</div>}
      <h2>Lag & Säsonger</h2>
      {teamMsg && <div className="alert alert-success">{teamMsg}</div>}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <>
          {/* Skapa lag och säsong */}
          <div className="teams-admin-grid">
            <div className="teams-admin-col">
              <h3>Skapa lag</h3>
              <div className="inline-form">
                <input
                  type="text"
                  placeholder="t.ex. LVC Dam"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                />
                <button className="btn-gold" onClick={handleCreateTeam}>Skapa</button>
              </div>
              <div className="teams-list">
                {teams.map(team => (
                  <div key={team.id} className="teams-admin-item">
                    <div>
                      <strong>{team.name}</strong>
                      <span className="text-muted"> — {team._count?.seasons ?? 0} säsonger, {team._count?.videos ?? 0} matcher</span>
                    </div>
                    <button className="btn-danger btn-sm" onClick={() => handleDeleteTeam(team.id, team.name)}>Ta bort</button>
                  </div>
                ))}
                {teams.length === 0 && <p className="text-muted">Inga lag ännu.</p>}
              </div>
            </div>

            <div className="teams-admin-col">
              <h3>Skapa säsong</h3>
              <div className="inline-form">
                <select value={newSeasonTeamId} onChange={e => setNewSeasonTeamId(e.target.value)}>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="t.ex. 25/26"
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateSeason()}
                />
                <button className="btn-gold" onClick={handleCreateSeason}>Skapa</button>
              </div>
              <div className="teams-list">
                {teams.flatMap(team =>
                  (team.seasons || []).map(season => (
                    <div key={`${team.id}-${season.id}`} className="teams-admin-item">
                      <div>
                        <strong>{season.name}</strong>
                        <span className="text-muted"> — {team.name}</span>
                      </div>
                      <button className="btn-danger btn-sm" onClick={() => handleDeleteSeason(season.id, season.name)}>Ta bort</button>
                    </div>
                  ))
                )}
                {teams.every(t => (t.seasons || []).length === 0) && <p className="text-muted">Inga säsonger ännu.</p>}
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
