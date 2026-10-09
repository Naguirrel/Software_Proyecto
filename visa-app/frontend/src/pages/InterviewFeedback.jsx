import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { buildApiUrl } from "../config/api";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import { buildSessionHeaders } from "../utils/sessionAuth";
import AuthenticatedAudio from "../components/AuthenticatedAudio";
import "../styles/interview.css";

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(seconds) {
  const safeSeconds = Number(seconds) || 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function PendingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getResponses(session) {
  return Array.isArray(session?.responses) ? session.responses : [];
}

function getAudioSource(audio) {
  if (!audio?.url) return "";
  return audio.url.startsWith("/") ? buildApiUrl(audio.url) : audio.url;
}

export default function InterviewFeedback() {
  const { isValidating, session } = useRequireAuth();
  const location = useLocation();
  const modoSenior = useModoSenior();
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    if (isValidating) return;
    const controller = new AbortController();

    const fetchFeedbackSession = async () => {
      try {
        setLoadingSession(true);
        setSessionError("");

        const sessionId = location.state?.sessionId;
        const response = await fetch(
          buildApiUrl(sessionId ? "/interview-sessions/detail" : "/interview-sessions/user"),
          {
            method: "POST",
            headers: buildSessionHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(sessionId ? { sessionId } : { userId: session?.id }),
            signal: controller.signal,
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "No se pudo cargar la retroalimentación."
          );
        }

        if (sessionId) {
          setFeedbackSession(data.session || null);
          return;
        }

        setFeedbackSession(
          Array.isArray(data.sessions) && data.sessions.length > 0
            ? data.sessions[0]
            : null
        );
      } catch (error) {
        if (error.name === "AbortError") return;
        setSessionError(
          error.message || "No se pudo cargar la retroalimentación."
        );
      } finally {
        if (!controller.signal.aborted) setLoadingSession(false);
      }
    };

    fetchFeedbackSession();
    return () => controller.abort();
  }, [isValidating, location.state, session?.id]);

  const responses = useMemo(() => getResponses(feedbackSession), [feedbackSession]);
  const recordedCount = responses.filter((response) => response.recorded).length;
  const isReviewed = feedbackSession?.status === "reviewed";

  if (isValidating) {
    return (
      <div className="interview-shell">
        <Sidebar currentPage="entrevista" />
        <main id="main-content" tabIndex="-1" className="interview-main">
          <p className="interview-loading">Verificando sesión...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="interview-shell">
      <Sidebar currentPage="entrevista" />
      <main
        id="main-content" tabIndex="-1"
        className={`interview-main feedback-main${
          modoSenior ? " interview-main--senior" : ""
        }`}
      >
        <header className="interview-header feedback-header">
          <h1>Retroalimentación de Entrevista</h1>
          <p>
            Aquí podrás revisar cómo te fue cuando el asesor procese tu sesión
            de práctica.
          </p>
        </header>

        {loadingSession ? (
          <p className="interview-loading">Cargando sesión...</p>
        ) : sessionError ? (
          <section className="feedback-empty">
            <PendingIcon />
            <h2>No pudimos cargar la sesión</h2>
            <p>{sessionError}</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </section>
        ) : !feedbackSession ? (
          <section className="feedback-empty">
            <PendingIcon />
            <h2>No hay entrevistas enviadas</h2>
            <p>
              Completa el simulador para crear una sesión pendiente de
              retroalimentación.
            </p>
            <button
              type="button"
              onClick={() => (window.location.href = "/entrevista/simulador")}
            >
              Iniciar simulador
            </button>
          </section>
        ) : (
          <>
            <section
              className={`feedback-status-card${
                isReviewed ? " feedback-status-card--reviewed" : ""
              }`}
            >
              <div className="feedback-status-card__icon">
                <PendingIcon />
              </div>
              <div>
                <span>
                  {isReviewed
                    ? "Retroalimentación lista"
                    : "Pendiente de retroalimentación"}
                </span>
                <h2>
                  {isReviewed
                    ? "Tu entrevista ya fue revisada"
                    : "Tu entrevista fue enviada correctamente"}
                </h2>
                <p>
                  {isReviewed
                    ? "El asesor dejó observaciones para que puedas mejorar tus próximas respuestas."
                    : "Aún no ha sido procesada. Cuando el asesor revise tus respuestas, aquí aparecerán observaciones y recomendaciones."}
                </p>
              </div>
            </section>

            {isReviewed && (
              <section className="feedback-review-card">
                <span>Feedback del asesor</span>
                <p>{feedbackSession.feedback}</p>
                {feedbackSession.rating && (
                  <strong>Calificación: {feedbackSession.rating}/5</strong>
                )}
              </section>
            )}

            <section className="feedback-summary-grid" aria-label="Resumen">
              <article>
                <span>Estado</span>
                <strong>{isReviewed ? "Revisada" : "Pendiente"}</strong>
              </article>
              <article>
                <span>Respuestas grabadas</span>
                <strong>
                  {recordedCount} de {responses.length}
                </strong>
              </article>
              <article>
                <span>Fecha de envío</span>
                <strong>{formatDate(feedbackSession.created_at)}</strong>
              </article>
            </section>

            <section className="feedback-question-list">
              <div className="feedback-section-heading">
                <h2>Preguntas enviadas</h2>
                <p>Referencia de la sesión que queda pendiente de revisión.</p>
              </div>

              {responses.map((response, index) => (
                <article className="feedback-question-row" key={response.id}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{response.text}</h3>
                    <p>
                      {response.recorded
                        ? `Respuesta grabada · Duración ${formatTime(
                            response.duration
                          )}`
                        : "Sin grabación"}
                    </p>
                    {getAudioSource(response.audio) && (
                      <AuthenticatedAudio src={response.audio.url} />
                    )}
                  </div>
                  <strong
                    className={
                      response.recorded
                        ? "feedback-question-row__done"
                        : "feedback-question-row__missing"
                    }
                  >
                    {response.recorded ? "Lista" : "Pendiente"}
                  </strong>
                </article>
              ))}
            </section>

            <section className="feedback-actions">
              <button
                type="button"
                onClick={() => (window.location.href = "/entrevista")}
              >
                Volver a entrevista
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = "/entrevista/simulador")}
              >
                Practicar de nuevo
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
