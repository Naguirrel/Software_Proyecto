import { useMemo } from "react";
import { ArrowRightCircle, CheckCircle2, Circle, Lock } from "lucide-react";
import { buildProcessChecklist } from "../utils/processChecklist";

function ItemIcon({ state, locked }) {
  if (state === "done") return <CheckCircle2 size={22} />;
  if (state === "current") return <ArrowRightCircle size={22} />;
  return locked ? <Lock size={20} /> : <Circle size={22} />;
}

export default function ProcessChecklist({ workflow, isLoading = false, error = "", onRetry, t }) {
  const checklist = useMemo(() => buildProcessChecklist(workflow), [workflow]);

  let body;
  if (isLoading && !checklist) {
    body = (
      <p className="dash-checklist__message" role="status">{t("checklist.loading")}</p>
    );
  } else if (!checklist && error) {
    body = (
      <div className="dash-checklist__message dash-checklist__message--error" role="alert">
        <p>{t("checklist.error")}</p>
        {onRetry && (
          <button type="button" className="dash-checklist__retry" onClick={onRetry}>
            {t("checklist.retry")}
          </button>
        )}
      </div>
    );
  } else if (!checklist) {
    body = <p className="dash-checklist__message">{t("checklist.empty")}</p>;
  } else {
    const summary = t("checklist.summary", { done: checklist.doneCount, total: checklist.total });
    body = (
      <>
        <p className="dash-checklist__summary">{checklist.allDone ? t("checklist.allDone") : summary}</p>
        <div
          className="dash-checklist__bar"
          role="progressbar"
          aria-label={t("checklist.progressLabel")}
          aria-valuemin={0}
          aria-valuemax={checklist.total}
          aria-valuenow={checklist.doneCount}
          aria-valuetext={summary}
        >
          <div className="dash-checklist__bar-fill" style={{ width: `${(checklist.doneCount / checklist.total) * 100}%` }} />
        </div>
        <ol className="dash-checklist__list">
          {checklist.items.map((item) => {
            const label = t(`checklist.item.${item.id}`);
            return (
              <li
                key={item.id}
                className={`dash-checklist__item dash-checklist__item--${item.state}${item.locked ? " dash-checklist__item--locked" : ""}`}
                aria-current={item.state === "current" ? "step" : undefined}
              >
                <span className="dash-checklist__icon" aria-hidden="true">
                  <ItemIcon state={item.state} locked={item.locked} />
                </span>
                <div className="dash-checklist__body">
                  <span className="dash-checklist__label">{label}</span>
                  <span className="dash-checklist__state">{t(`checklist.state.${item.state}`)}</span>
                  {item.detail && (
                    <span className="dash-checklist__detail">{t(item.detail.key, item.detail.vars)}</span>
                  )}
                  {item.locked && item.blockedReason && (
                    <span className="dash-checklist__blocked">{t("checklist.blocked", { reason: item.blockedReason })}</span>
                  )}
                </div>
                {item.path && (
                  <a className="dash-checklist__action" href={item.path} aria-label={t("checklist.actionLabel", { label })}>
                    {t("checklist.action")}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      </>
    );
  }

  return (
    <section className="dash-checklist" aria-labelledby="dash-checklist-title">
      <h2 id="dash-checklist-title" className="dash-checklist__title">{t("checklist.title")}</h2>
      {body}
    </section>
  );
}
