import { FileCheck2, FileText, Route } from "lucide-react";
import useIdioma from "../hooks/useIdioma";

export default function DashboardStats({ loading, error, stats }) {
  const { t } = useIdioma();

  if (loading) {
    return (
      <section className="dash-stats" aria-labelledby="dash-stats-title">
        <h2 id="dash-stats-title">{t("stats.title")}</h2>
        <p className="dash-stats__status" role="status">{t("stats.loading")}</p>
      </section>
    );
  }

  const ds160Percentage = Math.min(100, Math.max(0, Number(stats?.ds160Percentage) || 0));
  const documentCount = Math.max(0, Number(stats?.documentCount) || 0);
  const currentStage = stats?.currentStage || t("stats.notStarted");

  return (
    <section className="dash-stats" aria-labelledby="dash-stats-title">
      <div className="dash-stats__heading">
        <div>
          <h2 id="dash-stats-title">{t("stats.title")}</h2>
          <p>{t("stats.summary")}</p>
        </div>
        {error && <p className="dash-stats__error" role="alert">{error}</p>}
      </div>

      <div className="dash-stats__grid">
        <article className="dash-stat-card">
          <span className="dash-stat-card__icon" aria-hidden="true"><FileText size={20} /></span>
          <span className="dash-stat-card__label">{t("stats.ds160")}</span>
          <strong className="dash-stat-card__value">{ds160Percentage}%</strong>
          <div
            className="dash-stat-card__progress"
            role="progressbar"
            aria-label={t("stats.ds160Progress")}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={ds160Percentage}
          >
            <span style={{ width: `${ds160Percentage}%` }} />
          </div>
        </article>

        <article className="dash-stat-card">
          <span className="dash-stat-card__icon" aria-hidden="true"><FileCheck2 size={20} /></span>
          <span className="dash-stat-card__label">{t("stats.documents")}</span>
          <strong className="dash-stat-card__value">{documentCount}</strong>
          <span className="dash-stat-card__hint">
            {t("stats.documentsHint", { count: documentCount })}
          </span>
        </article>

        <article className="dash-stat-card">
          <span className="dash-stat-card__icon" aria-hidden="true"><Route size={20} /></span>
          <span className="dash-stat-card__label">{t("stats.stage")}</span>
          <strong className="dash-stat-card__stage">{currentStage}</strong>
          <span className="dash-stat-card__hint">{t("stats.stageHint")}</span>
        </article>
      </div>
    </section>
  );
}
