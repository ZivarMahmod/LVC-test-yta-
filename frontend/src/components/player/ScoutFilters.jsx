import { SKILL_COLORS } from '../../utils/scoutConstants.js';

export default function ScoutFilters({
  isAdmin, scout, filtersOpen,
  offsetInput, setOffsetInput, onSaveOffset,
  filterSet, setFilterSet, uniqueSets,
  filterTeam, setFilterTeam,
  filterStartZone, setFilterStartZone,
  filterEndZone, setFilterEndZone,
  filterPlayer, setFilterPlayer, uniquePlayers,
  preRoll, setPreRoll,
  skipSeconds, setSkipSeconds,
  filterSkill, setFilterSkill, uniqueSkills,
  filterGrade, setFilterGrade,
  SKILL_NAMES, SKILL_LETTERS,
  gradeSymbols,
}) {
  return (
    <div className={filtersOpen ? 'scout-filters scout-filters-open' : 'scout-filters'}>

      {/* Offset (admin) */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Offset (sek):</span>
          <input
            type="number"
            value={offsetInput}
            onChange={e => setOffsetInput(e.target.value)}
            style={{
              width: '70px', padding: '0.25rem 0.5rem', borderRadius: '6px',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: '0.85rem'
            }}
          />
          <button
            onClick={onSaveOffset}
            style={{
              padding: '0.25rem 0.75rem', borderRadius: '6px',
              background: 'var(--accent)', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: '0.8rem'
            }}
          >
            Spara
          </button>
        </div>
      )}

      {/* Filter: Set + Lag + Zoner — kompakt rad */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
        <select
          value={filterSet}
          onChange={e => setFilterSet(e.target.value)}
          style={{
            flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--text)', fontSize: '0.78rem'
          }}
        >
          <option value="ALL">Set</option>
          {uniqueSets.map(s => <option key={s} value={String(s)}>Set {s}</option>)}
        </select>
        {scout && (
          <select
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            style={{
              flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: '0.78rem'
            }}
          >
            <option value="ALL">Lag</option>
            <option value="H">{scout.teams?.H || 'Hemma'}</option>
            <option value="V">{scout.teams?.V || 'Borta'}</option>
          </select>
        )}
        <select
          value={filterStartZone}
          onChange={e => setFilterStartZone(e.target.value)}
          style={{
            flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--text)', fontSize: '0.78rem'
          }}
        >
          <option value="ALL">Från</option>
          {[1,2,3,4,5,6,7,8,9].map(z => <option key={z} value={String(z)}>Z{z}</option>)}
        </select>
        <select
          value={filterEndZone}
          onChange={e => setFilterEndZone(e.target.value)}
          style={{
            flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--text)', fontSize: '0.78rem'
          }}
        >
          <option value="ALL">Till</option>
          {[1,2,3,4,5,6,7,8,9].map(z => <option key={z} value={String(z)}>Z{z}</option>)}
        </select>
      </div>

      {/* Pre/Skip + Spelare */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', alignItems: 'center' }}>
        <select
          value={filterPlayer}
          onChange={e => setFilterPlayer(e.target.value)}
          style={{
            flex: 1, padding: '0.3rem 0.4rem', borderRadius: '6px',
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--text)', fontSize: '0.78rem'
          }}
        >
          <option value="ALL">Spelare</option>
          {uniquePlayers.map(({ number, team }) => {
            const key = team + '-' + number;
            const p = scout.players.find(pl => parseInt(pl.number, 10) === number && pl.team === team);
            const teamName = scout.teams?.[team] || team;
            return <option key={key} value={key}>#{number} {p ? p.name : ''} ({teamName})</option>;
          })}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pre</span>
          <select
            value={preRoll}
            onChange={e => setPreRoll(Number(e.target.value))}
            style={{ padding: '0.15rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.75rem' }}
          >
            {[0,2,3,5].map(s => <option key={s} value={s}>{s}s</option>)}
          </select>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Skip</span>
          <select
            value={skipSeconds}
            onChange={e => setSkipSeconds(Number(e.target.value))}
            style={{ padding: '0.15rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.75rem' }}
          >
            {[1,2,5,10,30].map(s => <option key={s} value={s}>{s}s</option>)}
          </select>
        </div>
      </div>

      {/* Filter: Skill — pill-knappar */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.25rem', alignItems: 'center' }}>
        {[{ key: 'ALL', label: 'Alla', color: '#94a3b8' }, ...uniqueSkills.map(s => ({ key: s, label: SKILL_NAMES[s] || s, color: SKILL_COLORS[s] || '#666' }))].map(sk => {
          const isActive = filterSkill === sk.key;
          return (
            <button
              key={sk.key}
              onClick={() => setFilterSkill(sk.key)}
              title={sk.label}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '12px',
                border: `1.5px solid ${isActive ? sk.color : 'transparent'}`,
                background: isActive ? `${sk.color}22` : 'var(--surface-2)',
                color: isActive ? sk.color : 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: isActive ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {isActive ? sk.label : (sk.key === 'ALL' ? 'Alla' : (SKILL_LETTERS[sk.key] || sk.key))}
            </button>
          );
        })}
      </div>

      {/* Filter: Grade — symboler, text visas vid vald */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem', alignItems: 'center' }}>
        <button onClick={() => setFilterGrade('ALL')} style={{...filterBtnStyle(filterGrade === 'ALL'), minWidth: 'auto', padding: '0.25rem 0.4rem'}} title="Alla">◆{filterGrade === 'ALL' ? ' Alla' : ''}</button>
        {[
          { key: '#', symbol: gradeSymbols['#'], label: 'Perfekt', color: '#4CAF50' },
          { key: '+', symbol: gradeSymbols['+'], label: 'Positiv', color: '#4CAF50' },
          { key: '!', symbol: gradeSymbols['!'], label: 'OK', color: '#FF9800' },
          { key: '-', symbol: gradeSymbols['-'], label: 'Negativ', color: '#F44336' },
          { key: 'ERR', symbol: gradeSymbols['/'], label: 'Error', color: '#F44336' },
        ].map(g => (
          <button
            key={g.key}
            onClick={() => setFilterGrade(filterGrade === g.key ? 'ALL' : g.key)}
            title={g.label}
            style={{
              ...filterBtnStyle(filterGrade === g.key),
              color: g.color,
              minWidth: 'auto',
              padding: '0.25rem 0.4rem',
            }}
          >
            {g.symbol}{filterGrade === g.key ? ` ${g.label}` : ''}
          </button>
        ))}
      </div>

    </div>
  );
}

function filterBtnStyle(active) {
  return {
    padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--text-muted)',
    cursor: 'pointer', fontSize: '0.78rem'
  };
}
