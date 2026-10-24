import { RefreshCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { AdminPageHeader, AdminResourceState } from "../../components/admin/AdminShared";
import { buildApiUrl } from "../../config/api";

function getToken() {
  return JSON.parse(localStorage.getItem("visaguide_session") || "null")?.token || "";
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function actorLabel(log) {
  if (log.adminId) return `Admin #${log.adminId}`;
  if (log.userId) return `Usuario #${log.userId}`;
  return "Sistema";
}

function hasDetails(log) {
  return Boolean(
    log.ipAddress ||
    log.userAgent ||
    (log.metadata && Object.keys(log.metadata).length > 0)
  );
}

function formatMetadata(metadata) {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  return JSON.stringify(metadata, null, 2);
}

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 });
  const [filters, setFilters] = useState({ action: "", userId: "", role: "" });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [filterError, setFilterError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const reload = () => {
    setIsLoading(true);
    setError("");
    setRevision((value) => value + 1);
  };

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(pagination.limit));
    params.set("page", String(pagination.page));
    if (filters.action.trim()) params.set("action", filters.action.trim());
    if (filters.userId.trim()) params.set("userId", filters.userId.trim());
    if (filters.role) params.set("role", filters.role);
    return params.toString();
  }, [filters, pagination.limit, pagination.page]);

  useEffect(() => {
    const controller = new AbortController();
    const token = getToken();

    fetch(buildApiUrl(`/admin/activity-logs?${query}`), {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "No fue posible cargar los logs de actividad.");
        return data;
      })
      .then((data) => {
        setLogs(data.logs || []);
        setPagination((current) => ({
          ...current,
          pages: data.pages || 1,
          total: data.total || 0,
        }));
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "No fue posible cargar los logs de actividad.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [query, revision]);

  const applyFilters = (event) => {
    event.preventDefault();
    const userId = draftFilters.userId.trim();
    if (userId && !/^[1-9]\d*$/.test(userId)) {
      setFilterError("Ingresa un ID de usuario válido.");
      return;
    }
    setFilterError("");
    const next = { action: draftFilters.action.trim(), userId, role: draftFilters.role };
    if (Object.keys(next).every((key) => next[key] === filters[key]) && pagination.page === 1) {
      reload();
      return;
    }
    setIsLoading(true);
    setError("");
    setFilters(next);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const clearFilters = () => {
    const empty = { action: "", userId: "", role: "" };
    setDraftFilters(empty);
    setFilters(empty);
    setFilterError("");
    if (Object.keys(empty).every((key) => empty[key] === filters[key]) && pagination.page === 1) return;
    setError("");
    setIsLoading(true);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const activeFilters = [filters.action && `Acción: ${filters.action}`, filters.userId && `Usuario #${filters.userId}`, filters.role && `Rol: ${filters.role}`].filter(Boolean);
  const filtersChanged = Object.keys(filters).some((key) => filters[key] !== draftFilters[key].trim());

  const changePage = (page) => {
    setIsLoading(true);
    setError("");
    setPagination((current) => ({ ...current, page }));
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Logs de Actividad"
        description="Registro administrativo de acciones importantes realizadas en la plataforma."
        action={(
          <button className="admin-secondary-button" type="button" onClick={reload}>
            <RefreshCcw aria-hidden="true" size={18} />
            Actualizar
          </button>
        )}
      />

      <section className="admin-panel-card admin-activity-filters">
        <form className="admin-report-actions" onSubmit={applyFilters}>
          <label>
            <span>Acción</span>
            <span className="admin-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={draftFilters.action}
                onChange={(event) => setDraftFilters((current) => ({ ...current, action: event.target.value }))}
                placeholder="Buscar acción"
              />
            </span>
          </label>
          <label>
            <span>Usuario</span>
            <input
              type="text"
              inputMode="numeric"
              value={draftFilters.userId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, userId: event.target.value }))}
              placeholder="ID"
            />
          </label>
          <label>
            <span>Rol</span>
            <select value={draftFilters.role} onChange={(event) => setDraftFilters((current) => ({ ...current, role: event.target.value }))}>
              <option value="">Todos</option>
              <option value="cliente">Cliente</option>
              <option value="asesor">Asesor</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <div className="admin-activity-filters__buttons"><button className="admin-primary-button" type="submit">Aplicar filtros</button><button className="admin-secondary-button" type="button" onClick={clearFilters} disabled={!activeFilters.length && !filtersChanged}>Limpiar</button></div>
        </form>
        {filterError && <p className="admin-activity-filters__error" role="alert">{filterError}</p>}
        <p className="admin-activity-filters__summary" role="status">{activeFilters.length ? `Filtros aplicados: ${activeFilters.join(" · ")}.` : "Sin filtros aplicados."}{filtersChanged ? " Hay cambios sin aplicar." : ""}</p>
      </section>

      <AdminResourceState
        isLoading={isLoading}
        error={error}
        retry={reload}
        isEmpty={!isLoading && !error && logs.length === 0}
        empty={activeFilters.length ? "No hay logs de actividad para los filtros seleccionados." : "Todavía no hay logs de actividad."}
      />

      {!isLoading && !error && logs.length > 0 && (
        <section className="admin-panel-card admin-activity-results">
          <div className="admin-panel-card__header">
            <div>
              <h2>Actividad registrada</h2>
              <p>{pagination.total} eventos encontrados.</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Actor</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Descripción</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>
                      <strong>{actorLabel(log)}</strong>
                      <small>{log.userEmail || "Sin correo"}</small>
                    </td>
                    <td><span className="admin-status admin-status--review">{log.action}</span></td>
                    <td>
                      <strong>{log.entityType || "N/A"}</strong>
                      <small>{log.entityId || "Sin ID"}</small>
                    </td>
                    <td>{log.description || "Sin descripción"}</td>
                    <td>
                      {hasDetails(log) ? (
                        <details className="admin-log-details">
                          <summary>Ver detalles</summary>
                          <dl>
                            {log.ipAddress && (
                              <div>
                                <dt>IP</dt>
                                <dd>{log.ipAddress}</dd>
                              </div>
                            )}
                            {log.userAgent && (
                              <div>
                                <dt>User agent</dt>
                                <dd>{log.userAgent}</dd>
                              </div>
                            )}
                          </dl>
                          {formatMetadata(log.metadata) && <pre>{formatMetadata(log.metadata)}</pre>}
                        </details>
                      ) : (
                        "Sin detalles"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="admin-pagination">
            <span>Página {pagination.page} de {pagination.pages}</span>
            <div>
              <button type="button" disabled={pagination.page <= 1} onClick={() => changePage(pagination.page - 1)}>Anterior</button>
              <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => changePage(pagination.page + 1)}>Siguiente</button>
            </div>
          </footer>
        </section>
      )}
    </AdminLayout>
  );
}
