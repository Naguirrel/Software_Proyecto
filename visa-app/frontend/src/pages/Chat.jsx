import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import { SkeletonCard } from "../components/SkeletonCard";
import "../styles/chat.css";

const INITIAL_MESSAGES = [
  {
    id: 1,
    from: "advisor",
    text: "Hola, soy Carlos, tu asesor consular asignado. He revisado tu perfil inicial y todo se ve muy bien para tu solicitud de visa B1/B2.",
    time: "10:30 AM",
  },
  {
    id: 2,
    from: "advisor",
    text: "Noté que tienes una duda sobre los documentos financieros. ¿Tienes algún certificado laboral reciente?",
    time: "10:31 AM",
  },
  {
    id: 3,
    from: "user",
    text: "Hola Carlos, gracias. Sí, tengo uno de la semana pasada, pero no sé si deba estar firmado digitalmente o a mano.",
    time: "10:35 AM",
  },
  {
    id: 4,
    from: "advisor",
    text: "Ambas firmas son válidas. Lo más importante es que el certificado incluya membrete de la empresa, cargo, antigüedad y salario mensual.",
    time: "10:36 AM",
  },
];

const AUTO_RESPONSES = [
  "Entiendo tu pregunta. Te recomiendo revisar la sección correspondiente en el DS-160 con mucho cuidado.",
  "Eso es completamente normal. Muchos solicitantes tienen esa misma duda.",
  "Perfecto, esa documentación es suficiente para el consulado.",
  "Te sugiero que programemos una revisión de tu DS-160 antes de la cita consular.",
  "Claro, puedo ayudarte con eso. ¿Podrías darme más detalles sobre tu situación?",
];

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="2">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
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

function getTime() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m} ${ampm}`;
}

export default function Chat() {
  const { isValidating, session } = useRequireAuth();
  const senior = useModoSenior();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg = { id: Date.now(), from: "user", text, time: getTime() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    // Simulate advisor response
    setTimeout(() => {
      const response = AUTO_RESPONSES[Math.floor(Math.random() * AUTO_RESPONSES.length)];
      setTyping(false);
      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, from: "advisor", text: response, time: getTime() },
      ]);
    }, 1400 + Math.random() * 800);
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
        {isValidating ? (
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
                  <span className="chat-header__online" aria-label="En línea" />
                </div>
                <div className="chat-header__info">
                  <h2 className="chat-header__name">Carlos Mendoza</h2>
                  <p className="chat-header__role">Asesor Consular en línea</p>
                </div>
                <div className="chat-header__badge">
                  <ShieldIcon />
                  CHAT SEGURO
                </div>
              </div>

              {/* Mensajes */}
              <div className="chat-messages" role="log" aria-live="polite">
                <div className="chat-date-sep">HOY</div>

                {messages.map((msg) =>
                  msg.from === "advisor" ? (
                    <div key={msg.id} className="chat-msg chat-msg--advisor">
                      <div className="chat-bubble chat-bubble--advisor">
                        <p>{msg.text}</p>
                        <time className="chat-msg__time">{msg.time}</time>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="chat-msg chat-msg--user">
                      <div className="chat-bubble chat-bubble--user">
                        <p>{msg.text}</p>
                        <time className="chat-msg__time chat-msg__time--user">{msg.time}</time>
                      </div>
                    </div>
                  )
                )}

                {typing && (
                  <div className="chat-msg chat-msg--advisor">
                    <div className="chat-bubble chat-bubble--advisor chat-bubble--typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="chat-input-bar">
                <button className="chat-input-bar__attach" aria-label="Adjuntar archivo">
                  <PaperclipIcon />
                </button>
                <input
                  ref={inputRef}
                  className="chat-input-bar__field"
                  type="text"
                  placeholder="Escribe tu mensaje a Carlos..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                />
                <button
                  className="chat-input-bar__send"
                  onClick={sendMessage}
                  disabled={!input.trim() || typing}
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
                <strong className="chat-summary__value">Visa B1/B2 (Turismo)</strong>
              </div>

              <div className="chat-summary__section">
                <span className="chat-summary__label">ESTADO</span>
                <span className="chat-summary__estado">● Llenando DS-160</span>
              </div>

              <div className="chat-summary__section">
                <span className="chat-summary__label">PRÓXIMO PASO RECOMENDADO</span>
                <p className="chat-summary__next">
                  Completar la sección &quot;Datos Familiares&quot; en el formulario
                  antes de la revisión final.
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
