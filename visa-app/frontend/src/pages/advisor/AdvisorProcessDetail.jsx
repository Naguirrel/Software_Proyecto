import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { AdvisorAlert, AdvisorPageHeader, AdvisorState } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate } from "../../utils/advisorFormat";

const states = ["En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"];
const stages = ["Configuración de perfil", "Formulario DS-160", "Pago de visa", "Pago consular", "Cita consular", "Entrevista", "Decisión final", "Completado"];
const documentLabels = { pending: "Pendiente de revisión", review: "En revisión", correction: "Corrección requerida", rejected: "Corrección requerida", approved: "Aprobado" };
const ds160Labels = { en_progreso: "En progreso", por_revisar: "Por revisar", correccion: "Corrección requerida", aprobado: "Aprobado" };

export default function AdvisorProcessDetail() {
  const { id } = useParams();
  const location = useLocation();
  const returnTo = location.state?.returnTo || "/advisor/solicitudes";
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setDetail(null);
    advisorRequest(`/processes/${id}`, { signal: controller.signal })
      .then((data) => {
        setDetail(data);
        setDraft({ estado: data.process.estado, etapaActual: data.process.etapaActual });
        setError("");
      })
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError("");
    try {
      const data = await advisorRequest(`/processes/${id}`, { method: "PUT", body: JSON.stringify(draft) });
      setDetail((current) => ({ ...current, process: { ...current.process, ...data.process } }));
      setRevision((value) => value + 1);
    } catch (requestError) { setSaveError(requestError.message); }
    finally { setSaving(false); }
  };

  const process = detail?.process;
  const applicant = process?.solicitante;
  return <>
    <Link className="advisor-back-link" to={returnTo}><ArrowLeft size={18} aria-hidden="true" /> Volver a solicitudes</Link>
    <AdvisorPageHeader title={applicant ? `Solicitud de ${applicant.nombre}` : "Detalle de solicitud"} description="Consulta el proceso y sus avances registrados." />
    <AdvisorState loading={loading} error={error} onRetry={() => { setLoading(true); setRevision((value) => value + 1); }} />
    {process && !loading && <div className="advisor-detail-page">
      <section className="advisor-panel advisor-detail-section"><h2>Solicitante</h2><dl className="advisor-detail-list">
        <div><dt>Nombre</dt><dd>{applicant.nombre}</dd></div><div><dt>Correo</dt><dd>{applicant.correo}</dd></div>
        <div><dt>Perfil de visa</dt><dd>{applicant.perfil}</dd></div><div><dt>Teléfono</dt><dd>{applicant.telefono || "No registrado"}</dd></div>
        <div><dt>Ubicación</dt><dd>{[applicant.ciudad, applicant.pais].filter(Boolean).join(", ") || "No registrada"}</dd></div>
      </dl></section>
      <section className="advisor-panel advisor-detail-section"><h2>Proceso</h2><dl className="advisor-detail-list">
        <div><dt>Estado</dt><dd><span className="advisor-badge advisor-badge--progress">{process.estado}</span></dd></div>
        <div><dt>Etapa actual</dt><dd>{process.etapaActual}</dd></div><div><dt>Progreso</dt><dd>{process.progreso}%</dd></div>
        <div><dt>Siguiente paso</dt><dd>{process.siguientePaso || "Pendiente de definir"}</dd></div>
        <div><dt>Actualización</dt><dd>{formatAdvisorDate(process.updatedAt, true)}</dd></div>
      </dl><AdvisorAlert message={saveError} onDismiss={() => setSaveError("")} />
        <div className="advisor-form-grid"><label>Estado<select value={draft?.estado || ""} onChange={(event) => setDraft({ ...draft, estado: event.target.value })}>{states.map((item) => <option key={item}>{item}</option>)}</select></label><label>Etapa actual<select value={draft?.etapaActual || ""} onChange={(event) => setDraft({ ...draft, etapaActual: event.target.value })}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <div className="advisor-detail-actions"><button className="advisor-button" type="button" disabled={saving || (draft?.estado === process.estado && draft?.etapaActual === process.etapaActual)} onClick={save}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
      </section>
      <section className="advisor-panel advisor-detail-section"><h2>Documentos</h2>{detail.documents.length ? <ul className="advisor-detail-items">{detail.documents.map((document) => <li key={document.id}><div><strong>{document.nombre}</strong><small>{documentLabels[document.estado] || document.estado || "Sin estado"}{document.feedback ? ` · ${document.feedback}` : ""}</small></div><Link to={`/advisor/documentos?document=${document.id}`}>Consultar</Link></li>)}</ul> : <p>No hay documentos cargados.</p>}</section>
      <section className="advisor-panel advisor-detail-section"><h2>Formulario DS-160</h2>{detail.ds160 ? <div className="advisor-detail-summary"><p><strong>{ds160Labels[detail.ds160.status] || detail.ds160.status}</strong> · {detail.ds160.progress}% completado</p><p>Última actualización: {formatAdvisorDate(detail.ds160.updatedAt, true)}</p><Link to={`/advisor/ds160?form=${detail.ds160.id}`}>Consultar formulario</Link></div> : <p>El solicitante aún no ha registrado el formulario.</p>}</section>
      {detail.history?.length > 0 && <section className="advisor-panel advisor-detail-section"><h2>Historial del proceso</h2><ul className="advisor-history">{detail.history.map((item) => <li key={item.id}>{item.fieldName || item.field_name}: {item.newValue || item.new_value}<time>{formatAdvisorDate(item.changedAt || item.changed_at, true)}</time></li>)}</ul></section>}
    </div>}
  </>;
}
