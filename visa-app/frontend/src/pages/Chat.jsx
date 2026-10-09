import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import { SkeletonCard } from "../components/SkeletonCard";
import { apiRequest } from "../utils/apiClient";
import { buildSessionHeaders } from "../utils/sessionAuth";
import "../styles/chat.css";

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

const CHAT_POLL_INTERVAL_MS = 4_000;
const CHAT_PAGE_SIZE = 50;

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => Number(left.id) - Number(right.id));
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  const today = new Date();
  if (getDateKey(date) === getDateKey(today)) return "Hoy";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "long" }).format(date);
}

function getTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function Chat() {
  const { isValidating, session } = useRequireAuth();
  const senior = useModoSenior();
  const [messages, setMessages] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const latestMessageIdRef = useRef(null);

  const latestMessageId = messages.at(-1)?.id || null;

  useEffect(() => {
    latestMessageIdRef.current = latestMessageId;
    if (latestMessageId) bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [latestMessageId]);

  useEffect(() => {
    if (isValidating) return undefined;
    let active = true;
    let requestInFlight = false;
    const controllers = new Set();
    const loadMessages = async ({ afterId } = {}) => {
      if (requestInFlight) return;
      requestInFlight = true;
      const controller = new AbortController();
      controllers.add(controller);
      const search = new URLSearchParams({ limit: String(CHAT_PAGE_SIZE) });
      if (afterId) search.set("afterId", String(afterId));
      try {
        const data = await apiRequest(`/chat?${search}`, { signal: controller.signal, headers: buildSessionHeaders() });
        if (!active) return;
        setAssignment(data.assignment || null);
        setMessages((current) => afterId ? mergeMessages(current, data.messages || []) : data.messages || []);
        if (!afterId) setHasMoreBefore(Boolean(data.hasMoreBefore));
        setError("");
      } catch (requestError) {
        if (active && requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        requestInFlight = false;
        controllers.delete(controller);
        if (active) setLoading(false);
      }
    };
    loadMessages();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "hidden") loadMessages({ afterId: latestMessageIdRef.current });
    }, CHAT_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      controllers.forEach((controller) => controller.abort());
    };
  }, [isValidating]);

  const loadOlder = async () => {
    const firstId = messages[0]?.id;
    if (!firstId || loadingOlder) return;
    try {
      setLoadingOlder(true);
      setError("");
      const data = await apiRequest(`/chat?beforeId=${encodeURIComponent(firstId)}&limit=${CHAT_PAGE_SIZE}`, {
        headers: buildSessionHeaders(),
      });
      setMessages((current) => mergeMessages(data.messages || [], current));
      setHasMoreBefore(Boolean(data.hasMoreBefore));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    try {
      setSending(true); setError("");
      const data = await apiRequest("/chat/messages", {
        method: "POST",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ message: text }),
      });
      setMessages((current) => mergeMessages(current, [data.message]));
      setInput("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="vg-layout">
      <Sidebar currentPage="chat" />

      <main id="main-content" tabIndex="-1" className={`vg-main chat-main${senior ? " chat-main--senior" : ""}`}>
        {isValidating || loading ? (
          <div className="chat-loading">
            <SkeletonCard variant="message" />
          </div>
        ) : (
          <div className="chat-wrapper">
            {/* ─── Chat principal ─── */}
            <section className="chat-panel">
              {/* Header del asesor */}
              <div className="chat-header">
                <div className="chat-header__avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="22" height="22">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div className="chat-header__info">
                  <h2 className="chat-header__name">{assignment?.advisor_name || "Asesor pendiente"}</h2>
                  <p className="chat-header__role">{assignment?.advisor_name ? "Asesor consular asignado · actualización automática" : "Aún no tienes asesor asignado"}</p>
                </div>
                <div className="chat-header__badge">
                  <ShieldIcon />
                  CHAT SEGURO
                </div>
              </div>

              {/* Mensajes */}
              <div className="chat-messages" role="log" aria-live="polite">
                {error && <p className="chat-error" role="alert">{error}</p>}
                {!assignment?.id_asesor && <p className="chat-empty">El chat estará disponible cuando se asigne un asesor a tu trámite.</p>}
                {hasMoreBefore && <button type="button" className="chat-load-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? "Cargando…" : "Cargar mensajes anteriores"}</button>}
                {messages.map((msg, index) => {
                  const showDate = index === 0 || getDateKey(messages[index - 1].createdAt) !== getDateKey(msg.createdAt);
                  return <Fragment key={msg.id}>
                    {showDate && <div className="chat-date-sep">{getDateLabel(msg.createdAt)}</div>}
                    {msg.sender === "advisor" ? (
                    <div key={msg.id} className="chat-msg chat-msg--advisor">
                      <div className="chat-bubble chat-bubble--advisor">
                        <p>{msg.message}</p>
                        <time className="chat-msg__time">{getTime(msg.createdAt)}</time>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="chat-msg chat-msg--user">
                      <div className="chat-bubble chat-bubble--user">
                        <p>{msg.message}</p>
                        <time className="chat-msg__time chat-msg__time--user">{getTime(msg.createdAt)}</time>
                      </div>
                    </div>
                    )}
                  </Fragment>;
                })}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="chat-input-bar">
                <input
                  className="chat-input-bar__field"
                  type="text"
                  placeholder={assignment?.advisor_name ? `Escribe tu mensaje a ${assignment.advisor_name}…` : "Escribe tu mensaje…"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  maxLength={4000}
                  disabled={!assignment?.id_asesor}
                />
                <button
                  className="chat-input-bar__send"
                  onClick={sendMessage}
                  disabled={!input.trim() || sending || !assignment?.id_asesor}
                  aria-label="Enviar"
                >
                  <SendIcon />
                </button>
              </div>
            </section>

            {/* ─── Panel: Resumen del caso ─── */}
            <aside className="chat-summary">
              <h3 className="chat-summary__heading">RESUMEN DEL CASO</h3>

              <div className="chat-summary__section">
                <span className="chat-summary__label">SOLICITANTE</span>
                <strong className="chat-summary__value">
                  {session?.nombre || "Usuario"}
                </strong>
              </div>

              <div className="chat-summary__section">
                <span className="chat-summary__label">TRÁMITE</span>
                <strong className="chat-summary__value">{assignment?.perfil || "Sin definir"}</strong>
              </div>

              <div className="chat-summary__section">
                <span className="chat-summary__label">ESTADO</span>
                <span className="chat-summary__estado">● {assignment?.estado || "Pendiente de asignación"}</span>
              </div>

              <div className="chat-summary__section">
                <span className="chat-summary__label">PRÓXIMO PASO RECOMENDADO</span>
                <p className="chat-summary__next">
                  {assignment?.etapa_actual ? `Continuar con la etapa: ${assignment.etapa_actual}.` : "Espera la asignación de un asesor."}
                </p>
              </div>

              <Link to="/ds160" className="chat-summary__cta">
                Ir al DS-160 →
              </Link>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
