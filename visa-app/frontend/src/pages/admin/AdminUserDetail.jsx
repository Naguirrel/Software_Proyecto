import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, ClipboardCheck, ClipboardList, ExternalLink, FileText, Pencil, UserRound, X } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import { AdminPageHeader, AdminResourceState } from "../../components/admin/AdminShared";
import { buildApiUrl } from "../../config/api";
import { adminRequest } from "../../hooks/useAdminResource";
import { getAdminHeaders, getAdminUserId } from "../../utils/adminHeaders";
import { openDocumentPreview } from "../../utils/documentPreview";

const roleLabels = { cliente: "Solicitante", asesor: "Asesor", admin: "Administrador" };
const documentStatusLabels = { approved: "Aprobado", review: "En revision", rejected: "Rechazado", correction: "Correccion", pending: "Pendiente" };

function displayFullName(user) {
  const name = String(user?.nombre || "").trim().replace(/\s+/g, " ");
  const surname = String(user?.apellido || user?.apellidos || "").trim().replace(/\s+/g, " ");
  if (!name) return surname || "Nombre no registrado";
  if (!surname || name.toLocaleLowerCase("es") === surname.toLocaleLowerCase("es") || name.toLocaleLowerCase("es").endsWith(` ${surname.toLocaleLowerCase("es")}`)) return name;
  return `${name} ${surname}`;
}

function getDocumentStatusLabel(status) {
  return documentStatusLabels[status] || status || "Pendiente";
}

