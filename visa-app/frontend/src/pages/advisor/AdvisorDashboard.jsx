import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, FileText, MessageSquareText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { AdvisorPageHeader, AdvisorState } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate } from "../../utils/advisorFormat";

const cards = [
  { key: "activeProcesses", label: "Solicitudes activas", path: "/advisor/solicitudes", icon: <Users aria-hidden="true" />, tone: "blue" },
  { key: "pendingDocuments", label: "Documentos pendientes", path: "/advisor/documentos", icon: <FileText aria-hidden="true" />, tone: "orange" },
  { key: "pendingDs160", label: "DS-160 por revisar", path: "/advisor/ds160", icon: <ClipboardCheck aria-hidden="true" />, tone: "green" },
  { key: "pendingInterviews", label: "Entrevistas pendientes", path: "/advisor/entrevistas", icon: <MessageSquareText aria-hidden="true" />, tone: "purple" },
  { key: "unreadMessages", label: "Mensajes sin leer", path: "/advisor/chat", icon: <MessageSquareText aria-hidden="true" />, tone: "blue" },
  { key: "pendingTasks", label: "Tareas pendientes", path: "/advisor/tareas", icon: <CheckCircle2 aria-hidden="true" />, tone: "orange" },
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

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("advisor:notification", refresh);
    return () => window.removeEventListener("advisor:notification", refresh);
  }, []);

  return <>
    <AdvisorPageHeader title="Panel de asesoría" description="Supervisa tus solicitudes y actividades asignadas." />
    <AdvisorState loading={!data && !error} error={error} onRetry={() => { setError(""); setData(null); setRevision((value) => value + 1); }} />
    {data && <>
      <section className="advisor-stat-grid" aria-label="Resumen">
        {cards.map(({ key, label, path, icon, tone }) => <Link className={`advisor-stat advisor-stat--${tone}`} to={path} key={key}><div>{icon}<strong>{data.stats?.[key] || 0}</strong></div><p>{label}</p><span>Ver detalles <ArrowRight size={17} aria-hidden="true" /></span></Link>)}
      </section>
      <div className="advisor-dashboard-grid">
        <section className="advisor-panel advisor-work-queue"><header><div><span className="advisor-section-eyebrow">Prioridad operativa</span><h2>Requiere tu atención</h2></div><Link to="/advisor/tareas">Ver tareas</Link></header>{data.workQueue?.length ? <ul>{data.workQueue.map((item) => <li key={`${item.type}-${item.id}`} className={item.priority === "high" ? "is-high" : ""}><Link to={item.actionUrl}><span className="advisor-work-queue__icon">{item.type === "task" ? <CheckCircle2 aria-hidden="true" /> : item.type === "chat" ? <MessageSquareText aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}</span><span><strong>{item.title}</strong><small>{item.description}</small></span><span className="advisor-work-queue__meta">{item.overdue ? <b>Vencida</b> : item.priority === "high" ? <b>Prioridad alta</b> : null}<time><Clock3 aria-hidden="true" />{formatAdvisorDate(item.dueAt || item.createdAt, true)}</time></span><ArrowRight aria-hidden="true" /></Link></li>)}</ul> : <p className="advisor-empty">Todo está al día. No hay pendientes inmediatos.</p>}</section>
        <section className="advisor-panel advisor-activity" data-senior-priority="secondary"><header><h2>Actividad reciente</h2></header>{data.activity?.length ? <ul>{data.activity.map((item) => <li key={item.id}><span aria-hidden="true" /><div><time>{formatAdvisorDate(item.createdAt, true)}</time><strong>{item.description || item.action}</strong></div></li>)}</ul> : <p className="advisor-empty">Aún no hay actividad registrada.</p>}</section>
      </div>
      <section className="advisor-panel advisor-attention"><header><h2>Solicitudes activas destacadas</h2><Link to="/advisor/solicitudes">Ver todas</Link></header>{data.attention?.length ? <div className="advisor-table-wrap"><table className="advisor-table advisor-table--responsive"><thead><tr><th>Solicitante</th><th>Perfil / etapa</th><th>Acción</th></tr></thead><tbody>{data.attention.map((process) => <tr key={process.id}><td data-label="Solicitante"><strong>{process.solicitante.nombre}</strong><small>{process.estado}</small></td><td data-label="Perfil / etapa"><strong>{process.solicitante.perfil}</strong><small>{process.etapaActual}</small></td><td data-label="Acción"><Link className="advisor-action" to={`/advisor/solicitudes?process=${process.id}`}>Ver solicitud</Link></td></tr>)}</tbody></table></div> : <p className="advisor-empty">No hay solicitudes pendientes.</p>}</section>
    </>}
  </>;
}
