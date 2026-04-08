// ===========================================
// Kvittra — Stats Export
// Generera delbar sammanfattning av spelarstatistik
// ===========================================
import { useRef, useState } from 'react';
import './StatsExport.css';

export default function StatsExport({ player, totals, matchCount, advanced }) {
  const [showPreview, setShowPreview] = useState(false);
  const cardRef = useRef(null);

  if (!player || !totals) return null;

  const killPct = totals.attack.total > 0 ? Math.round((totals.attack.pts / totals.attack.total) * 100) : 0;
  const recPct = totals.reception.total > 0 ? Math.round((totals.reception.pos / totals.reception.total) * 100) : 0;
  const attackEff = totals.attack.total > 0 ? Math.round(((totals.attack.pts - totals.attack.err - (totals.attack.blocked || 0)) / totals.attack.total) * 100) : 0;
  const ptsPerMatch = matchCount > 0 ? (totals.totalPts / matchCount).toFixed(1) : '0';

  const handleCopyText = () => {
    const text = `${player.name} #${player.jerseyNumber || '—'} — Säsongsstatistik
${matchCount} matcher

Poäng: ${totals.totalPts} (${ptsPerMatch}/match)
Kill%: ${killPct}% (${totals.attack.pts}/${totals.attack.total})
Angrepp eff: ${attackEff}%
Mottagning+: ${recPct}% (${totals.reception.pos}/${totals.reception.total})
Ess: ${totals.serve.pts}
Block: ${totals.block.pts}
${advanced?.consistency ? `Form: ${advanced.consistency.formLabel} (${advanced.consistency.formTrend > 0 ? '+' : ''}${advanced.consistency.formTrend}%)` : ''}

— Kvittra Sports Analytics`;

    navigator.clipboard.writeText(text).then(() => {
      alert('Statistik kopierad!');
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Statistik kopierad!');
    });
  };

  return (
    <>
      <button className="se-btn" onClick={() => setShowPreview(!showPreview)}>
        {showPreview ? 'Stäng' : 'Dela statistik'}
      </button>

      {showPreview && (
        <div className="se-overlay" onClick={() => setShowPreview(false)}>
          <div className="se-modal" onClick={e => e.stopPropagation()}>
            <div className="se-card" ref={cardRef}>
              <div className="se-card-header">
                <div className="se-card-avatar">
                  {(player.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="se-card-number">#{player.jerseyNumber || '—'}</div>
                  <div className="se-card-name">{player.name}</div>
                </div>
              </div>

              <div className="se-card-stats">
                <div className="se-card-stat">
                  <span className="se-val" style={{ color: '#22c55e' }}>{totals.totalPts}</span>
                  <span className="se-lbl">Poäng</span>
                </div>
                <div className="se-card-stat">
                  <span className="se-val" style={{ color: '#ef4444' }}>{killPct}%</span>
                  <span className="se-lbl">Kill</span>
                </div>
                <div className="se-card-stat">
                  <span className="se-val" style={{ color: '#3b82f6' }}>{recPct}%</span>
                  <span className="se-lbl">Mott+</span>
                </div>
                <div className="se-card-stat">
                  <span className="se-val" style={{ color: '#f59e0b' }}>{attackEff}%</span>
                  <span className="se-lbl">Eff.</span>
                </div>
              </div>

              <div className="se-card-footer">
                {matchCount} matcher · {ptsPerMatch} p/match
                {advanced?.consistency && (
                  <span className="se-form" style={{
                    color: advanced.consistency.formTrend > 10 ? '#22c55e' : advanced.consistency.formTrend < -10 ? '#ef4444' : '#eab308'
                  }}>
                    {' '}· Form: {advanced.consistency.formLabel}
                  </span>
                )}
              </div>

              <div className="se-card-brand">Kvittra</div>
            </div>

            <div className="se-actions">
              <button className="se-action-btn" onClick={handleCopyText}>
                Kopiera som text
              </button>
              <button className="se-action-btn se-action-close" onClick={() => setShowPreview(false)}>
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
