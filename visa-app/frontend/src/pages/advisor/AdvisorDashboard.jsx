import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, FileText, MessageSquareText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorPageHeader, AdvisorState } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate } from "../../utils/advisorFormat";

const cards = [
  { key: "activeProcesses", label: "Solicitudes activas", path: "/advisor/solicitudes", icon: <Users aria-hidden="true" />, tone: "blue" },
  { key: "pendingDocuments", label: "Documentos pendientes", path: "/advisor/documentos", icon: <FileText aria-hidden="true" />, tone: "orange" },
  { key: "pendingDs160", label: "DS-160 por revisar", path: "/advisor/ds160", icon: <ClipboardCheck aria-hidden="true" />, tone: "green" },
  { key: "pendingInterviews", label: "Entrevistas pendientes", path: "/advisor/entrevistas", icon: <MessageSquareText aria-hidden="true" />, tone: "purple" },
];

export default function AdvisorDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    advisorRequest("/dashboard", { signal: controller.signal })
      .then(setData)
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); });
    return () => controller.abort();
  }, [revision]);

  return <AdvisorLayout>
    <AdvisorPageHeader title="Panel de asesoría" description="Supervisa tus solicitudes y actividades asignadas." />
    <AdvisorState loading={!data && !error} error={error} onRetry={() => { setError(""); setData(null); setRevision((value) => value + 1); }} />
    {data && <>
      <section className="advisor-stat-grid" aria-label="Resumen">
        {cards.map(({ key, label, path, icon, tone }) => <article className={`advisor-stat advisor-stat--${tone}`} key={key}><div>{icon}<strong>{data.stats?.[key] || 0}</strong></div><p>{label}</p><Link to={path}>Ver detalles <ArrowRight size={17} aria-hidden="true" /></Link></article>)}
      </section>
      <div className="advisor-dashboard-grid">
        <section className="advisor-panel"><header><h2>Solicitudes que requieren atención</h2><Link to="/advisor/solicitudes">Ver todas</Link></header>{data.attention?.length ? <div className="advisor-table-wrap"><table className="advisor-table"><thead><tr><th>Solicitante</th><th>Perfil / etapa</th><th>Acción</th></tr></thead><tbody>{data.attention.map((process) => <tr key={process.id}><td><strong>{process.solicitante.nombre}</strong><small>{process.estado}</small></td><td><strong>{process.solicitante.perfil}</strong><small>{process.etapaActual}</small></td><td><Link className="advisor-action" to={`/advisor/solicitudes?process=${process.id}`}>Ver solicitud</Link></td></tr>)}</tbody></table></div> : <p className="advisor-empty">No hay solicitudes pendientes.</p>}</section>
        <section className="advisor-panel advisor-activity"><header><h2>Actividad reciente</h2></header>{data.activity?.length ? <ul>{data.activity.map((item) => <li key={item.id}><span aria-hidden="true" /><div><time>{formatAdvisorDate(item.createdAt, true)}</time><strong>{item.description || item.action}</strong></div></li>)}</ul> : <p className="advisor-empty">Aún no hay actividad registrada.</p>}</section>
      </div>
    </>}
  </AdvisorLayout>;
}
