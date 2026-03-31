import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function InboxPage() {
  const { user, isCoach } = useAuth();
  const navigate = useNavigate();

  return isCoach ? <CoachInbox /> : <PlayerInbox />;
}

// =====================
// SPELARENS INBOX
// =====================
function PlayerInbox() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchInbox(); }, []);

  async function fetchInbox() {
    try {
      const res = await fetch("/api/reviews/inbox", { credentials: "include" });
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleAcknowledge(reviewId) {
    setError(""); setSuccess("");
    if (!password) return setError("Ange ditt lösenord");
    try {
      const csrfRes = await fetch('/api/auth/csrf-token', { credentials: 'include' });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`/api/reviews/${reviewId}/acknowledge`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Fel uppstod");
      setSuccess("Bekräftad!"); setPassword(""); setAcknowledging(null);
      fetchInbox();
    } catch { setError("Serverfel"); }
  }

  const unread = reviews.filter(r => !r.acknowledgedAt);
  const read = reviews.filter(r => r.acknowledgedAt);

  if (loading) return <div style={{ padding: 32, color: "var(--text-secondary)", textAlign: "center" }}>Laddar inbox...</div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>📬 Inbox</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>Coachens feedback till dig</p>

      {reviews.length === 0 && (
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
          Inga reviews ännu
        </div>
      )}

      {unread.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 10 }}>
            Olästa ({unread.length})
          </div>
          {unread.map(r => (
            <ReviewCard key={r.id} review={r}
              onGoTo={() => navigate(`/video/${r.videoId}?actionIndex=${r.actionIndex}`)}
              onAcknowledge={() => { setAcknowledging(r.id); setError(""); setSuccess(""); setPassword(""); }}
              acknowledging={acknowledging === r.id}
              password={password} setPassword={setPassword}
              onConfirm={() => handleAcknowledge(r.id)}
              onCancel={() => { setAcknowledging(null); setPassword(""); setError(""); }}
              error={error} success={success}
            />
          ))}
        </div>
      )}

      {read.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 10 }}>
            Bekräftade ({read.length})
          </div>
          {read.map(r => (
            <ReviewCard key={r.id} review={r} acknowledged
              onGoTo={() => navigate(`/video/${r.videoId}?actionIndex=${r.actionIndex}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review, onGoTo, onAcknowledge, acknowledged, acknowledging, password, setPassword, onConfirm, onCancel, error, success }) {
  const date = new Date(review.createdAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  const ackDate = review.acknowledgedAt ? new Date(review.acknowledgedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) : null;

  return (
    <div style={{
      background: "var(--bg-secondary)", borderRadius: 10, padding: "14px 16px", marginBottom: 8,
      borderLeft: acknowledged ? "3px solid var(--border)" : "3px solid var(--accent)",
      opacity: acknowledged ? 0.7 : 1
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff"
          }}>
            {(review.coach?.name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)}
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{review.coach?.name}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{date}</span>
        </div>
        {acknowledged && <span style={{ fontSize: 12, color: "#4caf50" }}>✓ {ackDate}</span>}
      </div>

      {review.video && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
          📹 {review.video.opponent} · {new Date(review.video.matchDate).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}

      <div style={{
        background: "var(--bg-primary)", borderRadius: 8, padding: "8px 12px",
        fontSize: 14, lineHeight: 1.5, marginBottom: 10
      }}>
        {review.comment}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onGoTo} style={{
          padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
          background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 12
        }}>🎬 Gå till action</button>
        {!acknowledged && !acknowledging && (
          <button onClick={onAcknowledge} style={{
            padding: "6px 12px", borderRadius: 6, border: "none",
            background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600
          }}>✓ Bekräfta</button>
        )}
      </div>

      {acknowledging && (
        <div style={{ marginTop: 10, padding: 12, background: "var(--bg-primary)", borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            Ange ditt lösenord för att signera:
          </p>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") onConfirm(); }}
            placeholder="Ditt lösenord"
            style={{
              width: "100%", padding: "7px 10px", borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-secondary)",
              color: "var(--text-primary)", fontSize: 13, marginBottom: 8, boxSizing: "border-box"
            }}
          />
          {error && <p style={{ color: "#f44336", fontSize: 12, marginBottom: 6 }}>{error}</p>}
          {success && <p style={{ color: "#4caf50", fontSize: 12, marginBottom: 6 }}>{success}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onConfirm} style={{
              padding: "6px 14px", borderRadius: 6, border: "none",
              background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600
            }}>Signera</button>
            <button onClick={onCancel} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12
            }}>Avbryt</button>
          </div>
        </div>
      )}
    </div>
  );
}


function MatchGroupedReviews({ reviews, navigate }) {
  const [expandedMatch, setExpandedMatch] = useState(null);

  // Gruppera per video
  const grouped = reviews.reduce((acc, r) => {
    const key = r.videoId;
    if (!acc[key]) acc[key] = { video: r.video, videoId: r.videoId, reviews: [] };
    acc[key].reviews.push(r);
    return acc;
  }, {});

  const matches = Object.values(grouped).sort((a, b) =>
    new Date(b.video?.matchDate || 0) - new Date(a.video?.matchDate || 0)
  );

  return (
    <div>
      {matches.map(match => {
        const unacked = match.reviews.filter(r => !r.acknowledgedAt).length;
        const isOpen = expandedMatch === match.videoId;
        return (
          <div key={match.videoId} style={{ marginBottom: 4 }}>
            <div
              onClick={() => setExpandedMatch(isOpen ? null : match.videoId)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                background: "var(--bg-primary)"
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
                {match.video ? `${match.video.opponent} · ${new Date(match.video.matchDate).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}` : "Okänd match"}
              </span>
              {unacked > 0 && (
                <span style={{
                  background: "var(--accent)", color: "#fff", borderRadius: 10,
                  padding: "1px 6px", fontSize: 11, fontWeight: 700
                }}>{unacked}</span>
              )}
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {match.reviews.length} st · {isOpen ? "▲" : "▼"}
              </span>
            </div>

            {isOpen && (
              <div style={{ paddingLeft: 10, marginTop: 2 }}>
                {match.reviews.map(r => (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 10px", borderRadius: 6, marginBottom: 2,
                    background: "var(--bg-secondary)"
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: r.acknowledgedAt ? "#4caf50" : "var(--accent)"
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, whiteSpace: "nowrap",
                        overflow: "hidden", textOverflow: "ellipsis"
                      }}>{r.comment}</div>
                      {r.acknowledgedAt && (
                        <div style={{ fontSize: 11, color: "#4caf50" }}>
                          ✓ {new Date(r.acknowledgedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/video/${r.videoId}?actionIndex=${r.actionIndex}`)}
                      title="Gå till action"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-secondary)", fontSize: 15, padding: "2px 4px", flexShrink: 0
                      }}
                    >🎬</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =====================
