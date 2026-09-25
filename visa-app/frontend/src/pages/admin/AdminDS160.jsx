import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminAdvancedFilters from "../../components/admin/AdminAdvancedFilters";
import { EMPTY_ADMIN_FILTERS, advisorOptions, matchesAdminFilters } from "../../utils/adminFilters";
import { AdminPageHeader, AdminResourceState, AdminSearch, AdminTabs } from "../../components/admin/AdminShared";
import useAdminResource, { adminRequest } from "../../hooks/useAdminResource";

const states = [
  { value: "todos", label: "Todos" },
  { value: "por_revisar", label: "Por revisar" },
  { value: "en_progreso", label: "En progreso" },
  { value: "correccion", label: "Corrección requerida" },
  { value: "aprobado", label: "Aprobado" },
];

const labels = { por_revisar: "Por revisar", en_progreso: "En progreso", correccion: "Corrección requerida", aprobado: "Aprobado" };

function statusTone(status) {
  if (status === "aprobado") return "approved";
  if (status === "correccion") return "correction";
  return "review";
}

export default function AdminDS160() {
  const resource = useAdminResource("/admin/ds160");
  const [tab, setTab] = useState("todos");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_ADMIN_FILTERS);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [draftStatus, setDraftStatus] = useState("por_revisar");
  const [isSaving, setIsSaving] = useState(false);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);
  const forms = useMemo(() => resource.data?.formularios || [], [resource.data]);
  const advisors = useMemo(() => advisorOptions(forms.map((item) => ({ id: item.asesor_id, nombre: item.asesor }))), [forms]);
  const filtered = useMemo(() => forms.filter((item) => {
    const searchable = `${item.nombre || ""} ${item.correo || ""} ${item.perfil || ""}`.toLowerCase();
    return (tab === "todos" || item.estado_revision === tab) && matchesAdminFilters(filters, item.created_at, item.asesor_id) && searchable.includes(query.toLowerCase());
  }), [forms, query, tab, filters]);

  useEffect(() => {
    if (!selected) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSelected(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  const closeForm = () => {
    setSelected(null);
    triggerRef.current?.focus();
  };

  const update = async () => {
    if (!selected) return;
    try {
      setIsSaving(true);
      await adminRequest(`/admin/ds160/${selected.id}`, { method: "PUT", body: JSON.stringify({ estado: draftStatus }) });
      setNotice("Formulario actualizado.");
      closeForm();
      resource.retry();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader title="DS-160 Globales" description="Supervisa el progreso y revisión de todos los formularios." />
      {notice && <p className="admin-feedback" role="status">{notice}</p>}
      <AdminTabs value={tab} onChange={setTab} items={states} label="Filtrar formularios" />
      <section className="admin-list-card">
        <AdminAdvancedFilters value={filters} onChange={setFilters} advisors={advisors} status={tab} statuses={states} onStatusChange={setTab}
          onReset={() => { setFilters(EMPTY_ADMIN_FILTERS); setTab("todos"); setQuery(""); }} />
        <div className="admin-list-toolbar"><AdminSearch value={query} onChange={setQuery} placeholder="Buscar formulario..." /></div>
        <AdminResourceState {...resource} isEmpty={!forms.length} empty="No hay formularios DS-160 registrados aún." />
        {!resource.isLoading && !resource.error && forms.length > 0 && (
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>Solicitante</th><th>Progreso</th><th>Asesor</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>{filtered.length ? filtered.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.nombre}</strong><small>{item.perfil || item.correo}</small></td>
                <td><div className="admin-progress"><span><i style={{ width: `${item.progreso}%` }} /></span><b>{item.progreso}%</b></div><small>{item.completado ? "Completado" : `Sección ${item.seccion_actual}`}</small></td>
                <td>{item.asesor || "Sin asignar"}</td>
                <td><span className={`admin-status admin-status--${statusTone(item.estado_revision)}`}>{labels[item.estado_revision] || item.estado_revision}</span></td>
                <td><button className="admin-action-button" type="button" onClick={(event) => { triggerRef.current = event.currentTarget; setDraftStatus(item.estado_revision || "por_revisar"); setSelected(item); }}>Ver formulario</button></td>
              </tr>
            )) : <tr><td colSpan="5" className="admin-table-state">{forms.length ? "No hay formularios que coincidan con los filtros aplicados." : "Aún no hay formularios DS-160. Aparecerán cuando los clientes inicien el proceso."}</td></tr>}</tbody>
          </table></div>
        )}
      </section>

      {selected && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeForm()}>
          <section className="admin-modal admin-ds160-detail" role="dialog" aria-modal="true" aria-labelledby="ds160-detail-title">
            <header className="admin-modal__header"><div><small>Formulario DS-160</small><h2 id="ds160-detail-title">{selected.nombre}</h2><p>{selected.perfil || selected.correo}</p></div><button className="admin-modal__close" ref={closeButtonRef} type="button" aria-label="Cerrar formulario" onClick={closeForm}><X aria-hidden="true" /></button></header>
            <div className="admin-ds160-detail__progress"><span>Progreso del formulario</span><strong>{selected.progreso}%</strong><div><i style={{ width: `${selected.progreso}%` }} /></div><small>{selected.completado ? "Formulario completado" : `Sección actual: ${selected.seccion_actual}`}</small></div>
            <dl><div><dt>Asesor asignado</dt><dd>{selected.asesor || "Sin asignar"}</dd></div><div><dt>Correo</dt><dd>{selected.correo}</dd></div></dl>
            <label>Estado de revisión<select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>{states.slice(1).map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}</select></label>
            <footer><button className="admin-secondary-button" type="button" onClick={closeForm}>Cancelar</button><button className="admin-primary-button" type="button" onClick={update} disabled={isSaving}>{isSaving ? "Guardando…" : "Guardar revisión"}</button></footer>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
