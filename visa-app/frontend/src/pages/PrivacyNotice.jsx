import { Link } from "react-router-dom";
import VisaGuideLogo from "../components/VisaGuideLogo";
import {
  PRIVACY_NOTICE_SECTIONS,
  PRIVACY_NOTICE_UPDATED,
  PRIVACY_NOTICE_VERSION,
} from "../config/privacyNotice";
import "../styles/privacy-notice.css";

// Página pública: se abre desde el registro antes de tener cuenta.
export default function PrivacyNotice() {
  return (
    <main id="main-content" tabIndex="-1" className="privacy-page">
      <article className="privacy-card">
        <VisaGuideLogo className="privacy-brand" />
        <header>
          <h1>Aviso de privacidad</h1>
          <p className="privacy-meta">
            Versión {PRIVACY_NOTICE_VERSION} · Vigente desde el {PRIVACY_NOTICE_UPDATED}
          </p>
        </header>

        {PRIVACY_NOTICE_SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`privacy-${section.id}`}>
            <h2 id={`privacy-${section.id}`}>{section.title}</h2>
            {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
            {section.items && (
              <ul>
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}

        <footer className="privacy-footer">
          <Link to="/registro">Volver al registro</Link>
          <Link to="/login">Iniciar sesión</Link>
        </footer>
      </article>
    </main>
  );
}
