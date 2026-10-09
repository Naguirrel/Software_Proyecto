import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminAdvancedFilters from "../../components/admin/AdminAdvancedFilters";
import { EMPTY_ADMIN_FILTERS, matchesAdminFilters } from "../../utils/adminFilters";
import { buildApiUrl } from "../../config/api";

const STATES = ["En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"];
const STAGES = [
  "Configuración de perfil",
  "Formulario DS-160",
  "Pago de visa",
  "Cita consular",
  "Entrevista",
  "Decisión final",
  "Completado",
];

function getToken() {
  return JSON.parse(localStorage.getItem("visaguide_session") || "null")?.token || "";
}

function statusClass(status) {
  if (status === "Aprobado" || status === "Completado") return "approved";
  if (status === "Pendiente") return "review";
  if (status === "Inactivo") return "correction";
  return "pending";
}

export default function AdminProcesses() {
  const [processes, setProcesses] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [filters, setFilters] = useState(EMPTY_ADMIN_FILTERS);
  const [sortOrder, setSortOrder] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(buildApiUrl("/admin/processes"), {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible cargar los trámites.");
        return data;
      })
      .then((data) => {
        setProcesses(data.tramites || []);
        setAdvisors(data.asesores || []);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  const filteredProcesses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    const matches = processes.filter((process) => {
      const matchesStatus = statusFilter === "Todos" || process.estado === statusFilter;
      const searchable = `${process.solicitante.nombre} ${process.solicitante.correo} ${process.solicitante.perfil}`.toLocaleLowerCase("es");
      return matchesStatus && matchesAdminFilters(filters, process.createdAt, process.asesor?.id) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
    return matches.sort((left, right) => sortOrder === "oldest" ? left.id - right.id : right.id - left.id);
  }, [processes, query, sortOrder, statusFilter, filters]);
  const pageCount = Math.max(1, Math.ceil(filteredProcesses.length / 8));
  const currentPage = Math.min(page, pageCount);
  const visibleProcesses = filteredProcesses.slice((currentPage - 1) * 8, currentPage * 8);

  const openManager = (process) => {
    setSelected(process);
    setDraft({
      estado: process.estado,
      etapaActual: process.etapaActual,
      asesorId: process.asesor?.id || "",
    });
    setError("");
  };

  const closeManager = () => {
    if (isSaving) return;
    setSelected(null);
    setDraft(null);
  };

  const saveProcess = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(buildApiUrl(`/admin/processes/${selected.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ ...draft, asesorId: draft.asesorId || null, expectedUpdatedAt: selected.updatedAt || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar el trámite.");
      setProcesses((current) => current.map((process) => process.id === data.tramite.id ? data.tramite : process));
      setSelected(null);
      setDraft(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <section className="admin-hero admin-processes-hero">
        <h1>Todas las solicitudes</h1>
        <p>Vista global de todos los expedientes en la plataforma.</p>
      </section>

      <section className="admin-process-toolbar" aria-label="Buscar y filtrar trámites">
        <label className="admin-process-search">
          <Search size={22} aria-hidden="true" />
          <span className="visually-hidden">Buscar solicitud</span>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Buscar por nombre o correo..."
          />
        </label>
        <div className="admin-process-toolbar__actions">
          <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((visible) => !visible)}>
            <Filter size={20} aria-hidden="true" /> Filtros
          </button>
          <button type="button" onClick={() => setSortOrder((order) => order === "newest" ? "oldest" : "newest")}>
            <SlidersHorizontal size={20} aria-hidden="true" /> Ordenar
          </button>
        </div>
        {showFilters && (
          <AdminAdvancedFilters value={filters} onChange={(value) => { setFilters(value); setPage(1); }} advisors={advisors}
            status={statusFilter} statuses={[{ value: "Todos", label: "Todos" }, ...STATES.map((value) => ({ value, label: value }))]}
            onStatusChange={(value) => { setStatusFilter(value); setPage(1); }}
            onReset={() => { setFilters(EMPTY_ADMIN_FILTERS); setStatusFilter("Todos"); setQuery(""); setPage(1); }} />
        )}
      </section>

      {error && !selected && <div className="admin-feedback admin-feedback--error" role="alert"><span>{error}</span><button type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar</button></div>}

      <section className="admin-process-table-card" aria-busy={isLoading}>
        <div className="admin-table-wrap">
          <table className="admin-table admin-process-table">
            <thead><tr><th>Solicitante</th><th>Perfil / etapa</th><th>Estado</th><th>Asesor asignado</th><th>Acciones</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan="5" className="admin-table-state">Cargando trámites...</td></tr>}
              {!isLoading && !filteredProcesses.length && (
                <tr><td colSpan="5" className="admin-table-state">No hay solicitudes que coincidan con los filtros.</td></tr>
              )}
              {visibleProcesses.map((process) => (
                <tr key={process.id}>
                  <td><strong className="admin-table-primary">{process.solicitante.nombre}</strong><span className="admin-table-secondary">{process.solicitante.correo}</span></td>
                  <td><strong className="admin-table-primary">{process.solicitante.perfil}</strong><span className="admin-table-secondary">{process.etapaActual}</span></td>
                  <td><span className={`admin-status admin-status--${statusClass(process.estado)}`}>{process.estado}</span></td>
                  <td className={process.asesor ? "" : "admin-process-unassigned"}>{process.asesor?.nombre || "Sin asignar"}</td>
                  <td>
                    <div className="admin-process-row-actions">
                      <Link className="admin-process-detail-link" to={`/admin/processes/${process.id}`}>Ver detalle</Link>
                      <button type="button" className="admin-process-manage" onClick={() => openManager(process)}>Gestionar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="admin-process-results">
          <span>Mostrando {visibleProcesses.length} de {filteredProcesses.length} solicitudes</span>
          <div aria-label="Paginación">
            <button type="button" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></button>
            <span>{currentPage} / {pageCount}</span>
            <button type="button" aria-label="Página siguiente" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></button>
          </div>
        </footer>
      </section>

      {selected && draft && (
        <div className="admin-process-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeManager()}>
          <section className="admin-process-dialog" role="dialog" aria-modal="true" aria-labelledby="process-dialog-title">
            <header>
              <div><span className="admin-section-kicker">Gestión de trámite</span><h2 id="process-dialog-title">{selected.solicitante.nombre}</h2><p>{selected.solicitante.correo}</p></div>
              <button type="button" onClick={closeManager} aria-label="Cerrar gestión"><X aria-hidden="true" /></button>
            </header>
            <form onSubmit={saveProcess}>
              <label>Asesor asignado<select value={draft.asesorId} onChange={(event) => setDraft({ ...draft, asesorId: event.target.value })}><option value="">Sin asignar</option>{advisors.map((advisor) => { const atCapacity = Number(advisor.capacidad) > 0 && Number(advisor.asignados) >= Number(advisor.capacidad); const unavailable = advisor.disponible === false || atCapacity; return <option key={advisor.id} value={advisor.id} disabled={unavailable && Number(draft.asesorId) !== Number(advisor.id)}>{advisor.nombre}{unavailable ? " · no disponible" : ""}</option>; })}</select></label>
              <label>Estado<select value={draft.estado} onChange={(event) => setDraft({ ...draft, estado: event.target.value })}>{STATES.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label>Etapa actual<select value={draft.etapaActual} onChange={(event) => setDraft({ ...draft, etapaActual: event.target.value })}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
              {error && <p className="admin-feedback admin-feedback--error" role="alert">{error}</p>}
              <footer><button type="button" className="admin-process-cancel" onClick={closeManager}>Cancelar</button><button type="submit" className="admin-process-save" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar cambios"}</button></footer>
            </form>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
