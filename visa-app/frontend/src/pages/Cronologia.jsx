import { useEffect, useState } from "react";
import { buildApiUrl } from "../config/api";
import Sidebar from "../components/Sidebar";
import useModoSenior from "../hooks/useModoSenior";
import useIdioma from "../hooks/useIdioma";
import useRequireAuth from "../hooks/useRequireAuth";
import useClientWorkflow from "../hooks/useClientWorkflow";
import { SkeletonList } from "../components/SkeletonCard";
import {
  calculateDs160Percentage,
  getCurrentProcessStage,
  getProcessTimeline,
  summarizeDocuments,
} from "../utils/dashboardStats";
import { buildSessionHeaders } from "../utils/sessionAuth";
import "../styles/cronologia.css";

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15,3 21,3 21,9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function Nodo({ numero, estado }) {
  if (estado === "completada") {
    return (
      <div className="cron-nodo cron-nodo--done">
        <CheckIcon />
      </div>
    );
  }
  if (estado === "actual") {
    return (
      <div className="cron-nodo cron-nodo--actual">
        <span className="cron-nodo__num">{numero}</span>
      </div>
    );
  }
  return (
    <div className="cron-nodo cron-nodo--pendiente">
      <span className="cron-nodo__num cron-nodo__num--muted">{numero}</span>
    </div>
  );
}

function TarjetaCompletada({ etapa, senior }) {
  const { idioma, t } = useIdioma();
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString(idioma === "en" ? "en-US" : "es-GT", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <article className="cron-card cron-card--done">
      <div className="cron-card__head">
        <h3 className={`cron-card__title${senior ? " cron-card__title--senior" : ""}`}>
          {etapa.label}
        </h3>
        <span className={`cron-card__fecha${senior ? " cron-card__fecha--senior" : ""}`}>
          {etapa.completedAt ? t("timeline.completedOn", { fecha: formatDate(etapa.completedAt) }) : t("timeline.completed")}
        </span>
      </div>
      <p className={`cron-card__desc${senior ? " cron-card__desc--senior" : ""}`}>
        {etapa.description}
      </p>
    </article>
  );
}

function TarjetaActual({ etapa, senior }) {
  const { t } = useIdioma();
  return (
    <article className="cron-card cron-card--actual">
      <span className="cron-badge-actual">{t("timeline.current")}</span>
      <div className="cron-card__head cron-card__head--actual">
        <h3 className={`cron-card__title cron-card__title--actual${senior ? " cron-card__title--senior" : ""}`}>
          {etapa.label}
        </h3>
        <span className="cron-badge-progreso">{t("timeline.inProgress")}</span>
      </div>
      <p className={`cron-card__desc${senior ? " cron-card__desc--senior" : ""}`}>
        {etapa.description}
      </p>
      {etapa.action && (
        <button
          className={`cron-btn-accion${senior ? " cron-btn-accion--senior" : ""}`}
          onClick={() => (window.location.href = etapa.action.path)}
        >
          {etapa.action.label}
          <ExternalIcon />
        </button>
      )}
    </article>
  );
}

function TarjetaPendiente({ etapa, senior }) {
  return (
    <div className="cron-pendiente">
      <h3 className={`cron-pendiente__title${senior ? " cron-pendiente__title--senior" : ""}`}>
        {etapa.label}
      </h3>
      <p className={`cron-pendiente__desc${senior ? " cron-pendiente__desc--senior" : ""}`}>
        {etapa.description}
      </p>
    </div>
  );
}

function EtapaItem({ etapa, esUltima, senior }) {
  const lineColor = etapa.estado === "completada" ? "#e11d48" : "#e2e8f0";

  let contenido;
  if (etapa.estado === "completada") {
    contenido = <TarjetaCompletada etapa={etapa} senior={senior} />;
  } else if (etapa.estado === "actual") {
    contenido = <TarjetaActual etapa={etapa} senior={senior} />;
  } else {
    contenido = <TarjetaPendiente etapa={etapa} senior={senior} />;
  }

  return (
    <li className="cron-item">
      <div className="cron-timeline-col">
        <Nodo numero={etapa.number} estado={etapa.estado} />
        {!esUltima && (
          <div className="cron-linea" style={{ backgroundColor: lineColor }} />
        )}
      </div>
      <div className="cron-content-col">{contenido}</div>
    </li>
  );
}

