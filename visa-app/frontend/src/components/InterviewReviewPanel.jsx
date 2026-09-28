import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, X } from "lucide-react";
import { buildApiUrl } from "../config/api";
import { getAdminHeaders } from "../utils/adminHeaders";
import { AdminSearch, AdminTabs } from "./admin/AdminShared";
import AdminAdvancedFilters from "./admin/AdminAdvancedFilters";
import { EMPTY_ADMIN_FILTERS, advisorOptions, matchesAdminFilters } from "../utils/adminFilters";

function getErrorMessage(data, fallback) { return data?.error || data?.message || fallback; }
function getSessionResponses(session) { return Array.isArray(session?.responses) ? session.responses : []; }
function getRecordedCount(session) { return getSessionResponses(session).filter((response) => response.recorded).length; }
function getAudioSource(audio) { return audio?.url ? (audio.url.startsWith("/") ? buildApiUrl(audio.url) : audio.url) : ""; }

function getSessionDate(value) {
  if (!value) return { date: "Sin fecha", time: "Hora no disponible" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Sin fecha", time: "Hora no disponible" };
  return {
    date: new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function getPreparation(session) {
  if (session.status === "reviewed") return { label: "Completada", tone: "approved" };
  if (getRecordedCount(session) > 0) return { label: "Pendiente revisión", tone: "review" };
  return { label: "En progreso", tone: "progress" };
}

export default function InterviewReviewPanel({ showHeader = false, onToast }) {
  const [interviewSessions, setInterviewSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [selectedInterviewSession, setSelectedInterviewSession] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [ratingDraft, setRatingDraft] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filters, setFilters] = useState(EMPTY_ADMIN_FILTERS);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  const notify = useCallback((toast) => { if (onToast) onToast(toast); }, [onToast]);

  const fetchInterviewSessions = useCallback(async (signal) => {
    try {
      setSessionsLoading(true);
      setSessionsError("");
      const response = await fetch(buildApiUrl("/interview-sessions"), { signal, headers: getAdminHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "No se pudieron cargar las entrevistas."));
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      setInterviewSessions(sessions);
      setSelectedInterviewSession((current) => {
        if (!sessions.length || (showHeader && !current)) return null;
        return sessions.find((item) => item.id === current?.id) || sessions[0];
      });
    } catch (fetchError) {
      if (fetchError.name !== "AbortError") setSessionsError(fetchError.message || "No se pudieron cargar las entrevistas.");
    } finally {
      if (!signal?.aborted) setSessionsLoading(false);
    }
  }, [showHeader]);

  useEffect(() => {
    const controller = new AbortController();
    fetchInterviewSessions(controller.signal);
    return () => controller.abort();
  }, [fetchInterviewSessions]);

  useEffect(() => {
    setFeedbackDraft(selectedInterviewSession?.feedback || "");
    setRatingDraft(selectedInterviewSession?.rating ? String(selectedInterviewSession.rating) : "");
  }, [selectedInterviewSession]);

  useEffect(() => {
    if (!showHeader || !selectedInterviewSession) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedInterviewSession(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedInterviewSession, showHeader]);

  const advisors = useMemo(() => advisorOptions(interviewSessions.map((item) => ({ id: item.advisor_id, nombre: item.advisor_name }))), [interviewSessions]);
  const pendingInterviewSessions = useMemo(() => interviewSessions.filter((item) => item.status !== "reviewed"), [interviewSessions]);
  const visibleInterviewSessions = useMemo(() => interviewSessions.filter((item) => {
    const matchesStatus = statusFilter === "all" || (statusFilter === "pending" ? item.status !== "reviewed" : item.status === "reviewed");
    const searchable = `${item.user_name || ""} ${item.user_email || ""}`.toLowerCase();
    return matchesStatus && matchesAdminFilters(filters, item.created_at, item.advisor_id) && searchable.includes(query.toLowerCase());
  }), [interviewSessions, query, statusFilter, filters]);
  const selectedResponses = useMemo(() => getSessionResponses(selectedInterviewSession), [selectedInterviewSession]);
  const selectedRecordedCount = selectedResponses.filter((response) => response.recorded).length;

  const closeDetail = () => {
    setSelectedInterviewSession(null);
    triggerRef.current?.focus();
  };

  const handleSaveFeedback = async () => {
    if (!selectedInterviewSession) return;
    try {
      setSavingFeedback(true);
      const response = await fetch(buildApiUrl(`/interview-sessions/${selectedInterviewSession.id}/feedback`), {
        method: "PUT",
        headers: getAdminHeaders(true),
        body: JSON.stringify({ feedback: feedbackDraft, rating: ratingDraft || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "No se pudo guardar la retroalimentación."));
      setInterviewSessions((current) => current.map((item) => item.id === data.session.id ? { ...item, ...data.session } : item));
      setSelectedInterviewSession(data.session);
      notify({ type: "success", title: "Retroalimentación guardada", message: "El usuario ya puede consultar las observaciones." });
    } catch (feedbackError) {
      notify({ type: "error", title: "No se pudo guardar", message: feedbackError.message || "Revisa la retroalimentación e inténtalo de nuevo." });
    } finally {
      setSavingFeedback(false);
    }
  };

  const detail = selectedInterviewSession && (
    <div className="question-feedback-reference__detail">
      <div className="question-feedback-reference__detail-heading">
        <div><span>Sesión seleccionada</span><strong>{selectedInterviewSession.user_name || "Usuario"}</strong><p>{selectedInterviewSession.user_email || "Sin correo"} · {getSessionDate(selectedInterviewSession.created_at).date}</p></div>
        <em className={selectedInterviewSession.status === "reviewed" ? "is-reviewed" : ""}>{selectedInterviewSession.status === "reviewed" ? "Retroalimentada" : "Pendiente"}</em>
      </div>
      <div className="question-feedback-reference__responses">
        <strong>Respuestas grabadas ({selectedRecordedCount} de {selectedResponses.length})</strong>
        {selectedResponses.map((response, index) => <article key={`${selectedInterviewSession.id}-${response.id}`}><div><span>Pregunta {index + 1}</span><p>{response.text}</p></div>{getAudioSource(response.audio) ? <audio controls src={getAudioSource(response.audio)}>Tu navegador no puede reproducir este audio.</audio> : <small>Sin audio grabado</small>}</article>)}
      </div>
      <label>Retroalimentación del administrador<textarea value={feedbackDraft} onChange={(event) => setFeedbackDraft(event.target.value)} placeholder="Escribe observaciones claras para el usuario..." /></label>
      <div className="question-feedback-reference__actions"><label>Calificación<select value={ratingDraft} onChange={(event) => setRatingDraft(event.target.value)}><option value="">Sin calificación</option><option value="1">1 - Necesita mejorar</option><option value="2">2 - Básica</option><option value="3">3 - Aceptable</option><option value="4">4 - Buena</option><option value="5">5 - Excelente</option></select></label><button type="button" disabled={savingFeedback || !feedbackDraft.trim()} onClick={handleSaveFeedback}>{savingFeedback ? "Guardando..." : "Guardar retroalimentación"}</button></div>
    </div>
  );

  if (!showHeader) {
    return <section className="question-feedback-reference"><div className="question-feedback-reference__summary"><span>Historial de entrevistas</span><strong>{interviewSessions.length}</strong><p>{pendingInterviewSessions.length} sesiones pendientes por retroalimentar desde el simulador.</p></div><div className="question-feedback-reference__list">{sessionsLoading ? <p>Cargando historial de entrevistas...</p> : sessionsError ? <div role="alert"><p>{sessionsError}</p><button type="button" onClick={() => fetchInterviewSessions()}>Reintentar</button></div> : interviewSessions.length ? interviewSessions.slice(0, 8).map((item) => <button className={selectedInterviewSession?.id === item.id ? "is-active" : ""} key={item.id} type="button" onClick={() => setSelectedInterviewSession(item)}><strong>{item.user_name || "Usuario"}</strong><span>{item.user_email || "Sin correo"}</span><small>{item.status === "reviewed" ? "Retroalimentada" : "Pendiente"} · {getRecordedCount(item)} de {getSessionResponses(item).length} respuestas</small></button>) : <p>No hay sesiones de entrevista registradas.</p>}</div>{detail}</section>;
  }

  return (
    <section className="admin-interviews-panel">
      <header className="admin-page-heading"><div><h1>Entrevistas</h1><p>Monitor de citas y simuladores a nivel agencia.</p></div></header>
      <AdminTabs value={statusFilter} onChange={setStatusFilter} label="Filtrar entrevistas" items={[{ value: "all", label: "Próximas" }, { value: "pending", label: "Preparación pendiente" }, { value: "reviewed", label: "Completadas" }]} />
      <section className="admin-list-card">
        <AdminAdvancedFilters value={filters} onChange={setFilters} advisors={advisors} status={statusFilter}
          statuses={[{ value: "all", label: "Todas" }, { value: "pending", label: "Pendiente de revisión" }, { value: "reviewed", label: "Completada" }]}
          onStatusChange={setStatusFilter} onReset={() => { setFilters(EMPTY_ADMIN_FILTERS); setStatusFilter("all"); setQuery(""); }} />
        <div className="admin-list-toolbar"><AdminSearch value={query} onChange={setQuery} placeholder="Buscar solicitante..." /></div>
        {sessionsLoading ? <p className="admin-table-state" role="status">Cargando entrevistas...</p> : sessionsError ? <div className="admin-table-state" role="alert"><p>{sessionsError}</p><p style={{fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px"}}>Verifica tu conexión e intenta nuevamente.</p><button className="admin-secondary-button" type="button" onClick={() => fetchInterviewSessions()}>Reintentar carga</button></div> : (
          <div className="admin-table-wrap"><table className="admin-table admin-interviews-table"><thead><tr><th>Solicitante</th><th>Cita</th><th>Asesor</th><th>Preparación</th><th>Acción</th></tr></thead><tbody>{visibleInterviewSessions.length ? visibleInterviewSessions.map((item) => {
            const appointment = getSessionDate(item.created_at);
            const preparation = getPreparation(item);
            return <tr key={item.id}><td><strong>{item.user_name || "Usuario"}</strong><small>{item.user_email || "Sin correo"}</small></td><td><span className="admin-appointment"><strong><CalendarDays aria-hidden="true" />{appointment.date}</strong><small><Clock3 aria-hidden="true" />{appointment.time}</small></span></td><td>{item.advisor_name || item.asesor || "Sin asignar"}</td><td><span className={`admin-status admin-status--${preparation.tone}`}>{preparation.label}</span></td><td><button className="admin-action-button" type="button" onClick={(event) => { triggerRef.current = event.currentTarget; setSelectedInterviewSession(item); }}>Ver entrevista</button></td></tr>;
          }) : <tr><td colSpan="5" className="admin-table-state">{interviewSessions.length ? "No hay entrevistas que coincidan con los filtros aplicados. Intenta ajustar los criterios de búsqueda." : "No hay sesiones de entrevista registradas. Las sesiones aparecerán aquí cuando los clientes practiquen en el simulador de entrevistas."}</td></tr>}</tbody></table></div>
        )}
      </section>
      {selectedInterviewSession && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeDetail()}><section className="admin-modal admin-interview-modal" role="dialog" aria-modal="true" aria-labelledby="interview-detail-title"><header className="admin-modal__header"><div><small>Revisión de entrevista</small><h2 id="interview-detail-title">{selectedInterviewSession.user_name || "Usuario"}</h2></div><button className="admin-modal__close" ref={closeButtonRef} type="button" aria-label="Cerrar entrevista" onClick={closeDetail}><X aria-hidden="true" /></button></header>{detail}</section></div>}
    </section>
  );
}
