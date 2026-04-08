// ===========================================
// Kvittra — Highlights Reel
// Visar spelarens bästa aktioner (# graded) med videolänkar
// ===========================================
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './HighlightsReel.css';

const SKILL_COLORS = {
  S: '#4CAF50', R: '#2196F3', A: '#F44336',
  B: '#9C27B0', D: '#00BCD4',
};

const SKILL_NAMES = {
  S: 'Serve-ess', R: 'Perfekt mottagning', A: 'Kill',
  B: 'Block-poäng', D: 'Perfekt försvar',
};

export default function HighlightsReel({ matches, maxItems = 10 }) {
  const navigate = useNavigate();

  // Samla alla perfekta aktioner (#) från alla matcher
  const highlights = useMemo(() => {
    if (!matches || matches.length === 0) return [];

    const items = [];
    for (const m of matches) {
      // Vi har inte enskilda actions i match-datan, men vi kan visa match-highlights
      const s = m.stats;
      if (s.attack.pts > 0) {
        items.push({
          videoId: m.videoId,
          opponent: m.opponent,
          matchDate: m.matchDate,
          type: 'A',
          count: s.attack.pts,
          label: `${s.attack.pts} kills`,
        });
      }
      if (s.serve.pts > 0) {
        items.push({
          videoId: m.videoId,
          opponent: m.opponent,
          matchDate: m.matchDate,
          type: 'S',
          count: s.serve.pts,
          label: `${s.serve.pts} ess`,
        });
      }
      if (s.block.pts > 0) {
        items.push({
          videoId: m.videoId,
          opponent: m.opponent,
          matchDate: m.matchDate,
          type: 'B',
          count: s.block.pts,
          label: `${s.block.pts} block`,
        });
      }
    }

    return items
      .sort((a, b) => b.count - a.count)
      .slice(0, maxItems);
  }, [matches, maxItems]);

  if (highlights.length === 0) return null;

  return (
    <div className="hr-container">
      <h3>Höjdpunkter</h3>
      <div className="hr-scroll">
        {highlights.map((h, i) => (
          <div
            key={`${h.videoId}-${h.type}-${i}`}
            className="hr-card"
            onClick={() => navigate(`/video/${h.videoId}`)}
          >
            <div className="hr-icon" style={{ background: SKILL_COLORS[h.type] || '#64748b' }}>
              {h.type === 'A' ? '⚡' : h.type === 'S' ? '🎯' : '🛡️'}
            </div>
            <div className="hr-info">
              <span className="hr-label">{h.label}</span>
              <span className="hr-meta">vs {h.opponent}</span>
            </div>
            <span className="hr-badge" style={{ color: SKILL_COLORS[h.type] }}>{SKILL_NAMES[h.type]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
