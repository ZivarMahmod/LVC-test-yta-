// ===========================================
// Corevosports — Landing Page
// Professional volleyball video analysis platform
// ===========================================
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import './LandingPage.css';

// Animated counter
function AnimatedNumber({ target, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const animate = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.3 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// Fade-in on scroll
function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => setVisible(true), delay);
        observer.disconnect();
      }
    }, { threshold: 0.15 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`fade-in ${visible ? 'visible' : ''} ${className}`}>
      {children}
    </div>
  );
}

// SVG volleyball icon
function VolleyballIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className="vb-icon">
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="3" />
      <path d="M50 4 C50 4, 30 30, 50 50 C70 70, 50 96, 50 96" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M8 30 C8 30, 40 35, 50 50 C60 65, 92 70, 92 70" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M8 70 C8 70, 40 65, 50 50 C60 35, 92 30, 92 30" stroke="currentColor" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      {/* ---- NAV ---- */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand">
            <VolleyballIcon size={28} />
            <span>Corevosports</span>
          </div>
          <div className="lp-nav-links">
            <a href="#funktioner">Funktioner</a>
            <a href="#hur">Hur det funkar</a>
            <a href="#priser">Priser</a>
            <Link to="/login" className="lp-nav-login">Logga in</Link>
          </div>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="lp-hero">
        <div className="lp-hero-bg">
          <div className="lp-hero-glow" />
          <div className="lp-hero-grid" />
        </div>
        <div className="lp-hero-content">
          <FadeIn>
            <div className="lp-hero-badge">Videoanalys for volleyboll</div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="lp-hero-title">
              Se vad andra missar.<br />
              <span className="lp-hero-gradient">Vinn nasta set.</span>
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="lp-hero-sub">
              Corevosports ger ditt lag ett proffslager av videoanalys — DVW-scouting,
              spelarstatistik och heatmaps i en plattform byggd for svenskt
              lagarbete.
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="lp-hero-actions">
              <a href="mailto:support@corevosports.se" className="lp-btn lp-btn-primary">Boka demo</a>
              <Link to="/login" className="lp-btn lp-btn-ghost">Logga in</Link>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={400} className="lp-hero-visual">
          <div className="lp-mock-browser">
            <div className="lp-mock-bar">
              <span /><span /><span />
            </div>
            <div className="lp-mock-screen">
              <div className="lp-mock-sidebar">
                <div className="lp-mock-nav-item active" />
                <div className="lp-mock-nav-item" />
                <div className="lp-mock-nav-item" />
                <div className="lp-mock-nav-item" />
              </div>
              <div className="lp-mock-content">
                <div className="lp-mock-video" />
                <div className="lp-mock-stats">
                  <div className="lp-mock-stat-bar" style={{ width: '85%' }} />
                  <div className="lp-mock-stat-bar" style={{ width: '62%' }} />
                  <div className="lp-mock-stat-bar" style={{ width: '78%' }} />
                  <div className="lp-mock-stat-bar" style={{ width: '45%' }} />
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        <div className="lp-hero-scroll">
          <div className="lp-scroll-line" />
        </div>
      </section>

      {/* ---- STATS BAR ---- */}
      <section className="lp-stats-bar">
        <div className="lp-stats-inner">
          <div className="lp-stat">
            <span className="lp-stat-num"><AnimatedNumber target={500} suffix="+" /></span>
            <span className="lp-stat-label">Analyserade matcher</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-num"><AnimatedNumber target={12000} suffix="+" /></span>
            <span className="lp-stat-label">Spelaraktioner loggade</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-num"><AnimatedNumber target={98} suffix="%" /></span>
            <span className="lp-stat-label">Nojda tranarteam</span>
          </div>
        </div>
      </section>

      {/* ---- FEATURES ---- */}
      <section className="lp-section" id="funktioner">
        <FadeIn>
          <div className="lp-section-header">
            <span className="lp-section-tag">Funktioner</span>
            <h2>Allt ditt lag behover — pa ett stalle</h2>
            <p>Fran uppladdning till analys pa under en minut. Byggd for tranarens vardag.</p>
          </div>
        </FadeIn>

        <div className="lp-features">
          <FadeIn delay={0}>
            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: 'rgba(26,95,180,0.15)', color: '#3584e4' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </div>
              <h3>Videoanalys med DVW</h3>
              <p>Importera scout-filer och koppla varje aktion till ratt sekund i videon. Filtrera pa spelare, skill, set och grad.</p>
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: 'rgba(63,185,80,0.15)', color: '#3fb950' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" /></svg>
              </div>
              <h3>Spelarstatistik</h3>
              <p>Personliga dashboards med sasongsgrafer, radarcharts och trendlinjer. Spelare ser sin egen utveckling, tranare ser allt.</p>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: 'rgba(232,168,37,0.15)', color: '#e8a825' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
              </div>
              <h3>Heatmaps & zoner</h3>
              <p>Se var pa planen aktionerna sker. Overlay direkt pa videon. Filtrera per spelare, match eller hel sasong.</p>
            </div>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <h3>Spelarjamforelse</h3>
              <p>Valj tva spelare — se radarchart och stapeldiagram sida vid sida. Identifiera styrkor, svagheter och utvecklingsomraden.</p>
            </div>
          </FadeIn>

          <FadeIn delay={400}>
            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: 'rgba(229,83,75,0.15)', color: '#e5534b' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <h3>Rollbaserad atkomst</h3>
              <p>Admin, tranare, uppladdare och spelare — var och en ser sin vy. Data ar isolerad per organisation med RLS.</p>
            </div>
          </FadeIn>

          <FadeIn delay={500}>
            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: 'rgba(53,132,228,0.15)', color: '#3584e4' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              </div>
              <h3>Chunked upload</h3>
              <p>Ladda upp videor pa upp till 10 GB. Uppladdningen fortsatter dar den slutade vid avbrott.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section className="lp-section lp-section-alt" id="hur">
        <FadeIn>
          <div className="lp-section-header">
            <span className="lp-section-tag">Hur det funkar</span>
            <h2>Fran videofil till insikter pa minuter</h2>
          </div>
        </FadeIn>

        <div className="lp-steps">
          <FadeIn delay={0}>
            <div className="lp-step">
              <div className="lp-step-num">1</div>
              <div className="lp-step-content">
                <h3>Ladda upp</h3>
                <p>Ladda upp matchvideon och DVW scout-filen. Dra och slapp — systemet gor resten. Stodjer MP4, MOV och MKV upp till 10 GB.</p>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={150}>
            <div className="lp-step">
              <div className="lp-step-num">2</div>
              <div className="lp-step-content">
                <h3>Analysera</h3>
                <p>DVW-datan parsas automatiskt. Varje serve, mottagning, angrepp och block kopplas till ratt sekund i videon. Filtrera, jamfor och utforska.</p>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="lp-step">
              <div className="lp-step-num">3</div>
              <div className="lp-step-content">
                <h3>Dela & forbattra</h3>
                <p>Tranare skickar feedback direkt pa enskilda aktioner. Spelare ser sin statistik och utveckling. Hela laget vaxer.</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ---- ONION / SECURITY ---- */}
      <section className="lp-section">
        <FadeIn>
          <div className="lp-section-header">
            <span className="lp-section-tag">Sakerhet</span>
            <h2>Din data — bara din</h2>
            <p>Fem lager av isolation. Ingen organisation ser nagon annans data.</p>
          </div>
        </FadeIn>

        <div className="lp-onion">
          <FadeIn delay={0}><div className="lp-onion-layer lp-onion-5"><span>RLS i databasen</span></div></FadeIn>
          <FadeIn delay={100}><div className="lp-onion-layer lp-onion-4"><span>Vy baserad pa roll</span></div></FadeIn>
          <FadeIn delay={200}><div className="lp-onion-layer lp-onion-3"><span>Roll inom org</span></div></FadeIn>
          <FadeIn delay={300}><div className="lp-onion-layer lp-onion-2"><span>Organisation</span></div></FadeIn>
          <FadeIn delay={400}><div className="lp-onion-layer lp-onion-1"><span>Superadmin</span></div></FadeIn>
        </div>
      </section>

      {/* ---- PRICING ---- */}
      <section className="lp-section lp-section-alt" id="priser">
        <FadeIn>
          <div className="lp-section-header">
            <span className="lp-section-tag">Priser</span>
            <h2>Anpassat for din forening</h2>
            <p>Ingen bindningstid. Inga dolda avgifter. Vi anpassar paketet efter ert lags behov.</p>
          </div>
        </FadeIn>

        <div className="lp-pricing-cards">
          <FadeIn delay={0}>
            <div className="lp-pricing-card">
              <h3>Starter</h3>
              <p className="lp-pricing-desc">For mindre lag som vill komma igang</p>
              <ul>
                <li>1 lag, 1 sasong</li>
                <li>Videoanalys med DVW</li>
                <li>Upp till 50 matcher</li>
                <li>3 anvandarkonton</li>
              </ul>
              <a href="mailto:support@corevosports.se" className="lp-btn lp-btn-outline">Kontakta oss</a>
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <div className="lp-pricing-card lp-pricing-featured">
              <div className="lp-pricing-badge">Populart</div>
              <h3>Pro</h3>
              <p className="lp-pricing-desc">For klubbar med flera lag och tranare</p>
              <ul>
                <li>Obegransat antal lag</li>
                <li>Spelardashboards & statistik</li>
                <li>Heatmaps & spelarjamforelse</li>
                <li>Coach-feedback pa aktioner</li>
                <li>Obegransat antal anvandare</li>
              </ul>
              <a href="mailto:support@corevosports.se" className="lp-btn lp-btn-primary">Boka demo</a>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="lp-pricing-card">
              <h3>Enterprise</h3>
              <p className="lp-pricing-desc">For forbund och stora organisationer</p>
              <ul>
                <li>Allt i Pro</li>
                <li>Egen branding & domän</li>
                <li>Publika matcher for fans</li>
                <li>API-atkomst & integrationer</li>
                <li>Dedikerad support</li>
              </ul>
              <a href="mailto:support@corevosports.se" className="lp-btn lp-btn-outline">Kontakta oss</a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="lp-cta">
        <FadeIn>
          <h2>Redo att ta nasta steg?</h2>
          <p>Boka en demo sa visar vi hur Corevosports kan hjalpa ditt lag.</p>
          <div className="lp-cta-actions">
            <a href="mailto:support@corevosports.se" className="lp-btn lp-btn-primary lp-btn-lg">Boka demo</a>
            <Link to="/login" className="lp-btn lp-btn-ghost">Logga in</Link>
          </div>
        </FadeIn>
      </section>

      {/* ---- FOOTER ---- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <VolleyballIcon size={24} />
            <span>Corevosports</span>
          </div>
          <div className="lp-footer-links">
            <a href="#funktioner">Funktioner</a>
            <a href="#hur">Hur det funkar</a>
            <a href="#priser">Priser</a>
            <a href="mailto:support@corevosports.se">Kontakt</a>
          </div>
          <div className="lp-footer-bottom">
            <span>Corevo Solutions</span>
            <span>support@corevosports.se</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
