import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { buildApiUrl } from "../config/api";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import { apiRequest } from "../utils/apiClient";
import "../styles/interview.css";

const INTRO_QUESTION = {
  id: "intro",
  text: "¿Cuál es su nombre completo y cuál es el propósito de su viaje?",
  english: "What is your full name and what is the purpose of your trip?",
};

const INTRO_ANALYSIS = {
  weak:
    "Voy de turismo, a pasear un rato y ver qué pasa, tal vez visitar a unos amigos si me da tiempo.",
  strong:
    "Viajo a Orlando, Florida, por 10 días en diciembre con mi familia. Nuestro propósito principal es visitar los parques temáticos de Disney. Ya tenemos cotizados los vuelos y el hotel.",
  weakNotes: [
    "Suena improvisado y genera dudas sobre las intenciones reales.",
    "Mencionar amigos sin especificar puede abrir preguntas sobre lazos y residencia en EE. UU.",
  ],
  strongNotes: [
    "Muestra planificación concreta: destino específico y duración definida.",
    "Establece un motivo legítimo de turismo congruente con la visa B1/B2.",
  ],
};

const GENERAL_ANALYSIS = {
  weakNotes: [
    "Evita respuestas vagas, suposiciones o datos que no puedas explicar.",
    "Escucha la pregunta completa y responde solo lo que te solicitan.",
  ],
  strongNotes: [
    "Responde con claridad, honestidad y datos concretos de tu situación.",
    "Mantén tus respuestas coherentes con tu solicitud y tus documentos.",
  ],
};

const normalizeQuestionText = (text) => String(text || "").trim().toLocaleLowerCase("es");

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

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 5v14l11-7L8 5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MessageIcon() {
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

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="m6 12 4 4 8-8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m9 9 6 6m0-6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function ProgressBars({ questions, currentIndex, recordings }) {
  return (
    <div className="sim-progress" aria-label="Progreso del simulador">
      {questions.map((question, index) => (
        <span
          className={`sim-progress__bar${
            index === currentIndex ? " sim-progress__bar--active" : ""
          }${recordings[question.id] ? " sim-progress__bar--done" : ""}`}
          key={question.id}
        />
      ))}
    </div>
  );
}

function AnalysisCard({ type, title, subtitle, quote, notes }) {
  const isStrong = type === "strong";

  return (
    <article
      className={`analysis-card ${
        isStrong ? "analysis-card--strong" : "analysis-card--weak"
      }`}
    >
      <div className="analysis-card__header">
        <span className="analysis-card__icon">
          {isStrong ? <CheckIcon /> : <XIcon />}
        </span>
        <div>
          <h3>{title}</h3>
          <strong>{subtitle}</strong>
        </div>
      </div>

      {quote && <blockquote>{quote}</blockquote>}

      <h4>{quote ? (isStrong ? "¿Por qué es fuerte?" : "¿Por qué es débil?") : "Recomendaciones"}</h4>
      <ul>
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </article>
  );
}

