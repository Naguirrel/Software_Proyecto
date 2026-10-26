import { useEffect, useMemo, useState } from "react";
import { Eye, FileText } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AdvisorAlert, AdvisorModal, AdvisorPageHeader, AdvisorPagination, AdvisorSearch, AdvisorState, AdvisorTabs } from "../../components/advisor/AdvisorShared";
import AdvisorDocumentPreview from "../../components/advisor/AdvisorDocumentPreview";
import { advisorRequest } from "../../utils/advisorApi";
import { openDocumentPreview } from "../../utils/documentPreview";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";
import useSessionStorageState from "../../hooks/useSessionStorageState";

const tabs = [{ value: "all", label: "Todos" }, { value: "missing", label: "Pendiente de entrega" }, { value: "pending", label: "Pendiente de revisión" }, { value: "review", label: "En revisión" }, { value: "correction", label: "Corrección requerida" }];
const labels = { pending: "Pendiente de revisión", review: "En revisión", correction: "Corrección requerida", approved: "Aprobado", missing: "Pendiente de entrega" };
const normalizedStatus = (status) => status === "rejected" ? "correction" : status || "pending";

export default function AdvisorDocuments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [missing, setMissing] = useState([]);
  const [tab, setTab] = useSessionStorageState("advisor-document-tab", "all");
  const [query, setQuery] = useSessionStorageState("advisor-document-query", "");
  const [showApproved, setShowApproved] = useSessionStorageState("advisor-document-approved", false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState("");
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("correction");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    advisorRequest("/documents", { signal: controller.signal }).then((data) => { setDocuments(data.documents || []); setMissing(data.missingDocuments || []); })
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const requested = documents.find((document) => document.id === Number(searchParams.get("document")));
    if (requested && selected?.id !== requested.id) open(requested);
  }, [documents, searchParams, selected?.id]);

  const filtered = useMemo(() => [...documents.map((item) => ({ ...item, state: normalizedStatus(item.estado) })), ...missing.map((item) => ({ ...item, state: "missing" }))]
    .filter((item) => (showApproved || item.state !== "approved") && (tab === "all" || !tabs.some((entry) => entry.value === tab) || item.state === tab) && `${item.nombre} ${item.usuario?.nombre} ${item.usuario?.correo}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const priority = (item) => ["review", "pending"].includes(item.state) ? 0 : item.state === "missing" ? 1 : item.state === "correction" ? 2 : 3;
      return priority(a) - priority(b) || (Date.parse(b.actualizado_en || b.creado_en) || 0) - (Date.parse(a.actualizado_en || a.creado_en) || 0) || (b.id || 0) - (a.id || 0) || a.nombre.localeCompare(b.nombre);
    }), [documents, missing, query, showApproved, tab]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const open = (document) => { setSelected(document); setStatus("correction"); setFeedback(document.feedback || ""); setError(""); };
  const close = () => { setSelected(null); setSearchParams({}); setError(""); };
  const save = async () => {
    if (saving || normalizedStatus(selected.estado) === "approved") return;
    if (status === "correction" && !feedback.trim()) { setError("Describe la corrección que debe realizar el solicitante."); return; }
    try {
      setSaving(true); setError("");
      const data = await advisorRequest(`/documents/${selected.id}`, { method: "PUT", body: JSON.stringify({ status, feedback }) });
      setDocuments((current) => current.map((item) => item.id === data.document.id ? data.document : item));
      close();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const remind = async (item) => {
    if (sending) return;
    const id = `${item.usuario.id}:${item.key}`; setSending(id); setError(""); setNotice("");
    try {
      const data = await advisorRequest("/documents/reminders", { method: "POST", body: JSON.stringify({ userId: item.usuario.id, key: item.key }) });
      setNotice(data.message);
    } catch (requestError) { setError(requestError.message); }
    finally { setSending(""); }
  };
  const approved = selected && normalizedStatus(selected.estado) === "approved";
  return <>
    <AdvisorPageHeader title="Revisión de documentos" description="Gestiona y revisa los documentos de tus solicitantes." />
    <AdvisorTabs items={tabs} value={tabs.some((item) => item.value === tab) ? tab : "all"} onChange={(value) => { setTab(value); setPage(1); }} label="Filtrar documentos" />
    <section className="advisor-panel"><div className="advisor-panel-toolbar"><AdvisorSearch value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Buscar por solicitante o documento…" /><label className="advisor-include-inactive"><input type="checkbox" checked={showApproved} onChange={(event) => { setShowApproved(event.target.checked); setPage(1); }} /> Mostrar aprobados</label></div>
      <AdvisorAlert message={notice} tone="success" duration={5000} onDismiss={() => setNotice("")} />
      {error && !selected && <><AdvisorAlert message={error} onDismiss={() => setError("")} /><button className="advisor-action" type="button" onClick={() => setRevision((value) => value + 1)}>Actualizar listado</button></>}
      <AdvisorState loading={loading} empty={!loading && !error && !filtered.length} onRetry={() => setRevision((value) => value + 1)} />
      {!loading && filtered.length > 0 && <div className="advisor-table-wrap"><table className="advisor-table advisor-table--responsive"><thead><tr><th>Documento</th><th>Solicitante</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{visible.map((item) => <tr key={item.state === "missing" ? `${item.usuario.id}:${item.key}` : item.id}><td data-label="Documento"><span className="advisor-document"><FileText aria-hidden="true" /><span><strong>{item.nombre}</strong></span></span></td><td data-label="Solicitante"><strong>{item.usuario?.nombre}</strong><small>{item.usuario?.correo}</small></td><td data-label="Fecha">{item.state === "missing" ? "No entregado" : formatDate(item.actualizado_en || item.creado_en)}</td><td data-label="Estado"><span className={`advisor-badge advisor-badge--${item.state}`}>{labels[item.state] || "Sin estado"}</span></td><td data-label="Acción">{item.state === "missing" ? <button className="advisor-action" type="button" disabled={Boolean(sending)} onClick={() => remind(item)}>{sending === `${item.usuario.id}:${item.key}` ? "Enviando…" : "Enviar recordatorio"}</button> : item.state === "approved" ? <div><button className="advisor-action" type="button" onClick={() => open(item)}>Consultar</button><button className="advisor-action" type="button" disabled aria-describedby={`approved-${item.id}`}>Revisar</button><small id={`approved-${item.id}`}>Documento aprobado</small></div> : <button className="advisor-action" type="button" onClick={() => open(item)}>Revisar</button>}</td></tr>)}</tbody></table></div>}
      <AdvisorPagination page={currentPage} pages={pages} total={filtered.length} visible={visible.length} onChange={setPage} />
    </section>
    {selected && <AdvisorModal title={selected.nombre} subtitle={selected.usuario?.nombre} onClose={close} footer={<><button className="advisor-button advisor-button--secondary" type="button" onClick={() => openDocumentPreview(selected)}><Eye size={18} aria-hidden="true" /> Abrir archivo</button>{!approved && <button className="advisor-button" type="button" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar revisión"}</button>}</>}>
      <AdvisorAlert message={error} onDismiss={() => setError("")} />
      <AdvisorDocumentPreview key={selected.id} document={selected} />
      {approved ? <p>Documento aprobado.{feedback && ` Observaciones: ${feedback}`}</p> : <div className="advisor-form-grid"><label>Resultado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="approved">Aprobar</option><option value="correction">Solicitar corrección</option></select></label><label className="advisor-form-grid__wide">Observaciones<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows="5" placeholder="Indica observaciones claras para el solicitante." /></label></div>}
    </AdvisorModal>}
  </>;
}
