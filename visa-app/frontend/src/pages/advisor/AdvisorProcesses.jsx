import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Filter } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorModal, AdvisorPageHeader, AdvisorSearch, AdvisorState } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate } from "../../utils/advisorFormat";

const states = ["Todos", "En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"];
const stages = ["Configuración de perfil", "Formulario DS-160", "Pago de visa", "Pago consular", "Cita consular", "Entrevista", "Decisión final", "Completado"];

function tone(status) {
  if (["Aprobado", "Completado"].includes(status)) return "approved";
  if (status === "Pendiente") return "review";
  if (status === "Inactivo") return "neutral";
  return "progress";
}

export default function AdvisorProcesses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [processes, setProcesses] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [ascending, setAscending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    advisorRequest("/processes", { signal: controller.signal }).then((data) => setProcesses(data.processes || []))
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const processId = Number(searchParams.get("process"));
    const process = processes.find((item) => item.id === processId);
    if (process) openProcess(process);
  }, [processes, searchParams]);

  const filtered = useMemo(() => processes.filter((process) => {
    const text = `${process.solicitante.nombre} ${process.solicitante.correo} ${process.solicitante.perfil}`.toLowerCase();
    return (status === "Todos" || process.estado === status) && text.includes(query.trim().toLowerCase());
  }).sort((left, right) => ascending ? left.id - right.id : right.id - left.id), [ascending, processes, query, status]);

  const openProcess = async (process) => {
    setSelected(process); setDetail(null); setDraft({ estado: process.estado, etapaActual: process.etapaActual }); setError("");
    try { setDetail(await advisorRequest(`/processes/${process.id}`)); }
    catch (requestError) { setError(requestError.message); }
  };
  const close = () => { setSelected(null); setDetail(null); setDraft(null); setSearchParams({}); setError(""); };
  const save = async () => {
    try {
      setSaving(true); setError("");
      const data = await advisorRequest(`/processes/${selected.id}`, { method: "PUT", body: JSON.stringify(draft) });
      setProcesses((current) => current.map((item) => item.id === data.process.id ? { ...item, ...data.process } : item));
      close();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  return <AdvisorLayout>
    <AdvisorPageHeader title="Solicitudes" description="Gestiona y da seguimiento a tus solicitantes." />
    <section className="advisor-toolbar"><AdvisorSearch value={query} onChange={setQuery} placeholder="Buscar por nombre o correo…" /><div><label className="advisor-filter"><Filter size={18} aria-hidden="true" /><span className="visually-hidden">Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{states.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={() => setAscending((value) => !value)}><ArrowDownUp size={18} aria-hidden="true" /> Ordenar</button></div></section>
    <section className="advisor-panel"><AdvisorState loading={loading} error={!selected ? error : ""} empty={!loading && !filtered.length} onRetry={() => setRevision((value) => value + 1)} />{!loading && filtered.length > 0 && <div className="advisor-table-wrap"><table className="advisor-table"><thead><tr><th>Solicitante</th><th>Perfil / etapa</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filtered.map((process) => <tr key={process.id}><td><strong>{process.solicitante.nombre}</strong><small>{process.solicitante.correo}</small></td><td><strong>{process.solicitante.perfil}</strong><small>{process.etapaActual}</small></td><td><span className={`advisor-badge advisor-badge--${tone(process.estado)}`}>{process.estado}</span></td><td><button className="advisor-action" type="button" onClick={() => openProcess(process)}>Ver detalles</button></td></tr>)}</tbody></table></div>}<footer className="advisor-results">Mostrando {filtered.length} solicitudes</footer></section>
    {selected && <AdvisorModal title={selected.solicitante.nombre} subtitle={selected.solicitante.correo} onClose={close} footer={<><button className="advisor-button advisor-button--secondary" type="button" onClick={close}>Cancelar</button><button className="advisor-button" type="button" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></>}>
      <AdvisorState loading={!detail && !error} error={error} />
      {detail && <div className="advisor-process-detail"><dl><div><dt>Perfil</dt><dd>{detail.process.solicitante.perfil}</dd></div><div><dt>Teléfono</dt><dd>{detail.process.solicitante.telefono || "No registrado"}</dd></div><div><dt>Actualizado</dt><dd>{formatAdvisorDate(detail.process.updatedAt, true)}</dd></div></dl><div className="advisor-form-grid"><label>Estado<select value={draft.estado} onChange={(event) => setDraft({ ...draft, estado: event.target.value })}>{states.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>Etapa actual<select value={draft.etapaActual} onChange={(event) => setDraft({ ...draft, etapaActual: event.target.value })}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="advisor-detail-counts"><span><strong>{detail.documents.length}</strong> documentos</span><span><strong>{detail.ds160 ? `${detail.ds160.progress}%` : "—"}</strong> DS-160</span><span><strong>{detail.interviews.length}</strong> entrevistas</span></div>{detail.history?.length > 0 && <section><h3>Historial reciente</h3><ul className="advisor-history">{detail.history.slice(0, 5).map((item) => <li key={item.id}>{item.fieldName || item.field_name}: {item.newValue || item.new_value}<time>{formatAdvisorDate(item.changedAt || item.changed_at, true)}</time></li>)}</ul></section>}</div>}
    </AdvisorModal>}
  </AdvisorLayout>;
}