export default function InterviewSimulator() {
  const { isValidating, session } = useRequireAuth();
  const navigate = useNavigate();
  const modoSenior = useModoSenior();
  const [questions, setQuestions] = useState([]);
  const [questionStatus, setQuestionStatus] = useState("loading");
  const [questionError, setQuestionError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordings, setRecordings] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [submittingSession, setSubmittingSession] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);
  const recordingsRef = useRef({});
  const questionRequestRef = useRef(null);
  const submitRequestRef = useRef(null);
  const recordingRequestRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const objectUrlsRef = useRef(new Set());
  const mountedRef = useRef(true);

  const currentQuestion = questions[currentIndex];
  const remaining = questions.length - currentIndex - 1;
  const recordedCount = Object.keys(recordings).length;
  const isLastQuestion = currentIndex === questions.length - 1;

  const cleanupSessionResources = useCallback(() => {
    sessionGenerationRef.current += 1;
    recordingRequestRef.current += 1;
    questionRequestRef.current?.abort();
    questionRequestRef.current = null;
    submitRequestRef.current?.abort();
    submitRequestRef.current = null;
    clearInterval(timerRef.current);
    timerRef.current = null;

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          // El grabador puede haberse detenido entre la comprobación y stop().
        }
      }
    }

    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    chunksRef.current = [];
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current.clear();
    recordingsRef.current = {};
  }, []);

  const loadQuestions = useCallback(async () => {
    questionRequestRef.current?.abort();
    const controller = new AbortController();
    const generation = sessionGenerationRef.current;
    questionRequestRef.current = controller;
    setQuestionStatus("loading");
    setQuestionError("");

    try {
      const path = `/questions/random?count=4&exclude=intro&excludeText=${encodeURIComponent(INTRO_QUESTION.text)}`;
      const data = await apiRequest(path, {
        signal: controller.signal,
        fallbackMessage: "No se pudieron cargar las preguntas de la entrevista.",
      });
      if (controller.signal.aborted || !mountedRef.current || generation !== sessionGenerationRef.current) return;

      const selected = data?.questions;
      if (!Array.isArray(selected) || selected.length !== 4) {
        throw new Error("El banco no devolvió cuatro preguntas diferentes. Inténtalo de nuevo.");
      }
      const ids = selected.map((item) => String(item.id));
      const texts = selected.map((item) => normalizeQuestionText(item.question));
      if (selected.some((item) => !Number.isInteger(item?.id) || !String(item.question || "").trim()) ||
          new Set(ids).size !== 4 || new Set(texts).size !== 4 ||
          texts.includes(normalizeQuestionText(INTRO_QUESTION.text))) {
        throw new Error("El banco no devolvió cuatro preguntas diferentes. Inténtalo de nuevo.");
      }

      setQuestions([
        INTRO_QUESTION,
        ...selected.map((item) => ({ id: `bank-${item.id}`, text: item.question })),
      ]);
      setQuestionStatus("ready");
    } catch (loadError) {
      if (controller.signal.aborted || !mountedRef.current || generation !== sessionGenerationRef.current) return;
      setQuestionError(loadError.message || "No se pudieron cargar las preguntas.");
      setQuestionStatus("error");
    } finally {
      if (questionRequestRef.current === controller) questionRequestRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isValidating && session) loadQuestions();
  }, [isValidating, session, loadQuestions]);

  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupSessionResources();
    };
  }, [cleanupSessionResources]);

  const startNewSession = () => {
    cleanupSessionResources();
    setRecordings({});
    setCurrentIndex(0);
    setIsRecording(false);
    setSubmittingSession(false);
    setElapsed(0);
    elapsedRef.current = 0;
    setError("");
    setQuestions([]);
    loadQuestions();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Tu navegador no permite grabar audio desde esta pantalla.");
      return;
    }

    const recordingRequest = ++recordingRequestRef.current;
    const generation = sessionGenerationRef.current;
    const isCurrentRecording = () => mountedRef.current &&
      generation === sessionGenerationRef.current &&
      recordingRequest === recordingRequestRef.current;
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isCurrentRecording()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];
      elapsedRef.current = 0;
      setElapsed(0);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (isCurrentRecording() && event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
        if (!isCurrentRecording()) return;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.add(url);

        setRecordings((currentRecordings) => {
          if (!isCurrentRecording()) {
            if (objectUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
            return currentRecordings;
          }
          const previousUrl = currentRecordings[currentQuestion.id]?.url;
          if (previousUrl && objectUrlsRef.current.delete(previousUrl)) URL.revokeObjectURL(previousUrl);

          return {
            ...currentRecordings,
            [currentQuestion.id]: {
              blob,
              url,
              duration: elapsedRef.current,
              createdAt: new Date().toISOString(),
            },
          };
        });
      };

      recorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        if (!isCurrentRecording()) return;
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
    } catch (recordingError) {
      if (!isCurrentRecording()) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setError(
        recordingError?.name === "NotAllowedError"
          ? "Activa el permiso del micrófono para grabar tu respuesta."
          : "No se pudo iniciar la grabación. Revisa tu micrófono."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Un evento del navegador puede haber detenido ya el grabador.
      }
    }

    clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRecording(false);
  };

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    startRecording();
  };

  const handleNext = () => {
    if (isRecording) return;

    setCurrentIndex((index) => Math.min(index + 1, questions.length - 1));
    setElapsed(0);
    elapsedRef.current = 0;
    setError("");
  };

  const handleFinishSession = async () => {
    if (isRecording || submittingSession) return;

    if (recordedCount < questions.length) {
      setError(
        "Graba las 5 respuestas para finalizar la entrevista y enviarla a retroalimentación."
      );
      return;
    }

    const controller = new AbortController();
    const generation = sessionGenerationRef.current;
    submitRequestRef.current = controller;
    try {
      setSubmittingSession(true);
      setError("");

      const formData = new FormData();
      formData.append(
        "session",
        JSON.stringify({
          user: session,
          questions: questions.map((question) => ({
            id: question.id,
            text: question.text,
            recorded: Boolean(recordings[question.id]),
            duration: recordings[question.id]?.duration || 0,
          })),
        })
      );

      questions.forEach((question) => {
        const recording = recordings[question.id];
        if (recording?.blob) {
          formData.append(
            `audio_${question.id}`,
            recording.blob,
            `${question.id}.webm`
          );
        }
      });

      const response = await fetch(buildApiUrl("/interview-sessions"), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted || !mountedRef.current || generation !== sessionGenerationRef.current) return;

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo enviar la entrevista a retroalimentación."
        );
      }

      navigate("/entrevista/retroalimentacion", { state: { sessionId: data.session.id } });
    } catch (submitError) {
      if (controller.signal.aborted || !mountedRef.current || generation !== sessionGenerationRef.current) return;
      setError(
        submitError.message ||
          "No se pudo enviar la entrevista. Inténtalo de nuevo."
      );
    } finally {
      if (submitRequestRef.current === controller) submitRequestRef.current = null;
      if (!controller.signal.aborted && mountedRef.current && generation === sessionGenerationRef.current) setSubmittingSession(false);
    }
  };

  const handlePrevious = () => {
    if (isRecording) return;

    setCurrentIndex((index) => Math.max(index - 1, 0));
    setElapsed(0);
    elapsedRef.current = 0;
    setError("");
  };

  const speakQuestion = () => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      currentQuestion.english
        ? `${currentQuestion.text}. ${currentQuestion.english}`
        : currentQuestion.text
    );
    utterance.lang = "es-US";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };

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

  if (questionStatus !== "ready") {
    return (
      <div className="interview-shell">
        <Sidebar currentPage="entrevista" />
        <main id="main-content" tabIndex="-1" className="interview-main simulator-main">
          <p className="interview-loading" role="status">
            {questionStatus === "loading" ? "Cargando preguntas de la entrevista..." : questionError}
          </p>
          {questionStatus === "error" && (
            <button className="secondary-sim-button" type="button" onClick={loadQuestions}>
              Reintentar
            </button>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="interview-shell">
      <Sidebar currentPage="entrevista" />
      <main
        id="main-content" tabIndex="-1"
        className={`interview-main simulator-main${
          modoSenior ? " interview-main--senior" : ""
        }`}
      >
        <section className="sim-hero">
          <div>
            <span className="interview-pill">Simulador en curso</span>
            <h1>
              Pregunta <strong>{currentIndex + 1}</strong>{" "}
              <span>de {questions.length}</span>
            </h1>
            <p>
              Faltan <strong>{remaining}</strong>{" "}
              {remaining === 1 ? "pregunta" : "preguntas"} para completar esta
              sesión de práctica.
            </p>
          </div>
          <ProgressBars questions={questions} currentIndex={currentIndex} recordings={recordings} />
        </section>

        <section className="question-card">
          <span className="question-card__speaker">
            <MessageIcon />
            Oficial consular
          </span>

          <h2>"{currentQuestion.text}"</h2>

          <button
            className="listen-button"
            type="button"
            onClick={speakQuestion}
          >
            <PlayIcon />
            {currentQuestion.english
              ? "Escuchar pronunciación (Inglés/Español)"
              : "Escuchar pregunta en español"}
          </button>

          {recordings[currentQuestion.id] && (
            <div className="recording-preview">
              <div>
                <strong>Respuesta grabada</strong>
                <span>
                  Duración: {formatTime(recordings[currentQuestion.id].duration)}
                </span>
              </div>
              <audio controls src={recordings[currentQuestion.id].url} />
            </div>
          )}

          {error && <p className="recording-error">{error}</p>}

          <div className="question-actions">
            <button
              className={`record-button${isRecording ? " record-button--active" : ""}`}
              type="button"
              onClick={handleRecordClick}
              disabled={submittingSession}
            >
              <MicIcon />
              {isRecording
                ? `Detener grabación ${formatTime(elapsed)}`
                : recordings[currentQuestion.id]
                  ? "Grabar de nuevo"
                  : "Grabar mi respuesta"}
            </button>

            <button
              className="next-button"
              type="button"
              onClick={isLastQuestion ? handleFinishSession : handleNext}
              disabled={isRecording || submittingSession}
            >
              {submittingSession
                ? "Enviando..."
                : isLastQuestion
                  ? "Finalizar entrevista"
                  : "Siguiente pregunta"}
              <span aria-hidden="true">&rsaquo;</span>
            </button>

            <button
              className="secondary-sim-button"
              type="button"
              onClick={handlePrevious}
              disabled={currentIndex === 0 || isRecording || submittingSession}
            >
              Anterior
            </button>
          </div>
        </section>

        <section className="session-summary" aria-label="Resumen de práctica">
          <div>
            <span>{recordedCount} de {questions.length}</span>
            <strong>respuestas grabadas</strong>
            {isLastQuestion && recordedCount < questions.length && (
              <small className="session-summary__hint">
                Completa las 5 respuestas para enviar la entrevista a
                retroalimentación.
              </small>
            )}
          </div>
          <div className="session-summary__actions">
            <button type="button" onClick={startNewSession}>
              Nueva sesión
            </button>
            <button type="button" onClick={() => (window.location.href = "/entrevista")}>
              Volver a preparación
            </button>
          </div>
        </section>

        <section className="analysis-section">
          <div className="analysis-title">
            <span />
            <h2>Análisis comparativo</h2>
            <span />
          </div>

          <div className="analysis-grid">
            <AnalysisCard
              type="weak"
              title={currentQuestion.id === "intro" ? "Respuesta Débil" : "Evita respuestas vagas"}
              subtitle={currentQuestion.id === "intro" ? "Ejemplo sobre el propósito del viaje" : "Orientación general"}
              quote={currentQuestion.id === "intro" ? INTRO_ANALYSIS.weak : null}
              notes={currentQuestion.id === "intro" ? INTRO_ANALYSIS.weakNotes : GENERAL_ANALYSIS.weakNotes}
            />
            <AnalysisCard
              type="strong"
              title={currentQuestion.id === "intro" ? "Respuesta Fuerte" : "Responde con claridad"}
              subtitle={currentQuestion.id === "intro" ? "Ejemplo sobre el propósito del viaje" : "Orientación general"}
              quote={currentQuestion.id === "intro" ? INTRO_ANALYSIS.strong : null}
              notes={currentQuestion.id === "intro" ? INTRO_ANALYSIS.strongNotes : GENERAL_ANALYSIS.strongNotes}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