function getRecordedCount(session) {
  return (session.responses || []).filter((response) => response.recorded).length;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusClass(status) {
  if (status === "Aprobado" || status === "Completado" || status === "approved" || status === "reviewed") return "approved";
  if (status === "Pendiente" || status === "review" || status === "pending") return "review";
  if (status === "Inactivo" || status === "correction" || status === "rejected") return "correction";
  return "pending";
}

export default function AdminUserDetail() {
  const { id } = useParams();
  const currentUserId = getAdminUserId();
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ nombre: "", correo: "", telefono: "", ciudad: "", pais: "", rol: "cliente" });
  const [notice, setNotice] = useState("");
  const [processState, setProcessState] = useState({ tramiteId: null, data: null, error: "" });

  const loadDetail = useCallback((signal) => {
    return fetch(buildApiUrl(`/admin/users/${id}`), { signal, headers: getAdminHeaders() })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "No fue posible cargar el detalle del usuario.");
        return data;
      })
      .then((data) => setDetail(data))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "No fue posible cargar el detalle del usuario.");
        }
      })
      .finally(() => {
        if (!signal?.aborted) setIsLoading(false);
      });
  }, [id]);

  const retryLoad = () => {
    setDetail(null);
    setIsLoading(true);
    setError("");
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    loadDetail(controller.signal);
    return () => controller.abort();
  }, [loadDetail, revision]);

  const tramiteId = detail?.tramite?.id;

  useEffect(() => {
    if (!tramiteId) return undefined;
    const controller = new AbortController();
    fetch(buildApiUrl(`/admin/processes/${tramiteId}`), { signal: controller.signal, headers: getAdminHeaders() })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "No fue posible cargar el trámite.");
        return data;
      })
      .then((data) => setProcessState({ tramiteId, data, error: "" }))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setProcessState({ tramiteId, data: null, error: requestError.message || "No fue posible cargar el trámite." });
        }
      });
    return () => controller.abort();
  }, [tramiteId, revision]);

  const processLoading = Boolean(tramiteId) && processState.tramiteId !== tramiteId;
  const processError = processState.tramiteId === tramiteId ? processState.error : "";
  const processDetail = processState.tramiteId === tramiteId ? processState.data : null;

  const user = detail?.usuario;
  const fullName = displayFullName(user);

  const openEdit = () => {
    setEditForm({ nombre: user.nombre, correo: user.correo, telefono: user.telefono || "", ciudad: user.ciudad || "", pais: user.pais || "", rol: user.rol });
    setEditModal(true);
  };
  const saveEdit = async (event) => {
    event.preventDefault();
    try {
      await adminRequest(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify(editForm) });
      setEditModal(false);
      setNotice("Usuario actualizado correctamente.");
      retryLoad();
    } catch (error) {
      setNotice(error.message);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Detalle de Usuario"
        description="Perfil completo y actividad asociada al usuario."
        action={<div className="admin-user-detail-actions"><Link className="admin-secondary-button" to="/admin/users"><ArrowLeft aria-hidden="true" size={18} />Volver a usuarios</Link>{user && <button className="admin-primary-button" type="button" onClick={openEdit}><Pencil aria-hidden="true" size={18} />Editar usuario</button>}</div>}
      />
      {notice && <p className="admin-feedback" role="status">{notice}</p>}

      <AdminResourceState
        isLoading={isLoading}
        error={error}
        retry={retryLoad}
        isEmpty={!isLoading && !error && !user}
        empty="No se encontró el usuario."
      />

      {!isLoading && !error && user && (
        <>
          <section className="admin-request-hero">
            <div className="admin-request-identity">
              <span className="admin-section-kicker">Usuario #{user.id}</span>
              <h2>{fullName}</h2>
              <p>{user.correo}</p>
              <div>
                <span className={`admin-status admin-status--${user.activo ? "approved" : "correction"}`}>{user.activo ? "Activo" : "Inactivo"}</span>
                <span>{roleLabels[user.rol] || user.rol}</span>
              </div>
            </div>
          </section>

          <section className="admin-panel-card">
            <div className="admin-panel-card__header">
              <div>
                <h2><UserRound aria-hidden="true" size={22} /> Datos personales</h2>
                <p>Información de contacto y cuenta.</p>
              </div>
            </div>
            <dl className="admin-request-details">
              <div><dt>Nombre completo</dt><dd>{fullName}</dd></div>
              <div><dt>Correo</dt><dd>{user.correo}</dd></div>
              <div><dt>Rol</dt><dd>{roleLabels[user.rol] || user.rol}</dd></div>
              <div><dt>Teléfono</dt><dd>{user.telefono || "Sin registrar"}</dd></div>
              <div><dt>Ciudad</dt><dd>{user.ciudad || "Sin registrar"}</dd></div>
              <div><dt>País</dt><dd>{user.pais || "Sin registrar"}</dd></div>
              <div><dt>Fecha de creación</dt><dd>{formatDate(user.createdAt)}</dd></div>
              <div><dt>Última actividad</dt><dd>{formatDate(user.actividad)}</dd></div>
            </dl>
          </section>

          {user.rol === "cliente" && (
            <section className="admin-panel-card">
              <div className="admin-panel-card__header">
                <div>
                  <h2><ClipboardList aria-hidden="true" size={22} /> Trámite</h2>
                  <p>Estado del proceso de visa de este solicitante.</p>
                </div>
                {detail.tramite && <Link className="admin-secondary-button" to={`/admin/processes/${detail.tramite.id}`}>Ver solicitud</Link>}
              </div>
              {detail.tramite ? (
                <dl className="admin-request-details">
                  <div><dt>Estado</dt><dd><span className={`admin-status admin-status--${statusClass(detail.tramite.estado)}`}>{detail.tramite.estado}</span></dd></div>
                  <div><dt>Etapa actual</dt><dd>{detail.tramite.etapaActual}</dd></div>
                  <div><dt>Progreso</dt><dd>{detail.tramite.progreso}%</dd></div>
                  <div><dt>Asesor asignado</dt><dd>{detail.tramite.asesor?.nombre || "Sin asignar"}</dd></div>
                </dl>
              ) : (
                <div className="admin-empty-state admin-empty-state--compact"><strong>Sin trámite iniciado</strong></div>
              )}
            </section>
          )}

          {user.rol === "cliente" && detail.tramite && (
            <>
              <AdminResourceState isLoading={processLoading} error={processError} retry={retryLoad} isEmpty={false} />
              {!processLoading && !processError && processDetail && (
                <>
                  <section className="admin-panel-card">
                    <div className="admin-panel-card__header">
                      <div>
                        <h2><ClipboardCheck aria-hidden="true" size={22} /> DS-160</h2>
                        <p>Resumen del formulario guardado.</p>
                      </div>
                      <Link className="admin-secondary-button" to="/admin/ds160">Abrir módulo</Link>
                    </div>
                    {processDetail.ds160 ? (
                      <>
                        <div className="admin-request-progress admin-request-progress--compact">
                          <strong>{processDetail.ds160.progreso}%</strong>
                          <span><i style={{ width: `${processDetail.ds160.progreso}%` }} /></span>
                          <p>{processDetail.ds160.completado ? "Formulario completado" : `Sección ${processDetail.ds160.seccionActual} en progreso`}</p>
                        </div>
                        <dl className="admin-request-mini-list">
                          {processDetail.ds160.resumen.length ? processDetail.ds160.resumen.map((item) => (
                            <div key={item.key}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                          )) : <div><dt>Resumen</dt><dd>Sin campos relevantes capturados todavía.</dd></div>}
                        </dl>
                      </>
                    ) : (
                      <div className="admin-empty-state admin-empty-state--compact"><strong>Sin formulario DS-160</strong></div>
                    )}
                  </section>

                  <section className="admin-panel-card">
                    <div className="admin-panel-card__header">
                      <div>
                        <h2><FileText aria-hidden="true" size={22} /> Documentos</h2>
                        <p>Documentos asociados a esta solicitud.</p>
                      </div>
                      <Link className="admin-secondary-button" to="/admin/documents">Ver documentos</Link>
                    </div>
                    {processDetail.documentos.length ? (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead><tr><th>Nombre</th><th>Estado</th><th>Observaciones</th><th>Archivo</th></tr></thead>
                          <tbody>
                            {processDetail.documentos.map((document) => (
                              <tr key={document.id}>
                                <td><strong>{document.nombre}</strong><small>{document.documento_key || document.tipo || "Documento"}</small></td>
                                <td><span className={`admin-status admin-status--${statusClass(document.estado)}`}>{getDocumentStatusLabel(document.estado)}</span></td>
                                <td>{document.feedback || "Sin observaciones"}</td>
                                <td><button className="admin-action-button" type="button" disabled={!document.archivo_url} onClick={() => openDocumentPreview(document)}><ExternalLink aria-hidden="true" size={15} />Ver documento</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="admin-empty-state admin-empty-state--compact"><strong>Sin documentos registrados</strong></div>
                    )}
                  </section>

                  <section className="admin-panel-card">
                    <div className="admin-panel-card__header">
                      <div>
                        <h2><BriefcaseBusiness aria-hidden="true" size={22} /> Entrevistas</h2>
                        <p>Sesiones realizadas desde el simulador.</p>
                      </div>
                      <Link className="admin-secondary-button" to="/admin/interviews">Revisar entrevistas</Link>
                    </div>
                    {processDetail.entrevistas.length ? (
                      <div className="admin-request-interviews">
                        {processDetail.entrevistas.map((session) => (
                          <article key={session.id}>
                            <header>
                              <div>
                                <strong>{formatDate(session.created_at)}</strong>
                                <span>{getRecordedCount(session)} de {(session.responses || []).length} respuestas grabadas</span>
                              </div>
                              <span className={`admin-status admin-status--${statusClass(session.status)}`}>{session.status === "reviewed" ? "Retroalimentada" : "Pendiente"}</span>
                            </header>
                            <dl>
                              <div><dt>Calificación</dt><dd>{session.rating || "Sin calificación"}</dd></div>
                              <div><dt>Feedback</dt><dd>{session.feedback || "Sin feedback"}</dd></div>
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-empty-state admin-empty-state--compact"><strong>Sin entrevistas registradas</strong></div>
                    )}
                  </section>
                </>
              )}
            </>
          )}

          {user.rol === "asesor" && (
            <section className="admin-panel-card">
              <div className="admin-panel-card__header">
                <div>
                  <h2><BriefcaseBusiness aria-hidden="true" size={22} /> Casos asignados</h2>
                  <p>Solicitudes que este asesor tiene a su cargo.</p>
                </div>
              </div>
              {detail.casos?.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Solicitante</th><th>Estado</th><th>Etapa</th></tr></thead>
                    <tbody>
                      {detail.casos.map((caso) => (
                        <tr key={caso.id}>
                          <td><strong>{caso.nombre}</strong><small>{caso.correo}</small></td>
                          <td><span className={`admin-status admin-status--${statusClass(caso.estado)}`}>{caso.estado}</span></td>
                          <td>{caso.etapa_actual}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty-state admin-empty-state--compact"><strong>Sin casos asignados</strong></div>
              )}
            </section>
          )}

          {user.rol === "admin" && (
            <section className="admin-panel-card">
              <div className="admin-panel-card__header">
                <div>
                  <h2><ClipboardList aria-hidden="true" size={22} /> Actividad reciente</h2>
                  <p>Últimas acciones realizadas por este administrador.</p>
                </div>
              </div>
              {detail.actividad?.length ? (
                <ol className="admin-activity-list">
                  {detail.actividad.map((item) => (
                    <li key={item.id}>
                      <strong>{item.accion}</strong>
                      <span>{item.detalle}</span>
                      <small>{formatDate(item.created_at)}</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="admin-empty-state admin-empty-state--compact"><strong>Sin actividad registrada</strong></div>
              )}
            </section>
          )}
        </>
      )}

      {editModal && user && (
        <div className="admin-modal-backdrop">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-detail-title">
            <header className="admin-modal__header">
              <h2 id="edit-user-detail-title">Editar usuario</h2>
              <button className="admin-modal__close" type="button" onClick={() => setEditModal(false)} aria-label="Cerrar"><X aria-hidden="true" /></button>
            </header>
            <form className="admin-form" onSubmit={saveEdit}>
              <label>Nombre<input required value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} /></label>
              <label>Correo<input required type="email" value={editForm.correo} onChange={(e) => setEditForm({ ...editForm, correo: e.target.value })} /></label>
              <label>Teléfono<input value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} /></label>
              <label>Ciudad<input value={editForm.ciudad} onChange={(e) => setEditForm({ ...editForm, ciudad: e.target.value })} /></label>
              <label>País<input value={editForm.pais} onChange={(e) => setEditForm({ ...editForm, pais: e.target.value })} /></label>
              <label>Rol
                <select disabled={user.id === currentUserId} value={editForm.rol} onChange={(e) => setEditForm({ ...editForm, rol: e.target.value })}>
                  <option value="cliente">Solicitante</option>
                  <option value="asesor">Asesor</option>
                  <option value="admin">Administrador</option>
                </select>
                {user.id === currentUserId && <small>No puedes cambiar tu propio rol.</small>}
              </label>
              <footer><button className="admin-primary-button" type="submit">Guardar cambios</button></footer>
            </form>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
