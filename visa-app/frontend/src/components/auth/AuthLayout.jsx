import { CheckCircle2, FileText, MessagesSquare } from "lucide-react";
import authConsultation from "../../assets/auth-consultation.jpg";
import VisaGuideLogo from "../VisaGuideLogo";

const benefits = [
  [<CheckCircle2 aria-hidden="true" />, "Seguimiento paso a paso"],
  [<FileText aria-hidden="true" />, "Documentos organizados"],
  [<MessagesSquare aria-hidden="true" />, "Preparación para entrevista"],
];

export default function AuthLayout({ children }) {
  return (
    <main id="main-content" tabIndex="-1" className="auth-page">
      <div className="auth-shell">
        <section
          className="auth-photo"
          data-senior-priority="secondary"
          aria-label="Beneficios de VisaGuide"
          style={{ "--auth-photo-image": `url(${authConsultation})` }}
        >
          <div className="auth-photo__content">
            <VisaGuideLogo className="auth-brand" />
            <div className="auth-photo__copy">
              <h1>Tu proceso de visa, <span>más claro.</span></h1>
              <p>Organiza tus documentos, completa tu DS-160 y prepárate para tu entrevista desde un solo lugar.</p>
              <ul>
                {benefits.map(([icon, text]) => <li key={text}><span>{icon}</span>{text}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="auth-panel" aria-label="Acceso a VisaGuide">
          <div className="auth-mobile-brand">
            <VisaGuideLogo className="auth-brand" subtitle="Guevara Advisory Services" />
          </div>
          <div className="auth-card">
            <div className="auth-desktop-brand">
              <VisaGuideLogo className="auth-brand" variant="compact" accent={false} />
            </div>
            {children}
          </div>
          <p className="auth-tagline" data-senior-priority="secondary">Proceso seguro, claro y profesional</p>
        </section>
      </div>
    </main>
  );
}
