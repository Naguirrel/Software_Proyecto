import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { buildApiUrl } from "../config/api";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import { buildSessionHeaders } from "../utils/sessionAuth";
import "../styles/interview.css";

const PREP_CARDS = [
  {
    tone: "green",
    title: "Seguridad y Postura",
    text:
      "Mantén contacto visual. Los oficiales buscan congruencia y tranquilidad. Una postura recta y relajada transmite que no hay nada que ocultar.",
  },
  {
    tone: "pink",
    title: "Respuestas Breves",
    text:
      "Escucha la pregunta completa, respira y responde únicamente lo que te preguntan. No ofrezcas información extra ni justificaciones innecesarias.",
  },
  {
    tone: "yellow",
    title: "Honestidad Total",
    text:
      "Si no sabes algo, dilo. Es mejor decir que no lo recuerdas con exactitud que inventar un dato que contradiga tu formulario DS-160.",
  },
];

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 14a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19 10a7 7 0 0 1-14 0m7 7v4m-4 0h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 18V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-4 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4l1.4 1.4L12 21l7.4-6.6 1.4-1.4a5.2 5.2 0 0 0 0-7.4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m8 13 2 2 5-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TipIcon({ tone }) {
  if (tone === "green") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path
          d="m12 3 2.5 5 5.5.8-4 3.9 1 5.4-5-2.6-5 2.6 1-5.4-4-3.9 5.5-.8L12 3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (tone === "yellow") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3 5 6v5c0 4.5 2.9 8.6 7 10 4.1-1.4 7-5.5 7-10V6l-7-3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="m9 12 2 2 4-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 18V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-4 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Entrevista() {
  const { isValidating, session } = useRequireAuth();
  const navigate = useNavigate();
  const modoSenior = useModoSenior();
  const [latestFeedback, setLatestFeedback] = useState(null);
  const latestResponses = Array.isArray(latestFeedback?.responses)
    ? latestFeedback.responses
    : [];
  const latestRecordedCount = latestResponses.filter(
    (response) => response.recorded
  ).length;
  const latestQuestionCount = latestResponses.length;
  const latestFeedbackIsReviewed = latestFeedback?.status === "reviewed";

  useEffect(() => {
    if (isValidating || !session?.id) {
      setLatestFeedback(null);
      return;
    }

    const controller = new AbortController();

    async function fetchLatestFeedback() {
      try {
        const response = await fetch(buildApiUrl("/interview-sessions/user"), {
          method: "POST",
          headers: buildSessionHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId: session.id }),
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "No se pudo cargar la entrevista.");
        }

        setLatestFeedback(Array.isArray(data.sessions) ? data.sessions[0] : null);
      } catch (error) {
        if (error.name !== "AbortError") setLatestFeedback(null);
      }
    }

    fetchLatestFeedback();

    return () => controller.abort();
  }, [isValidating, session?.id]);

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
      <main id="main-content" tabIndex="-1" className={`interview-main${modoSenior ? " interview-main--senior" : ""}`}>
        <header className="interview-header">
          <h1>Entrevista Consular</h1>
          <p>
            Prepárate mental, emocional y prácticamente para tu encuentro con el
            oficial consular.
          </p>
        </header>

        <section className="interview-hero">
          <div className="interview-hero__copy">
            <span className="interview-pill">Herramienta principal</span>
            <h2>Simulador de Entrevista</h2>
            <p>
              Practica con preguntas reales basadas en tu perfil. Graba tus
              respuestas y aprende a comunicarte de manera clara, concisa y
              segura.
            </p>

            <button
              className="interview-start-button"
              type="button"
              onClick={() => (window.location.href = "/entrevista/simulador")}
            >
              <MicIcon />
              Iniciar simulador
              <span aria-hidden="true">{"->"}</span>
            </button>
          </div>

          <div className="interview-hero__art" aria-hidden="true">
            <ChatIcon />
            <span />
          </div>
        </section>

        <section className="feedback-entry-section">
          <div>
            <span className="feedback-entry-section__label">
              Retroalimentación
            </span>
            <h2>Resultado de tu práctica</h2>
            <p>
              Revisa el estado de tu última entrevista enviada y consulta las
              observaciones cuando estén listas.
            </p>
          </div>

          <article className="feedback-entry-card">
            {latestFeedback ? (
              <>
                <span
                  className={`feedback-entry-card__status${
                    latestFeedbackIsReviewed
                      ? " feedback-entry-card__status--ready"
                      : ""
                  }`}
                >
                  {latestFeedbackIsReviewed
                    ? "Retroalimentación lista"
                    : "Pendiente de retroalimentación"}
                </span>
                <strong>
                  {latestRecordedCount} de {latestQuestionCount} respuestas
                  grabadas
                </strong>
                <p>
                  {latestFeedbackIsReviewed
                    ? "Tu entrevista ya fue revisada por el equipo."
                    : "La entrevista fue enviada y todavía no ha sido procesada."}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/entrevista/retroalimentacion", { state: { sessionId: latestFeedback.id } })}
                >
                  Ver retroalimentación
                </button>
              </>
            ) : (
              <>
                <span className="feedback-entry-card__status feedback-entry-card__status--empty">
                  Sin entrevistas enviadas
                </span>
                <strong>Aún no hay retroalimentación pendiente</strong>
                <p>
                  Completa el simulador para crear una sesión de práctica
                  pendiente de revisión.
                </p>
                <button
                  type="button"
                  onClick={() => (window.location.href = "/entrevista/simulador")}
                >
                  Practicar ahora
                </button>
              </>
            )}
          </article>
        </section>

        <section className="emotional-section">
          <div className="emotional-heading">
            <HeartIcon />
            <h2>Preparación Emocional</h2>
          </div>
          <p>
            Sabemos que este proceso puede generar nervios. Recuerda que la
            entrevista es solo una conversación breve para confirmar lo que ya
            está en tu DS-160.
          </p>

          <div className="prep-grid">
            {PREP_CARDS.map((card) => (
              <article
                className={`prep-card prep-card--${card.tone}`}
                key={card.title}
              >
                <div className="prep-card__icon">
                  <TipIcon tone={card.tone} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
