import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { kvittraApi } from '../../utils/apiSwitch.js';
import './PublicVideoPage.css';

export default function PublicVideoPage() {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await kvittraApi.getPublicMatch(matchId);
        if (!cancelled) setMatch(data);
      } catch (err) {
        if (!cancelled) setError('Matchen hittades inte eller är inte publik.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [matchId]);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  if (error || !match) {
    return (
      <div className="public-video-error">
        <p>{error || 'Matchen hittades inte'}</p>
        <Link to=".">Tillbaka till matcher</Link>
      </div>
    );
  }

  const video = match.videos?.[0];
  const matchDate = match.match_date
    ? new Date(match.match_date).toLocaleDateString('sv-SE', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : null;

  return (
    <div className="public-video">
      <Link to="." className="public-video-back">&larr; Alla matcher</Link>

      <div className="public-video-header">
        <h1>{match.title}</h1>
        <div className="public-video-meta">
          {match.team?.name && <span className="public-video-team">{match.team.name}</span>}
          {matchDate && <span className="public-video-date">{matchDate}</span>}
          <span className="badge">{match.match_type === 'scout' ? 'Scout' : 'Match'}</span>
        </div>
      </div>

      {video?.storage_url ? (
        <div className="public-video-player-wrapper">
          <video
            ref={videoRef}
            className="public-video-player"
            src={video.storage_url}
            controls
            playsInline
            preload="metadata"
          />
        </div>
      ) : (
        <div className="public-video-no-video">
          <p>Ingen video tillgänglig för denna match.</p>
        </div>
      )}
    </div>
  );
}
