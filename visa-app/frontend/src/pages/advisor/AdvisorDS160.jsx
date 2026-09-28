import { useEffect, useMemo, useState } from "react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorModal, AdvisorPageHeader, AdvisorSearch, AdvisorState, AdvisorTabs } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";

const tabs = [
  { value: "all", label: "Todos" }, { value: "por_revisar", label: "Por revisar" },
  { value: "en_progreso", label: "En progreso" }, { value: "correccion", label: "Corrección requerida" },
  { value: "aprobado", label: "Aprobado" },
];
const labels = Object.fromEntries(tabs.slice(1).map((item) => [item.value, item.label]));

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function AdvisorDS160() {
  const [forms, setForms] = useState([]);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("por_revisar");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    advisorRequest("/ds160", { signal: controller.signal }).then((data) => setForms(data.forms || []))
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const filtered = useMemo(() => forms.filter((form) => (tab === "all" || form.status === tab) && `${form.name} ${form.email} ${form.profile}`.toLowerCase().includes(query.trim().toLowerCase())), [forms, query, tab]);
  const open = (form) => { setSelected(form); setStatus(form.status || "por_revisar"); setFeedback(form.feedback || ""); setError(""); };
  const save = async () => {
    if (status === "correccion" && !feedback.trim()) { setError("Agrega las correcciones que debe realizar el solicitante."); return; }
    try {
      setSaving(true); setError("");
      await advisorRequest(`/ds160/${selected.id}`, { method: "PUT", body: JSON.stringify({ status, feedback }) });
      setForms((current) => current.map((item) => item.id === selected.id ? { ...item, status, feedback } : item)); setSelected(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  return <AdvisorLayout>
    <AdvisorPageHeader title="Formularios DS-160" description="Revisa las respuestas antes del envío oficial." />
    <AdvisorTabs items={tabs} value={tab} onChange={setTab} label="Filtrar formularios" />
    <section className="advisor-panel"><div className="advisor-panel-toolbar"><AdvisorSearch value={query} onChange={setQuery} placeholder="Buscar por solicitante…" /></div><AdvisorState loading={loading} error={!selected ? error : ""} empty={!loading && !filtered.length} onRetry={() => setRevision((value) => value + 1)} />{!loading && filtered.length > 0 && <div className="advisor-table-wrap"><table className="advisor-table"><thead><tr><th>Solicitante</th><th>Progreso</th><th>Actualización</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{filtered.map((form) => <tr key={form.id}><td><strong>{form.name}</strong><small>{form.profile}</small></td><td><span className="advisor-progress"><i style={{ width: `${form.progress}%` }} /></span><small>{form.progress}% · {form.completed ? "Completado" : `Sección ${form.currentSection}`}</small></td><td>{formatDate(form.updatedAt, true)}</td><td><span className={`advisor-badge advisor-badge--${form.status}`}>{labels[form.status] || form.status}</span></td><td><button className="advisor-action" type="button" onClick={() => open(form)}>Revisar</button></td></tr>)}</tbody></table></div>}</section>
    {selected && <AdvisorModal title={`DS-160 · ${selected.name}`} subtitle={selected.email} onClose={() => setSelected(null)} footer={<><button className="advisor-button advisor-button--secondary" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="advisor-button" type="button" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar revisión"}</button></>}>
      {error && <p className="advisor-inline-error" role="alert">{error}</p>}
      <div className="advisor-form-review"><div className="advisor-form-review__answers"><h3>Respuestas registradas</h3>{Object.entries(selected.data || {}).length ? <dl>{Object.entries(selected.data).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{displayValue(value)}</dd></div>)}</dl> : <p>No hay respuestas registradas.</p>}</div><div className="advisor-form-review__controls"><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}>{tabs.slice(1).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Retroalimentación<textarea rows="6" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Observaciones para el solicitante" /></label></div></div>
    </AdvisorModal>}
  </AdvisorLayout>;
}
