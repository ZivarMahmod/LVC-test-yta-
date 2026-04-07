import { useState } from 'react';
import { SKILL_COLORS } from '../../utils/scoutConstants.js';
import { formatVideoTime } from '../../utils/format.js';

export default function ScoutActionsList({
  scout, filteredActions, activeActionId, jumpToAction,
  reviewsByAction, expandedReviewAction, setExpandedReviewAction,
  isCoach, setReviewModal,
  ackPassword, setAckPassword, ackLoading, ackError, setAckError, handleAcknowledge,
  SKILL_LETTERS, gradeSymbols,
  // Footer props
  myReviews, showAcknowledged, setShowAcknowledged,
  actionListRef, scoutLoading,
}) {
  return (
    <>
      <div ref={actionListRef} style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
        {scoutLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Laddar scout...</div>
        ) : filteredActions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Inga actions</div>
        ) : (
          filteredActions.map(action => {
            const actionIdx = scout?.actions?.indexOf(action) ?? filteredActions.indexOf(action);
            const actionReviews = reviewsByAction[actionIdx] || [];
            const hasReview = actionReviews.length > 0;
            const isExpanded = expandedReviewAction === actionIdx;

            return (
            <div key={action.id} data-action-id={action.id}>
            <div
              onClick={() => jumpToAction(action)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.6rem', borderRadius: isExpanded ? '6px 6px 0 0' : '6px', cursor: 'pointer',
                marginBottom: isExpanded ? '0' : '2px',
                background: activeActionId === action.id ? 'var(--accent-subtle, rgba(99,102,241,0.15))' : hasReview ? 'rgba(255, 183, 77, 0.08)' : 'transparent',
                border: activeActionId === action.id ? '1px solid var(--accent)' : hasReview ? '1px solid rgba(255, 183, 77, 0.3)' : '1px solid transparent',
                borderBottom: isExpanded ? '1px solid rgba(255, 183, 77, 0.15)' : undefined,
                transition: 'background 0.15s'
              }}
            >
              {/* Skill badge */}
              <span style={{
                width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0,
                background: SKILL_COLORS[action.skill] || '#666',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 'bold', color: '#fff'
              }}>{SKILL_LETTERS[action.skill] || action.skill}</span>

              {/* Grade */}
              <span style={{ fontSize: '0.85rem', width: '16px', textAlign: 'center', color: gradeColor(action.grade) }}>
                {gradeSymbols[action.grade] || action.grade}
              </span>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  #{action.playerNumber} {action.playerName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Set {action.set} · {action.teamName}
                </div>
              </div>

              {/* Tid */}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                {formatVideoTime(action.videoTime)}
              </span>
              {/* Review-bubbla för spelare */}
              {hasReview && (() => {
                const unread = actionReviews.filter(r => !r.acknowledgedAt);
                const allAcked = unread.length === 0;
                return (
                <span
                  onClick={e => {
                    e.stopPropagation();
                    setExpandedReviewAction(isExpanded ? null : actionIdx);
                    setAckPassword('');
                    setAckError('');
                  }}
                  title={allAcked ? 'Bekräftad kommentar' : 'Ny coach-kommentar'}
                  className="review-bubble-icon"
                  style={{
                    fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0,
                    position: 'relative',
                    opacity: allAcked ? 0.6 : 1,
                    animation: !allAcked && !isExpanded ? 'reviewPulse 2s ease-in-out infinite' : 'none'
                  }}
                >
                  {allAcked ? '✅' : '💬'}
                  {unread.length > 1 && (
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-6px',
                      background: '#F44336', color: '#fff', borderRadius: '50%',
                      width: '14px', height: '14px', fontSize: '0.6rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700
                    }}>{unread.length}</span>
                  )}
                </span>
                );
              })()}
              {/* Review-knapp för coach */}
              {isCoach && (
                <span
                  onClick={e => {
                    e.stopPropagation();
                    setReviewModal({ action, actionIndex: actionIdx });
                  }}
                  title="Skicka till spelare"
                  style={{
                    fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0,
                    opacity: 0.6, transition: 'opacity 0.15s'
                  }}
                  onMouseEnter={e => e.target.style.opacity = 1}
                  onMouseLeave={e => e.target.style.opacity = 0.6}
                >📤</span>
              )}
            </div>

            {/* Expanderad kommentarsbubbla */}
            {isExpanded && (
              <div className="review-bubble-container">
                {actionReviews.map(review => (
                  <div key={review.id} className={review.acknowledgedAt ? 'review-bubble review-bubble-acked' : 'review-bubble'}>
                    <div className="review-bubble-header">
                      <span className="review-bubble-coach">{review.coach?.name || 'Coach'}</span>
                      <span className="review-bubble-date">
                        {review.acknowledgedAt
                          ? `✓ Bekräftad ${new Date(review.acknowledgedAt).toLocaleDateString('sv-SE')}`
                          : new Date(review.createdAt).toLocaleDateString('sv-SE')
                        }
                      </span>
                    </div>
                    <div className="review-bubble-comment">{review.comment}</div>
                    {!review.acknowledgedAt && (
                      <>
                        <div className="review-bubble-actions">
                          <input
                            type="password"
                            placeholder="Ditt lösenord..."
                            value={ackPassword}
                            onChange={e => { setAckPassword(e.target.value); setAckError(''); }}
                            onKeyDown={e => {
                              e.stopPropagation();
                              if (e.key === 'Enter') handleAcknowledge(review.id);
                            }}
                            className="review-bubble-pw"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAcknowledge(review.id); }}
                            disabled={ackLoading}
                            className="review-bubble-confirm"
                          >
                            {ackLoading ? '...' : 'Bekräfta'}
                          </button>
                        </div>
                        {ackError && <div className="review-bubble-error">{ackError}</div>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{filteredActions.length} actions</span>
        {myReviews.some(r => r.acknowledgedAt) && (
          <button
            onClick={() => setShowAcknowledged(v => !v)}
            style={{
              padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem',
              border: showAcknowledged ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid var(--border-default)',
              background: showAcknowledged ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
              color: showAcknowledged ? '#4CAF50' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            {showAcknowledged ? '✅ Bekräftade' : '○ Bekräftade'}
          </button>
        )}
      </div>
    </>
  );
}

function gradeColor(grade) {
  if (grade === '#' || grade === '+') return '#4CAF50';
  if (grade === '!') return '#FF9800';
  if (grade === '-' || grade === '/' || grade === '=') return '#F44336';
  return 'var(--text-muted)';
}
