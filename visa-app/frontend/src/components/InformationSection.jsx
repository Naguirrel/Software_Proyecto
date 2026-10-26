import useIdioma from "../hooks/useIdioma";
import { getVisaProcessInformation } from "../data/visaProcessInformation";

export default function InformationSection({ modoSenior = false, profile = "turismo_negocios" }) {
  const { t } = useIdioma();
  const information = getVisaProcessInformation(profile);
  return (
    <section id="informacion" className="info-section" aria-labelledby="information-title" data-senior-priority="secondary">
      <header className="info-section__header">
        <h2 id="information-title" style={{ fontSize: modoSenior ? "36px" : "var(--vg-section-title)" }}>{t("info.title")}</h2>
        <p style={{ fontSize: modoSenior ? "19px" : "var(--vg-body-size)" }}>
          {information.subtitle}
        </p>
      </header>

      <article className="info-highlight">
        <span className="info-highlight__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 11v6" />
            <path d="M12 7h.01" />
          </svg>
        </span>
        <div>
          <h3 style={{ fontSize: modoSenior ? "24px" : "var(--vg-card-title)" }}>{information.highlightTitle}</h3>
          <p style={{ fontSize: modoSenior ? "18px" : "var(--vg-body-size)" }}>{information.highlightText}</p>
        </div>
      </article>

      <div className="info-section__grid">
        {information.stages.map((stage, index) => (
          <article className="info-card" key={`${profile}-${stage.title}`}>
            <div className="info-card__header">
              <span aria-hidden="true">{index + 1}</span>
              <h3 style={{ fontSize: modoSenior ? "22px" : "var(--vg-card-title)" }}>{stage.title}</h3>
            </div>
            <p style={{ fontSize: modoSenior ? "18px" : "var(--vg-body-size)" }}>{stage.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
