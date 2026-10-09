import useIdioma from "../hooks/useIdioma";

const ETAPAS = [1, 2, 3, 4, 5];

export default function InformationSection({ modoSenior = false }) {
  const { t } = useIdioma();
  return (
    <section id="informacion" className="info-section" aria-labelledby="information-title">
      <header className="info-section__header">
        <h2 id="information-title" style={{ fontSize: modoSenior ? "36px" : "var(--vg-section-title)" }}>{t("info.title")}</h2>
        <p style={{ fontSize: modoSenior ? "19px" : "var(--vg-body-size)" }}>
          {t("info.subtitle")}
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
          <h3 style={{ fontSize: modoSenior ? "24px" : "var(--vg-card-title)" }}>{t("info.highlightTitle")}</h3>
          <p style={{ fontSize: modoSenior ? "18px" : "var(--vg-body-size)" }}>{t("info.highlightText")}</p>
        </div>
      </article>

      <div className="info-section__grid">
        {ETAPAS.map((numero) => (
          <article className="info-card" key={numero}>
            <div className="info-card__header">
              <span aria-hidden="true">{numero}</span>
              <h3 style={{ fontSize: modoSenior ? "22px" : "var(--vg-card-title)" }}>{t(`info.${numero}.title`)}</h3>
            </div>
            <p style={{ fontSize: modoSenior ? "18px" : "var(--vg-body-size)" }}>{t(`info.${numero}.description`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
