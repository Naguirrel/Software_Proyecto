import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorModal, AdvisorPageHeader, AdvisorSearch, AdvisorState, AdvisorTabs } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { buildApiUrl } from "../../config/api";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";

const tabs = [{ value: "pending", label: "Pendientes" }, { value: "reviewed", label: "Realizadas" }, { value: "all", label: "Todas" }];

function audioUrl(value) { return value?.startsWith("/") ? buildApiUrl(value) : value || ""; }

export default function AdvisorInterviews() {
  const [sessions, setSessions] = useState([]);
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    advisorRequest("/interviews", { signal: controller.signal }).then((data) => setSessions(data.sessions || []))
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const filtered = useMemo(() => sessions.filter((session) => {
    const matchesTab = tab === "all" || (tab === "reviewed" ? session.status === "reviewed" : session.status !== "reviewed");
    return matchesTab && `${session.user_name} ${session.user_email}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [query, sessions, tab]);

  const open = (session) => { setSelected(session); setFeedback(session.feedback || ""); setRating(session.rating ? String(session.rating) : ""); setError(""); };
  const save = async () => {
    if (!feedback.trim()) { setError("La retroalimentación es obligatoria."); return; }
    try {
      setSaving(true); setError("");
      const data = await advisorRequest(`/interviews/${selected.id}/feedback`, { method: "PUT", body: JSON.stringify({ feedback, rating: rating || null }) });
      setSessions((current) => current.map((item) => item.id === data.session.id ? data.session : item)); setSelected(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  return <AdvisorLayout>
    <AdvisorPageHeader title="Entrevistas" description="Revisa la preparación de tus solicitantes." />
    <AdvisorTabs items={tabs} value={tab} onChange={setTab} label="Filtrar entrevistas" />
    <section className="advisor-panel"><div className="advisor-panel-toolbar"><AdvisorSearch value={query} onChange={setQuery} placeholder="Buscar por solicitante…" /></div><AdvisorState loading={loading} error={!selected ? error : ""} empty={!loading && !filtered.length} onRetry={() => setRevision((value) => value + 1)} />{!loading && filtered.length > 0 && <div className="advisor-table-wrap"><table className="advisor-table"><thead><tr><th>Solicitante</th><th>Sesión</th><th>Respuestas</th><th>Preparación</th><th>Acción</th></tr></thead><tbody>{filtered.map((session) => { const recorded = (session.responses || []).filter((item) => item.recorded).length; return <tr key={session.id}><td><strong>{session.user_name}</strong><small>{session.user_email}</small></td><td><span className="advisor-date"><CalendarDays size={17} aria-hidden="true" />{formatDate(session.created_at)}<small><Clock3 size={14} aria-hidden="true" />{formatDate(session.created_at, true).split(", ").at(-1)}</small></span></td><td>{recorded} de {(session.responses || []).length}</td><td><span className={`advisor-badge advisor-badge--${session.status === "reviewed" ? "approved" : "review"}`}>{session.status === "reviewed" ? "Completada" : "Pendiente revisión"}</span></td><td><button className="advisor-action" type="button" onClick={() => open(session)}>Ver detalles</button></td></tr>; })}</tbody></table></div>}</section>
    {selected && <AdvisorModal title={`Entrevista · ${selected.user_name}`} subtitle={formatDate(selected.created_at, true)} onClose={() => setSelected(null)} footer={<><button className="advisor-button advisor-button--secondary" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="advisor-button" type="button" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar retroalimentación"}</button></>}>
      {error && <p className="advisor-inline-error" role="alert">{error}</p>}
      <div className="advisor-interview-responses">{(selected.responses || []).map((response, index) => <article key={response.id || index}><strong>Pregunta {index + 1}</strong><p>{response.text}</p>{response.audio?.url ? <audio controls src={audioUrl(response.audio.url)}>Tu navegador no puede reproducir el audio.</audio> : <small>Sin audio grabado</small>}</article>)}</div>
      <div className="advisor-form-grid"><label className="advisor-form-grid__wide">Retroalimentación<textarea rows="5" value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label><label>Calificación<select value={rating} onChange={(event) => setRating(event.target.value)}><option value="">Sin calificación</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
    </AdvisorModal>}
  </AdvisorLayout>;
}