// COACHENS INBOX
// =====================
function CoachInbox() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  useEffect(() => { fetchOverview(); }, []);

  async function fetchOverview() {
    try {
      const res = await fetch("/api/reviews/coach-overview", { credentials: "include" });
      const data = await res.json();
      setTeams(data.teams || []);
    } catch {}
    finally { setLoading(false); }
  }

  if (loading) return <div style={{ padding: 32, color: "var(--text-secondary)", textAlign: "center" }}>Laddar...</div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>📋 Spelaröversikt</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>Status på skickade reviews per spelare</p>

      {teams.length === 0 && (
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
          Du är inte kopplad till något lag ännu
        </div>
      )}

      {teams.map(({ team, players }) => (
        <div key={team.id} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 10 }}>
            {team.name}
          </div>

          {players.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "8px 0" }}>Inga spelare i laget ännu</div>
          )}

          {players.map(player => (
            <div key={player.id} style={{ background: "var(--bg-secondary)", borderRadius: 10, marginBottom: 6, overflow: "hidden" }}>
              {/* Spelarrad */}
              <div
                onClick={() => setExpandedPlayer(expandedPlayer === player.id ? null : player.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", cursor: "pointer"
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0
                }}>
                  {player.jerseyNumber ? `${player.jerseyNumber}` : player.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {player.jerseyNumber ? `#${player.jerseyNumber} · ` : ""}{player.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {player.reviews.length} reviews · {player.unacknowledged > 0 ? `${player.unacknowledged} ej sedd` : "alla sedda ✓"}
                  </div>
                </div>
                {player.unacknowledged > 0 && (
                  <span style={{
                    background: "var(--accent)", color: "#fff", borderRadius: "50%",
                    width: 20, height: 20, fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>{player.unacknowledged}</span>
                )}
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {expandedPlayer === player.id ? "▲" : "▼"}
                </span>
              </div>

              {/* Reviews dropdown */}
              {expandedPlayer === player.id && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "8px 16px 12px" }}>
                  {player.reviews.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", padding: "8px 0" }}>Inga reviews skickade än</p>
                  ) : (
                    <MatchGroupedReviews reviews={player.reviews} navigate={navigate} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
