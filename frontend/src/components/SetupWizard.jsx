// ===========================================
// Kvittra — Setup Wizard
// Guidar admin genom första konfigurationen
// ===========================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../utils/api.js';

export default function SetupWizard({ onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [createdTeamId, setCreatedTeamId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return setError('Ange ett lagnamn');
    setError('');
    setLoading(true);
    try {
      const res = await adminApi.createTeam(teamName.trim());
      setCreatedTeamId(res.team?.id || res.id);
      setStep(2);
    } catch (e) {
      setError(e.message || 'Kunde inte skapa lag');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeason = async () => {
    if (!seasonName.trim()) return setError('Ange ett säsongsnamn');
    if (!createdTeamId) return setError('Inget lag skapat');
    setError('');
    setLoading(true);
    try {
      await adminApi.createSeason(seasonName.trim(), createdTeamId);
      setStep(3);
    } catch (e) {
      setError(e.message || 'Kunde inte skapa säsong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: 480, margin: '40px auto', padding: 32,
      background: '#1e293b', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: s <= step ? '#3b82f6' : '#334155',
            transition: 'background 0.3s'
          }} />
        ))}
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5', padding: '8px 12px', borderRadius: 8,
          fontSize: 13, marginBottom: 16
        }}>{error}</div>
      )}

      {step === 1 && (
        <>
          <h2 style={{ fontSize: 22, margin: '0 0 8px', color: '#f1f5f9' }}>Skapa ditt lag</h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>
            Vad heter laget? T.ex. "LVC Herr" eller "Malmö VBK Dam"
          </p>
          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Lagnamn"
            onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
            autoFocus
            style={{
              width: '100%', padding: '12px 14px', background: '#0f172a',
              border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9',
              fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 12
            }}
          />
          <button
            onClick={handleCreateTeam}
            disabled={loading || !teamName.trim()}
            style={{
              width: '100%', padding: 12, background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: 'pointer', opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Skapar...' : 'Skapa lag'}
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 style={{ fontSize: 22, margin: '0 0 8px', color: '#f1f5f9' }}>Skapa säsong</h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>
            Vilken säsong? T.ex. "25/26" eller "2025/2026"
          </p>
          <input
            type="text"
            value={seasonName}
            onChange={e => setSeasonName(e.target.value)}
            placeholder="Säsongsnamn"
            onKeyDown={e => e.key === 'Enter' && handleCreateSeason()}
            autoFocus
            style={{
              width: '100%', padding: '12px 14px', background: '#0f172a',
              border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9',
              fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 12
            }}
          />
          <button
            onClick={handleCreateSeason}
            disabled={loading || !seasonName.trim()}
            style={{
              width: '100%', padding: 12, background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: 'pointer', opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Skapar...' : 'Skapa säsong'}
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, margin: '0 0 8px', color: '#f1f5f9' }}>Klart!</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 24px' }}>
              <strong>{teamName}</strong> med säsong <strong>{seasonName}</strong> har skapats.
              Nu kan du ladda upp din första match.
            </p>
            <button
              onClick={() => navigate('/upload')}
              style={{
                width: '100%', padding: 12, background: '#22c55e', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
                cursor: 'pointer', marginBottom: 8
              }}
            >
              Ladda upp match
            </button>
            <button
              onClick={() => { if (onComplete) onComplete(); }}
              style={{
                width: '100%', padding: 10, background: 'transparent', color: '#64748b',
                border: '1px solid #334155', borderRadius: 10, fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Gör senare
            </button>
          </div>
        </>
      )}
    </div>
  );
}
