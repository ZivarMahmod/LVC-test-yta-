// ===========================================
// LVC Media Hub — ReviewPanel
// Draggbar panel för att skicka coach-reviews
// ===========================================
import React, { useState, useEffect, useRef } from 'react';

export default function ReviewPanel({
  reviewModal,
  onClose,
  reviewPlayers,
  onSendReview,
  reviewLoading
}) {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [comment, setComment] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [minimized, setMinimized] = useState(false);

  // Draggbar position
  const [pos, setPos] = useState({ x: 20, y: 80 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Auto-matcha spelare vid öppning
  useEffect(() => {
    if (!reviewModal) return;
    const allPlayers = reviewPlayers.flatMap(t => t.players);
    const match = allPlayers.find(p =>
      (reviewModal.action.playerNumber && p.jerseyNumber === reviewModal.action.playerNumber) ||
      p.name.toLowerCase().includes(reviewModal.action.playerName?.toLowerCase() || '')
    );
    setSelectedPlayers(match ? [match.id] : []);
    setComment('');
    setError('');
    setSuccess('');
    setPlayerSearch('');
  }, [reviewModal, reviewPlayers]);

  const handleSend = async () => {
    setError('');
    setSuccess('');
    if (!selectedPlayers.length) return setError('Välj minst en spelare');
    if (!comment.trim()) return setError('Skriv en kommentar');

    const result = await onSendReview({
      actionIndex: reviewModal.actionIndex,
      playerIds: selectedPlayers,
      comment: comment.trim()
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Skickat!');
      setTimeout(() => onClose(), 1500);
    }
  };

  if (!reviewModal) return null;

  const allPlayers = reviewPlayers.flatMap(t => t.players.map(p => ({ ...p, teamName: t.team.name })));
  const autoMatched = allPlayers.filter(p => selectedPlayers.includes(p.id));
  const hasAutoMatch = autoMatched.length > 0;
  const searchResults = playerSearch
    ? allPlayers.filter(p =>
        !selectedPlayers.includes(p.id) && (
          p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
          (p.jerseyNumber && String(p.jerseyNumber).includes(playerSearch))
        )
      ).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y,
      zIndex: 9999, width: 320, userSelect: 'none'
    }}>
      <div style={{
        background: 'rgba(15, 15, 30, 0.95)', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(8px)', overflow: 'hidden'
      }}>
        {/* Drag-bar */}
        <div
          onMouseDown={(e) => {
            dragging.current = true;
            dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            e.preventDefault();
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', cursor: 'grab', background: 'rgba(99,102,241,0.2)',
            borderBottom: minimized ? 'none' : '1px solid var(--border)'
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>Skicka till spelare</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setMinimized(m => !m)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, padding: '0 4px' }}
            >{minimized ? '+' : '-'}</button>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={onClose}
              aria-label="Stäng panel"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, padding: '0 4px' }}
            >x</button>
          </div>
        </div>

        {/* Innehåll */}
        {!minimized && <div style={{ padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            Action #{reviewModal.actionIndex + 1} · {reviewModal.action.skill} · #{reviewModal.action.playerNumber} {reviewModal.action.playerName}
          </p>

          {reviewPlayers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Inga spelare kopplade till ditt lag ännu.</p>
          ) : (
            <>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Välj spelare</label>
              {/* Auto-matchade */}
              {autoMatched.map(player => (
                <div key={player.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', borderRadius: 6,
                  background: 'var(--accent-subtle, rgba(99,102,241,0.15))',
                  border: '1px solid var(--accent)',
                  marginBottom: 3
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--accent)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0
                  }}>
                    {player.jerseyNumber ? `${player.jerseyNumber}` : player.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                    {player.jerseyNumber ? `#${player.jerseyNumber} · ` : ''}{player.name}
                  </span>
                  <button
                    onClick={() => setSelectedPlayers(p => p.filter(id => id !== player.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                  >x</button>
                </div>
              ))}
              {/* Sökfält */}
              <input
                type="text"
                placeholder={hasAutoMatch ? "Lägg till fler spelare..." : "Sök på namn eller nummer..."}
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: 13, marginTop: 8, marginBottom: 4,
                  boxSizing: 'border-box'
                }}
              />
              {/* Sökresultat */}
              {searchResults.map(player => (
                <div key={player.id}
                  onClick={() => { setSelectedPlayers(p => [...p, player.id]); setPlayerSearch(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    marginBottom: 4
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--accent)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0
                  }}>
                    {player.jerseyNumber ? `#${player.jerseyNumber}` : player.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{player.jerseyNumber ? `#${player.jerseyNumber} · ` : ''}{player.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{player.teamName}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>+ Lägg till</span>
                </div>
              ))}
              {playerSearch && searchResults.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 8px' }}>Inga spelare hittades</p>
              )}
            </>
          )}

          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', margin: '12px 0 6px' }}>Kommentar</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Skriv din feedback till spelaren..."
            rows={4}
            style={{
              width: '100%', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              padding: '8px 12px', fontSize: 14, resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />

          {error && <p style={{ color: 'var(--error, #f44336)', fontSize: 13, marginTop: 8 }}>{error}</p>}
          {success && <p style={{ color: 'var(--success, #4caf50)', fontSize: 13, marginTop: 8 }}>{success}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={handleSend}
              disabled={reviewLoading}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 600,
                cursor: reviewLoading ? 'not-allowed' : 'pointer', fontSize: 14
              }}
            >
              {reviewLoading ? 'Skickar...' : 'Skicka'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14
              }}
            >
              Avbryt
            </button>
          </div>
        </div>}
      </div>
    </div>
  );
}
