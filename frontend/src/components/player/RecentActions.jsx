// ===========================================
// Kvittra — Senaste Actions
// De 5 senaste aktionerna med videolänk
// ===========================================
import { useNavigate } from 'react-router-dom';
import './RecentActions.css';

const SKILL_COLORS = {
  S: '#4CAF50', R: '#2196F3', P: '#FF9800',
  A: '#F44336', B: '#9C27B0', D: '#00BCD4',
  G: '#607D8B', O: '#795548',
};

const SKILL_NAMES = {
  S: 'Serve', R: 'Mottagning', P: 'Pass',
  A: 'Angrepp', B: 'Block', D: 'Försvar',
  G: 'Gratisboll', O: 'Övrigt',
};

const GRADE_DISPLAY = {
  '#': { symbol: '●', color: '#22c55e', label: 'Perfekt' },
  '+': { symbol: '▲', color: '#3b82f6', label: 'Positiv' },
  '!': { symbol: '■', color: '#f59e0b', label: 'OK' },
  '-': { symbol: '▼', color: '#ef4444', label: 'Negativ' },
  '/': { symbol: '✕', color: '#ef4444', label: 'Fel' },
  '=': { symbol: '✕', color: '#ef4444', label: 'Fel' },
};

export default function RecentActions({ matches }) {
  const navigate = useNavigate();

  if (!matches || matches.length === 0) return null;

  // Samla de senaste matcherna (max 3) och visa actions-summary
  const recent = matches.slice(0, 3);

  return (
    <div className="ra-container">
      <h3>Senaste matcher</h3>
      <div className="ra-list">
        {recent.map(m => (
          <div
            key={m.videoId}
            className="ra-match"
            onClick={() => navigate(`/video/${m.videoId}`)}
          >
            <div className="ra-match-header">
              <span className="ra-date">{new Date(m.matchDate).toLocaleDateString('sv-SE')}</span>
              <span className="ra-opponent">vs {m.opponent}</span>
              <span className="ra-pts">{m.stats.totalPts} poäng</span>
            </div>
            <div className="ra-stats-row">
              {m.stats.attack.total > 0 && (
                <span className="ra-mini-stat">
                  <span className="ra-dot" style={{ background: SKILL_COLORS.A }} />
                  {m.stats.attack.pts}/{m.stats.attack.total} kill
                </span>
              )}
              {m.stats.reception.total > 0 && (
                <span className="ra-mini-stat">
                  <span className="ra-dot" style={{ background: SKILL_COLORS.R }} />
                  {m.stats.reception.total > 0 ? Math.round((m.stats.reception.pos / m.stats.reception.total) * 100) : 0}% mott
                </span>
              )}
              {m.stats.serve.pts > 0 && (
                <span className="ra-mini-stat">
                  <span className="ra-dot" style={{ background: SKILL_COLORS.S }} />
                  {m.stats.serve.pts} ess
                </span>
              )}
              {m.stats.block.pts > 0 && (
                <span className="ra-mini-stat">
                  <span className="ra-dot" style={{ background: SKILL_COLORS.B }} />
                  {m.stats.block.pts} block
                </span>
              )}
            </div>
            <div className="ra-go">Se match →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
