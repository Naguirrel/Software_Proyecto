import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdvisorAlert, AdvisorModal, AdvisorPageHeader, AdvisorSearch, AdvisorState, AdvisorTabs } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";
import useSessionStorageState from "../../hooks/useSessionStorageState";
import { getDs160Sections } from "../../data/ds160Sections";

const tabs = [
  { value: "all", label: "Todos" }, { value: "por_revisar", label: "Por revisar" },
  { value: "en_progreso", label: "En progreso" }, { value: "correccion", label: "Corrección requerida" },
];
const reviewStates = [...tabs.slice(1), { value: "aprobado", label: "Aprobado" }];
const labels = Object.fromEntries(reviewStates.map((item) => [item.value, item.label]));

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "Sin responder";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.filter((item) => typeof item !== "object").join(", ") || "Sin responder";
  if (typeof value === "object") return "Respuesta no disponible en este formato";
  return String(value);
}

export default function AdvisorDS160() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [forms, setForms] = useState([]);
  const [tab, setTab] = useSessionStorageState("advisor-ds160-tab", "all");
  const [query, setQuery] = useSessionStorageState("advisor-ds160-query", "");
  const [showApproved, setShowApproved] = useSessionStorageState("advisor-ds160-approved", false);
  const [sectionIndex, setSectionIndex] = useState(0);
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

  useEffect(() => {
    const formId = Number(searchParams.get("form"));
    const requested = forms.find((form) => form.id === formId);
    if (requested && selected?.id !== requested.id) open(requested);
  }, [forms, searchParams, selected?.id]);

  const filtered = useMemo(() => forms.filter((form) => (showApproved || form.status !== "aprobado") && (tab === "all" || !tabs.some((item) => item.value === tab) || form.status === tab) && `${form.name} ${form.email} ${form.profile}`.toLowerCase().includes(query.trim().toLowerCase())), [forms, query, showApproved, tab]);
  const open = (form) => { setSelected(form); setSectionIndex(0); setStatus(form.status || "por_revisar"); setFeedback(form.feedback || ""); setError(""); };
  const close = () => { setSelected(null); setSearchParams({}); setError(""); };
  const save = async () => {
    if (saving || selected.status === "aprobado") return;
    if (status === "correccion" && !feedback.trim()) { setError("Agrega las correcciones que debe realizar el solicitante."); return; }
    try {
      setSaving(true); setError("");
      await advisorRequest(`/ds160/${selected.id}`, { method: "PUT", body: JSON.stringify({ status, feedback }) });
      setForms((current) => current.map((item) => item.id === selected.id ? { ...item, status, feedback } : item)); close();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const sections = selected ? getDs160Sections(selected.profile) : [];
  const section = sections[sectionIndex];
  const approved = selected?.status === "aprobado";

  return <>
    <AdvisorPageHeader title="Formularios DS-160" description="Revisa las respuestas antes del envío oficial." />
    <AdvisorTabs items={tabs} value={tabs.some((item) => item.value === tab) ? tab : "all"} onChange={setTab} label="Filtrar formularios" />
    <section className="advisor-panel"><div className="advisor-panel-toolbar"><AdvisorSearch value={query} onChange={setQuery} placeholder="Buscar por solicitante…" /><label className="advisor-include-inactive"><input type="checkbox" checked={showApproved} onChange={(event) => setShowApproved(event.target.checked)} /> Mostrar aprobados</label></div><AdvisorState loading={loading} error={!selected ? error : ""} empty={!loading && !error && !filtered.length} onRetry={() => setRevision((value) => value + 1)} />{!loading && filtered.length > 0 && <div className="advisor-table-wrap"><table className="advisor-table advisor-table--responsive"><thead><tr><th>Solicitante</th><th>Progreso</th><th>Actualización</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{filtered.map((form) => <tr key={form.id}><td data-label="Solicitante"><strong>{form.name}</strong><small>{form.profile}</small></td><td data-label="Progreso"><span className="advisor-progress"><i style={{ width: `${form.progress}%` }} /></span><small>{form.progress}% · {form.completed ? "Completado" : `Sección ${form.currentSection}`}</small></td><td data-label="Actualización">{formatDate(form.updatedAt, true)}</td><td data-label="Estado"><span className={`advisor-badge advisor-badge--${form.status}`}>{labels[form.status] || "Sin estado"}</span></td><td data-label="Acción">{form.status === "aprobado" ? <div><button className="advisor-action" type="button" onClick={() => open(form)}>Consultar</button><button className="advisor-action" type="button" disabled aria-describedby={`approved-form-${form.id}`}>Revisar</button><small id={`approved-form-${form.id}`}>Formulario aprobado</small></div> : <button className="advisor-action" type="button" onClick={() => open(form)}>Revisar</button>}</td></tr>)}</tbody></table></div>}</section>
    {selected && <AdvisorModal title={`DS-160 · ${selected.name}`} subtitle={selected.email} onClose={close} footer={<><button className="advisor-button advisor-button--secondary" type="button" onClick={close}>Cerrar</button>{!approved && <button className="advisor-button" type="button" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar revisión"}</button>}</>}>
      <AdvisorAlert message={error} onDismiss={() => setError("")} />
      <div className="advisor-form-review"><div className="advisor-form-review__answers"><label className="advisor-section-select">Sección <select value={sectionIndex} onChange={(event) => setSectionIndex(Number(event.target.value))}>{sections.map((item, index) => <option key={item.id} value={index}>{item.titulo}</option>)}</select></label><h3>{section?.titulo}</h3><dl>{section?.campos.filter((field) => !field.dependeDe || selected.data?.[field.dependeDe.campo] === field.dependeDe.valor || Boolean(selected.data?.[field.name])).map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{displayValue(selected.data?.[field.name])}</dd></div>)}</dl><div className="advisor-section-nav"><button type="button" disabled={sectionIndex === 0} onClick={() => setSectionIndex((value) => value - 1)}>Anterior</button><span>{sectionIndex + 1} / {sections.length}</span><button type="button" disabled={sectionIndex >= sections.length - 1} onClick={() => setSectionIndex((value) => value + 1)}>Siguiente</button></div></div><div className="advisor-form-review__controls">{approved ? <><strong>Formulario aprobado</strong><p>{feedback || "Sin observaciones."}</p></> : <><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}>{reviewStates.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Retroalimentación<textarea rows="6" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Observaciones para el solicitante" /></label></>}</div></div>
    </AdvisorModal>}
  </>;
}