export default function Cronologia() {
  const { isValidating, session } = useRequireAuth();
  const { workflow, isLoading: workflowLoading } = useClientWorkflow({
    enabled: !isValidating && Boolean(session),
  });
  const senior = useModoSenior();
  const { idioma, t } = useIdioma();
  const [progress, setProgress] = useState({ stage: 1, data: {} });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (isValidating || workflowLoading || !workflow) return undefined;

    const controller = new AbortController();
    const fetchTimelineData = async () => {
      if (!session) {
        setProgress({ stage: 1, data: {} });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError("");

        const fetchJson = async (path, options = {}) => {
          const response = await fetch(buildApiUrl(path), { ...options, signal: controller.signal });
          if (!response.ok) throw new Error("No se pudo actualizar la cronología.");
          return response.json();
        };

        const correoBody = JSON.stringify({ correo: session.correo || "" });
        const postJson = {
          method: "POST",
          headers: buildSessionHeaders({ "Content-Type": "application/json" }),
          body: correoBody,
        };
        const [tramiteResult, ds160Result, documentsResult] = await Promise.allSettled([
          fetchJson("/estado-tramite", postJson),
          workflow.gates?.ds160?.allowed ? fetchJson("/ds160/load", postJson) : Promise.resolve(null),
          fetchJson("/documentos/listar", {
            method: "POST",
            headers: buildSessionHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ usuario_id: session.id }),
          }),
        ]);

        if (controller.signal.aborted) return;

        const tramiteData = tramiteResult.status === "fulfilled" ? tramiteResult.value : null;
        const ds160Data = ds160Result.status === "fulfilled" ? ds160Result.value : null;
        const documentsData = documentsResult.status === "fulfilled" ? documentsResult.value : [];
        const documentSummary = summarizeDocuments(documentsData);
        const ds160Percentage = calculateDs160Percentage(ds160Data);
        const currentStage = getCurrentProcessStage({
          session,
          tramite: tramiteData,
          ds160Percentage,
          documentSummary,
        });

        setProgress({
          stage: currentStage,
          data: { tramite: tramiteData, ds160: ds160Data, documents: documentsData },
        });

        if ([tramiteResult, ds160Result, documentsResult].some((result) => result.status === "rejected")) {
          setLoadError("timeline.partialError");
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setProgress({ stage: 1, data: {} });
          setLoadError("timeline.error");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchTimelineData();
    return () => controller.abort();
  }, [isValidating, session, workflow, workflowLoading]);

  const baseTimeline = getProcessTimeline(progress.stage, progress.data, idioma);
  const timeline = workflow?.assigned
    ? baseTimeline
    : baseTimeline.map((stage) => ({ ...stage, action: null }));

  return (
    <div className="vg-layout">
      <Sidebar currentPage="cronologia" />

      <main id="main-content" tabIndex="-1" className="vg-main cron-main">
        <header className="cron-header">
          <h1 className={`cron-titulo${senior ? " cron-titulo--senior" : ""}`}>
            {t("timeline.title")}
          </h1>
          <p className={`cron-subtitulo${senior ? " cron-subtitulo--senior" : ""}`}>
            {t("timeline.subtitle")}
          </p>
        </header>

        <hr className="cron-divisor" />

        {workflow && !workflow.assigned && (
          <p className="cron-message cron-message--warning" role="status">
            Tu solicitud está esperando asignación de asesor. Puedes completar el perfil y subir documentos; las etapas posteriores permanecerán bloqueadas.
          </p>
        )}

        {loadError && (
          <p className="cron-message cron-message--warning" role="alert">
            {t(loadError)}
          </p>
        )}

        {isValidating || workflowLoading || loading ? (
          <SkeletonList variant="timeline" count={1} />
        ) : (
          <ol className="cron-timeline" aria-label={t("timeline.stagesLabel")}>
            {timeline.map((etapa, idx) => (
              <EtapaItem
                key={etapa.number}
                etapa={etapa}
                esUltima={idx === timeline.length - 1}
                senior={senior}
              />
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
