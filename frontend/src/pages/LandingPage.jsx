import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-page">
      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-logo">Kvittra</h1>
          <p className="landing-hero-tagline">Sports Video Analysis Platform</p>
          <p className="landing-hero-description">
            Analysera matcher, identifiera styrkor och utveckla ditt lag med
            kraftfull videoanalys och detaljerad spelarstatistik.
          </p>
          <Link to="/login" className="landing-hero-cta">
            Logga in
            <span className="landing-hero-cta-arrow">&rarr;</span>
          </Link>
        </div>
        <div className="landing-scroll-hint">
          <span>Scroll</span>
          <div className="landing-scroll-chevron" />
        </div>
      </section>

      <hr className="landing-divider" />

      {/* Features */}
      <section className="landing-section">
        <h2 className="landing-section-title">Funktioner</h2>
        <p className="landing-section-subtitle">
          Allt du behover for att ta ditt lags utveckling till nasta niva.
        </p>
        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon landing-feature-icon--video">
              &#9654;
            </div>
            <h3>Videoanalys</h3>
            <p>
              Importera matchvideor med DVW scout-filer. Filtrera pa actions,
              zoner och spelare. Visualisera data med heatmaps direkt i
              videospelaren.
            </p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon landing-feature-icon--stats">
              &#9776;
            </div>
            <h3>Spelarstatistik</h3>
            <p>
              Detaljerade dashboards med grafer och statistik per spelare.
              Folj utveckling over tid och jamfor prestationer mellan matcher.
            </p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon landing-feature-icon--team">
              &#9733;
            </div>
            <h3>Laghantering</h3>
            <p>
              Hantera lag, sasonger och roller. Ge coacher och spelare tillgang
              till ratt material med flexibel behorighetshantering.
            </p>
          </div>
        </div>
      </section>

      <hr className="landing-divider" />

      {/* How it works */}
      <section className="landing-section">
        <h2 className="landing-section-title">Sa fungerar det</h2>
        <p className="landing-section-subtitle">
          Fran videoinspelning till konkreta forbattringar i tre enkla steg.
        </p>
        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-number">
              1
            </div>
            <h3>Ladda upp</h3>
            <p>
              Ladda upp matchvideor och tillhorande scout-filer.
              Systemet hanterar stora filer med chunked upload.
            </p>
          </div>
          <div className="landing-step">
            <div className="landing-step-number">
              2
            </div>
            <h3>Analysera</h3>
            <p>
              Utforska data med filter, heatmaps och spelarstatistik.
              Jamfor prestationer over flera matcher.
            </p>
          </div>
          <div className="landing-step">
            <div className="landing-step-number">
              3
            </div>
            <h3>Forbattra</h3>
            <p>
              Dela insikter med laget. Identifiera utvecklingsomraden
              och folj framsteg sasong efter sasong.
            </p>
          </div>
        </div>
      </section>

      <hr className="landing-divider" />

      {/* Pricing teaser */}
      <section className="landing-section landing-pricing">
        <h2 className="landing-section-title">Priser</h2>
        <p className="landing-section-subtitle">
          Flexibla losningar for foreningar och klubbar i alla storlekar.
        </p>
        <div className="landing-pricing-card">
          <h3>Kontakta oss for priser</h3>
          <p>
            Vi anpassar paketet efter ert lags behov. Kontakta oss sa
            beratter vi mer om vad Kvittra kan gora for er.
          </p>
          <a
            href="mailto:support@kvittra.se"
            className="landing-contact-link"
          >
            &#9993; support@kvittra.se
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">Kvittra</div>
        <div className="landing-footer-company">Corevo Solutions</div>
        <div className="landing-footer-contact">
          Kontakt:{' '}
          <a href="mailto:support@kvittra.se">support@kvittra.se</a>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
