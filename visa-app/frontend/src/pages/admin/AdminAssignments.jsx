import { useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminAdvancedFilters from "../../components/admin/AdminAdvancedFilters";
import { EMPTY_ADMIN_FILTERS, advisorOptions, matchesAdminFilters } from "../../utils/adminFilters";
import { AdminPageHeader, AdminResourceState, AdminSearch } from "../../components/admin/AdminShared";
import useAdminResource, { adminRequest } from "../../hooks/useAdminResource";

function getWaitingTime(value) {
  if (!value) return "Fecha no disponible";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000));
  if (hours < 1) return "Menos de una hora";
  if (hours < 24) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "día" : "días"}`;
}

function getPriority(value) {
  if (!value) return { label: "Media", tone: "review" };
  const hours = Math.max(0, (Date.now() - new Date(value).getTime()) / 3600000);
  if (hours >= 24) return { label: "Alta", tone: "correction" };
  if (hours >= 4) return { label: "Media", tone: "review" };
  return { label: "Baja", tone: "progress" };
}

export default function AdminAssignments() {
  const resource = useAdminResource("/admin/assignments");
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_ADMIN_FILTERS);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [assigningAdvisorId, setAssigningAdvisorId] = useState(null);
  const cases = resource.data?.casos || [];
  const advisors = useMemo(() => resource.data?.asesores || [], [resource.data]);
  const filteredCases = cases.filter((item) => (!status || item.estado === status) && matchesAdminFilters({ ...filters, advisor: "" }, item.created_at, null));
  const filteredAdvisors = useMemo(() => advisors.filter((item) => (!filters.advisor || String(item.id) === filters.advisor) && item.nombre.toLowerCase().includes(query.toLowerCase())), [advisors, query, filters.advisor]);
  const assign = async (advisor) => {
    if (!selected || assigningAdvisorId !== null) return;
    const selectedId = selected.id;
    setAssigningAdvisorId(advisor.id);
    setNotice("");
    try {
      await adminRequest("/admin/assignments", { method: "POST", body: JSON.stringify({ tramiteId: selectedId, asesorId: advisor.id }) });
      setNotice("Solicitud asignada correctamente.");
      setSelected(null);
      resource.setData((current) => current ? { ...current, casos: (current.casos || []).filter((item) => item.id !== selectedId) } : current);
      resource.retry();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setAssigningAdvisorId(null);
    }
  };
  return <AdminLayout><AdminPageHeader title="Asignaciones" description="Asigna solicitudes pendientes a los asesores disponibles." />{notice && <p className="admin-feedback" role="status">{notice}</p>}
    <AdminAdvancedFilters value={filters} onChange={(value) => { setFilters(value); setSelected(null); }} advisors={advisorOptions(advisors)} allowUnassigned={false}
      status={status} statuses={[{ value: "", label: "Todos" }, ...["En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"].map((value) => ({ value, label: value }))]}
      onStatusChange={(value) => { setStatus(value); setSelected(null); }} onReset={() => { setFilters(EMPTY_ADMIN_FILTERS); setStatus(""); setQuery(""); setSelected(null); }} />
    <p>Fecha y estado filtran los casos sin asignar. Asesor filtra los candidatos disponibles para la asignación.</p><AdminResourceState {...resource} isEmpty={!cases.length && !advisors.length} empty="No hay solicitudes ni asesores disponibles." />
    {!resource.isLoading && !resource.error && <div className="admin-assignment-grid"><section className="admin-list-card admin-list-card--priority"><header className="admin-card-title"><div><span className="admin-priority-kicker">PRIORIDAD OPERATIVA</span><h3>Casos sin asignar <span>{filteredCases.length}</span></h3><p>Ordenados del mayor al menor tiempo de espera.</p></div></header>{filteredCases.length ? <div className="admin-case-list">{filteredCases.map((item, index) => { const priority = getPriority(item.created_at); return <button type="button" disabled={assigningAdvisorId !== null} className={`${selected?.id === item.id ? "is-selected " : ""}${index === 0 ? "is-oldest" : ""}`.trim()} key={item.id} onClick={() => setSelected(item)}><span className={`admin-status admin-status--${priority.tone}`}>{index === 0 ? `Siguiente · ${priority.label}` : priority.label}</span><strong>{item.nombre}</strong><span>{item.perfil || "Sin perfil"}</span><small>{item.etapa_actual}</small><small>Tiempo sin asesor: {getWaitingTime(item.created_at)}</small></button>; })}</div> : <p className="admin-inline-empty">No hay casos sin asignar que coincidan con los filtros.</p>}</section><section className="admin-list-card"><header className="admin-card-title"><h3>Asesores disponibles</h3><AdminSearch value={query} onChange={setQuery} placeholder="Buscar asesor..." /></header><div className="admin-case-list">{!filteredAdvisors.length && <p className="admin-inline-empty">No hay asesores que coincidan con los filtros.</p>}{filteredAdvisors.map((advisor) => { const load = Math.round(advisor.asignados / advisor.capacidad * 100); const disabled = !selected || !advisor.disponible || load >= 100 || assigningAdvisorId !== null; return <article className="admin-assignee" key={advisor.id}><b>{advisor.nombre.slice(0,2).toUpperCase()}</b><div><strong>{advisor.nombre}</strong><span>{advisor.disponible ? "Disponible" : "No disponible"}</span><span>{advisor.asignados} / {advisor.capacidad} casos · {load}%</span><span className="admin-load-track"><i style={{ width: `${Math.min(100, load)}%` }} /></span></div><button type="button" disabled={disabled} onClick={() => assign(advisor)}>{assigningAdvisorId === advisor.id ? "Asignando…" : selected ? "Asignar" : "Selecciona un caso"}</button></article>; })}</div></section></div>}
  </AdminLayout>;
}
