// ===========================================
// Kvittra — Landningssida
// Publik marknadsföringssida
// ===========================================
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './LandingPage.css';

const FEATURES = [
  { icon: '📊', title: 'DVW-scoutanalys', desc: 'Importera DataVolley-filer och få detaljerad statistik per spelare, set och match.' },
  { icon: '🗺️', title: 'Heatmaps & zoner', desc: 'Se exakt var på planen varje aktion sker. Koordinat-precision från DVW-data.' },
  { icon: '📈', title: 'Individuella dashboards', desc: 'Varje spelare får en egen dashboard med trender, form, och jämförelse mot laget.' },
  { icon: '🎥', title: 'Videoanalys', desc: 'Synka video med scout-data. Klicka på en aktion — videon hoppar dit.' },
  { icon: '🔥', title: 'Pressningsstatistik', desc: 'Hur presterar spelaren i clutch-situationer? När laget ligger under?' },
  { icon: '🏆', title: 'Spelarjämförelse', desc: 'Jämför spelare med radardiagram. Vem ska starta nästa match?' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    navigate('/');
    return null;
  }

  return (
    <div className="lp">
      {/* Hero */}
      <header className="lp-hero">
        <nav className="lp-nav">
          <div className="lp-logo">
            <span className="lp-logo-icon">K</span>
            <span className="lp-logo-text">Kvittra</span>
          </div>
          <button className="lp-login-btn" onClick={() => navigate('/login')}>
            Logga in
          </button>
        </nav>

        <div className="lp-hero-content">
          <h1>Volleybollanalys<br />på en ny nivå</h1>
          <p className="lp-hero-sub">
            Heatmaps, individuella dashboards, DVW-scoutning och videoanalys.
            Allt ditt lag behöver för att ta nästa steg.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-cta" onClick={() => navigate('/login')}>
              Kom igång
            </button>
            <a href="#features" className="lp-cta-secondary">
              Se funktioner
            </a>
          </div>
        </div>

        <div className="lp-hero-visual">
          <div className="lp-stat-preview">
            <div className="lp-preview-card"><span style={{color:'#22c55e',fontSize:28,fontWeight:800}}>47%</span><span>Kill%</span></div>
            <div className="lp-preview-card"><span style={{color:'#3b82f6',fontSize:28,fontWeight:800}}>62%</span><span>Mott+</span></div>
            <div className="lp-preview-card"><span style={{color:'#f59e0b',fontSize:28,fontWeight:800}}>12</span><span>Ess</span></div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="lp-features" id="features">
        <h2>Allt du behöver</h2>
        <p className="lp-features-sub">Från DVW-import till individuella spelar-dashboards</p>
        <div className="lp-features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="lp-feature-card">
              <span className="lp-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <h2>Redo att analysera?</h2>
        <p>Kontakta oss för att komma igång med ditt lag.</p>
        <a href="mailto:support@kvikta.se" className="lp-cta">
          Kontakta oss
        </a>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <span className="lp-logo-icon" style={{width:32,height:32,fontSize:16}}>K</span>
            <span style={{marginLeft:8,fontWeight:600}}>Kvittra</span>
          </div>
          <p>Sports Video Analysis Platform</p>
        </div>
      </footer>
    </div>
  );
}
