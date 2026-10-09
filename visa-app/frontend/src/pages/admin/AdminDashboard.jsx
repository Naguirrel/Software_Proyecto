import { BriefcaseBusiness, CheckCircle2, ClipboardCheck, FileClock, Gauge, MessageSquareText, UserRoundPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import AdminAdvancedFilters from "../../components/admin/AdminAdvancedFilters";
import { EMPTY_ADMIN_FILTERS } from "../../utils/adminFilters";
import AdminLayout from "../../components/admin/AdminLayout";
import { AdminGroupedBarChart } from "../../components/admin/AdminCharts";
import { AdminResourceState } from "../../components/admin/AdminShared";
import useAdminResource from "../../hooks/useAdminResource";

const headlineStats = [
  ["Solicitudes activas", "solicitudesActivas", "/admin/processes", "blue", <Users aria-hidden="true" />],
  ["Sin asignar", "sinAsignar", "/admin/assignments", "red", <UserRoundPlus aria-hidden="true" />],
  ["Asesores activos", "asesoresActivos", "/admin/advisors", "green", <BriefcaseBusiness aria-hidden="true" />],
  ["DS-160 pendientes", "ds160Pendientes", "/admin/ds160", "amber", <ClipboardCheck aria-hidden="true" />],
];

const additionalMetrics = [
  ["Documentos pendientes", "documentosPendientes", "/admin/documents", <FileClock aria-hidden="true" />],
  ["Entrevistas pendientes", "entrevistasPendientes", "/admin/interviews", <MessageSquareText aria-hidden="true" />],
  ["Usuarios nuevos", "usuariosNuevos30d", "/admin/users", <Users aria-hidden="true" />, "Últimos 30 días"],
  ["Trámites completados", "solicitudesCompletadas", "/admin/reports", <CheckCircle2 aria-hidden="true" />, "Histórico"],
];

function formatActivityDate(value) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminDashboard() {
  const [filters, setFilters] = useState(EMPTY_ADMIN_FILTERS);
  const [status, setStatus] = useState("");
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.advisor) params.set("advisor", filters.advisor);
  if (status) params.set("status", status);
  const resource = useAdminResource(`/admin/dashboard${params.size ? `?${params}` : ""}`);
  const advisors = useAdminResource("/admin/advisors");
  const candidate = resource.data;
  const data = candidate?.resumen
    && Array.isArray(candidate.cargaAsesores)
    && Array.isArray(candidate.actividad)
    && Array.isArray(candidate.atencion)
    && Array.isArray(candidate.pendientes)
    ? candidate
    : null;

  return <AdminLayout>
    <section className="admin-hero"><h1>Panel de Administración Global</h1><p>Supervisa el rendimiento, la carga de trabajo y el estado general de la plataforma.</p></section>
    <AdminAdvancedFilters value={filters} onChange={setFilters} advisors={advisors.data?.asesores || []}
      dateLabel="Fecha de creación de la solicitud (UTC)" status={status}
      statuses={[{ value: "", label: "Todos" }, ...["En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"].map((value) => ({ value, label: value }))]}
      onStatusChange={setStatus} onReset={() => { setFilters(EMPTY_ADMIN_FILTERS); setStatus(""); }} />
    <p>Los indicadores y la actividad se limitan a las solicitudes seleccionadas. Al filtrar, se omiten los eventos administrativos sin solicitud asociada.</p>
    {advisors.error && <p role="alert">No se pudieron cargar los asesores. <button type="button" onClick={advisors.retry}>Reintentar asesores</button></p>}
    <AdminResourceState {...resource} />
    {data && !resource.isLoading && !resource.error && <>
      {data.resumen.sinAsignar > 0 && (
        <Link className="admin-assignment-alert" to="/admin/assignments">
          <UserRoundPlus aria-hidden="true" />
          <span><strong>{data.resumen.sinAsignar} solicitudes esperan un asesor</strong><small>Estas asignaciones bloquean el avance de los solicitantes y deben atenderse primero.</small></span>
          <b>Asignar ahora →</b>
        </Link>
      )}
      <section className="admin-stats-grid" aria-label="Indicadores administrativos">
        {headlineStats.map(([label, key, path, tone, icon]) => <article className={`admin-stat-card admin-stat-card--${tone}`} key={key}><span className="admin-stat-card__icon">{icon}</span><strong>{data.resumen[key]}</strong><h3>{label}</h3><Link to={path}>Ver detalles →</Link></article>)}
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel-card admin-workload-card"><div className="admin-panel-card__header"><h2>Carga de trabajo por asesor (Top 4)</h2><Link to="/admin/reports">Ver reporte completo</Link></div><AdminGroupedBarChart items={data.cargaAsesores} /></section>
        <section className="admin-panel-card" aria-labelledby="recent-activity-title"><div className="admin-panel-card__header"><h2 id="recent-activity-title">Actividad reciente</h2></div>{data.actividad.length ? <ol className="admin-activity-list">{data.actividad.map((item) => <li key={item.id}><strong>{item.accion}</strong><span>{item.actor || "Sistema"}{item.detalle ? ` · ${item.detalle}` : ""}</span><small>{formatActivityDate(item.created_at)}</small>{item.destino && <Link to={item.destino}>Ver detalle</Link>}</li>)}</ol> : <div className="admin-empty-state"><strong>Sin actividad reciente</strong><p>Los eventos de la plataforma aparecerán aquí.</p></div>}</section>
      </div>

      <section className="admin-panel-card admin-dashboard-section"><div className="admin-panel-card__header"><h2>Casos que requieren atención</h2><Link to="/admin/processes">Ver todos</Link></div>{data.atencion.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Solicitante</th><th>Tipo / etapa</th><th>Motivo</th><th>Acción</th></tr></thead><tbody>{data.atencion.map((item) => <tr className={!item.asesor ? "admin-attention-row--urgent" : ""} key={item.id}><td><strong>{item.nombre}</strong><small>{item.correo}</small></td><td>{item.perfil || "Sin perfil"}<small>{item.etapa_actual}</small></td><td><span className="admin-status admin-status--correction">{item.asesor ? item.estado : "Sin asignar · bloqueado"}</span></td><td><Link className="admin-secondary-button" to={item.asesor ? `/admin/processes/${item.id}` : "/admin/assignments"}>{item.asesor ? "Resolver" : "Asignar"}</Link></td></tr>)}</tbody></table></div> : <div className="admin-empty-state admin-empty-state--compact"><strong>No hay casos que requieran atención</strong></div>}</section>

      <div className="admin-dashboard-grid admin-dashboard-grid--operations">
        <section className="admin-panel-card" aria-labelledby="pending-title"><div className="admin-panel-card__header"><h2 id="pending-title">Pendientes por atender</h2></div><div className="admin-pending-list">{data.pendientes.map((item) => <Link to={item.destino} key={item.id}><span>{item.label}</span><strong>{item.total}</strong><small>Revisar →</small></Link>)}</div></section>
        <section className="admin-dashboard-section admin-dashboard-extras" aria-labelledby="additional-metrics-title"><div className="admin-dashboard-section__heading"><div><h2 id="additional-metrics-title">Métricas adicionales</h2><p>Indicadores operativos calculados con los datos actuales.</p></div><Link to="/admin/reports">Ver reportes</Link></div><div className="admin-insights-grid">{additionalMetrics.map(([label, key, path, icon, helper]) => <Link className="admin-insight-card" to={path} key={key}><span>{icon}</span><div><strong>{data.resumen[key]}</strong><h3>{label}</h3>{helper && <small>{helper}</small>}</div></Link>)}<article className="admin-insight-card admin-insight-card--wide"><span><Gauge aria-hidden="true" /></span><div><strong>{data.resumen.progresoPromedio}%</strong><h3>Progreso promedio</h3><small>{data.resumen.tasaCompletitud}% de trámites completados</small></div></article></div></section>
      </div>
    </>}
  </AdminLayout>;
}
