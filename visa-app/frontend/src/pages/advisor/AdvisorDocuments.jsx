import { useEffect, useMemo, useState } from "react";
import { Eye, FileText } from "lucide-react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorModal, AdvisorPageHeader, AdvisorSearch, AdvisorState, AdvisorTabs } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { openDocumentPreview } from "../../utils/documentPreview";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";

const tabs = [
  { value: "all", label: "Todos" }, { value: "pending", label: "Pendiente" },
  { value: "review", label: "En revisión" }, { value: "correction", label: "Corrección requerida" },
  { value: "approved", label: "Aprobado" },
];
const labels = { pending: "Pendiente", review: "En revisión", correction: "Corrección requerida", rejected: "Corrección requerida", approved: "Aprobado" };

function normalizedStatus(status) { return status === "rejected" ? "correction" : status || "pending"; }

export default function AdvisorDocuments() {
  const [documents, setDocuments] = useState([]);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("approved");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    advisorRequest("/documents", { signal: controller.signal }).then((data) => setDocuments(data.documents || []))
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const filtered = useMemo(() => documents.filter((document) => {
    const current = normalizedStatus(document.estado);
    const text = `${document.nombre} ${document.tipo} ${document.usuario?.nombre} ${document.usuario?.correo}`.toLowerCase();
    return (tab === "all" || current === tab) && text.includes(query.trim().toLowerCase());
  }), [documents, query, tab]);

  const open = (document) => { setSelected(document); setStatus(normalizedStatus(document.estado) === "approved" ? "approved" : "correction"); setFeedback(document.feedback || ""); setError(""); };
  const save = async () => {
    if (status === "correction" && !feedback.trim()) { setError("Describe la corrección que debe realizar el solicitante."); return; }
    try {
      setSaving(true); setError("");
      const data = await advisorRequest(`/documents/${selected.id}`, { method: "PUT", body: JSON.stringify({ status, feedback }) });
      setDocuments((current) => current.map((item) => item.id === data.document.id ? data.document : item));
      setSelected(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  return <AdvisorLayout>
    <AdvisorPageHeader title="Revisión de documentos" description="Gestiona y revisa los documentos de tus solicitantes." />
    <AdvisorTabs items={tabs} value={tab} onChange={setTab} label="Filtrar documentos" />
    <section className="advisor-panel"><div className="advisor-panel-toolbar"><AdvisorSearch value={query} onChange={setQuery} placeholder="Buscar por solicitante o documento…" /></div><AdvisorState loading={loading} error={!selected ? error : ""} empty={!loading && !filtered.length} onRetry={() => setRevision((value) => value + 1)} />{!loading && filtered.length > 0 && <div className="advisor-table-wrap"><table className="advisor-table"><thead><tr><th>Documento</th><th>Solicitante</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{filtered.map((document) => { const state = normalizedStatus(document.estado); return <tr key={document.id}><td><span className="advisor-document"><FileText aria-hidden="true" /><span><strong>{document.nombre}</strong><small>{document.documento_key || document.tipo}</small></span></span></td><td><strong>{document.usuario?.nombre}</strong><small>{document.usuario?.correo}</small></td><td>{formatDate(document.actualizado_en || document.creado_en)}</td><td><span className={`advisor-badge advisor-badge--${state}`}>{labels[state]}</span></td><td><button className="advisor-action" type="button" onClick={() => open(document)}>Revisar</button></td></tr>; })}</tbody></table></div>}</section>
    {selected && <AdvisorModal title={selected.nombre} subtitle={selected.usuario?.nombre} onClose={() => setSelected(null)} footer={<><button className="advisor-button advisor-button--secondary" type="button" onClick={() => openDocumentPreview(selected)}><Eye size={18} aria-hidden="true" /> Abrir archivo</button><button className="advisor-button" type="button" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar revisión"}</button></>}>
      {error && <p className="advisor-inline-error" role="alert">{error}</p>}
      <div className="advisor-form-grid"><label>Resultado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="approved">Aprobar</option><option value="correction">Solicitar corrección</option></select></label><label className="advisor-form-grid__wide">Observaciones<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows="5" placeholder="Indica observaciones claras para el solicitante." /></label></div>
    </AdvisorModal>}
  </AdvisorLayout>;
}
