import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminAdvancedFilters from "../../components/admin/AdminAdvancedFilters";
import { EMPTY_ADMIN_FILTERS, advisorOptions, matchesAdminFilters } from "../../utils/adminFilters";
import { AdminPageHeader, AdminPagination, AdminResourceState, AdminSearch, AdminTabs } from "../../components/admin/AdminShared";
import useAdminResource, { adminRequest } from "../../hooks/useAdminResource";
import { getAdminUserId } from "../../utils/adminHeaders";

const PAGE_SIZE = 8;
const tabs = [{ value: "todos", label: "Todos" }, { value: "cliente", label: "Solicitante" }, { value: "asesor", label: "Asesor" }, { value: "admin", label: "Administrador" }];

export default function AdminUsers() {
  const resource = useAdminResource("/admin/users");
  const currentUserId = getAdminUserId();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_ADMIN_FILTERS);
  const [status, setStatus] = useState("all");
  const [tab, setTab] = useState("todos");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: "", correo: "", contrasena: "", rol: "cliente" });
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", correo: "", telefono: "", ciudad: "", pais: "", rol: "cliente" });
  const [notice, setNotice] = useState("");
  const users = useMemo(() => resource.data?.usuarios || [], [resource.data]);
  const advisors = useMemo(() => advisorOptions(users.map((user) => ({ id: user.asesorId, nombre: user.asesor }))), [users]);
  const filtered = useMemo(() => users.filter((user) => (tab === "todos" || user.rol === tab)
    && (!filters.advisor || user.rol === "cliente")
    && (status === "all" || (status === "active" ? user.activo : !user.activo))
    && matchesAdminFilters(filters, user.createdAt, user.asesorId)
    && `${user.nombre} ${user.correo}`.toLowerCase().includes(query.toLowerCase())), [query, tab, users, status, filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const createUser = async (event) => {
    event.preventDefault();
    try {
      await adminRequest("/admin/users", { method: "POST", body: JSON.stringify(form) });
      setModal(false); setForm({ nombre: "", correo: "", contrasena: "", rol: "cliente" }); setNotice("Usuario creado correctamente."); resource.retry();
    } catch (error) { setNotice(error.message); }
  };
  const toggleUser = async (user) => {
    setNotice("");
    try {
      await adminRequest(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ activo: !user.activo }) });
      setNotice("Estado del usuario actualizado.");
      resource.retry();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const unlockUser = async (user) => {
    setNotice("");
    try {
      await adminRequest(`/admin/users/${user.id}/unlock`, { method: "POST" });
      setNotice(`Cuenta de ${user.nombre} desbloqueada.`);
      resource.retry();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const openEdit = (user) => { setEditUser(user); setEditForm({ nombre: user.nombre, correo: user.correo, telefono: user.telefono || "", ciudad: user.ciudad || "", pais: user.pais || "", rol: user.rol }); };
  const saveEdit = async (event) => {
    event.preventDefault();
    try {
      await adminRequest(`/admin/users/${editUser.id}`, { method: "PATCH", body: JSON.stringify(editForm) });
      setEditUser(null); setNotice("Usuario actualizado correctamente."); resource.retry();
    } catch (error) { setNotice(error.message); }
  };

  return <AdminLayout>
    <AdminPageHeader title="Usuarios" description="Gestión global de solicitantes, asesores y administradores." action={<button className="admin-primary-button" type="button" onClick={() => setModal(true)}><Plus aria-hidden="true" />Crear usuario</button>} />
    {notice && <p className="admin-feedback" role="status">{notice}</p>}
    <AdminTabs value={tab} onChange={(value) => { setTab(value); setPage(1); }} items={tabs} label="Filtrar usuarios por rol" />
    <section className="admin-list-card">
      <AdminAdvancedFilters value={filters} onChange={(value) => { setFilters(value); setPage(1); }} advisors={advisors}
        status={status} statuses={[{ value: "all", label: "Todos" }, { value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }]}
        onStatusChange={(value) => { setStatus(value); setPage(1); }}
        onReset={() => { setFilters(EMPTY_ADMIN_FILTERS); setStatus("all"); setTab("todos"); setQuery(""); setPage(1); }} />
      <p>El filtro de asesor se aplica a los solicitantes y su trámite; administradores y asesores no tienen un asesor asignado.</p>
      <div className="admin-list-toolbar"><AdminSearch value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Buscar por nombre o correo..." /></div>
      <AdminResourceState {...resource} isEmpty={!users.length} empty="No hay usuarios registrados." />
      {!resource.isLoading && !resource.error && users.length > 0 && <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Usuario</th><th>Rol / tipo</th><th>Estado</th><th>Actividad / asesor</th><th>Acción</th></tr></thead><tbody>{visible.length ? visible.map((user) => <tr key={user.id}><td><span className="admin-user-cell"><b>{user.nombre.slice(0,2).toUpperCase()}</b><span><strong>{user.nombre}</strong><small>{user.correo}</small></span></span></td><td><strong>{user.rol === "cliente" ? "Solicitante" : user.rol === "asesor" ? "Asesor" : "Administrador"}</strong><small>{user.perfil || "N/A"}</small></td><td><span className={`admin-status admin-status--${user.activo ? "approved" : "correction"}`}>{user.activo ? "Activo" : "Inactivo"}</span>{user.bloqueado && <span className="admin-status admin-status--correction" title={`Bloqueada hasta ${new Date(user.bloqueadoHasta).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })} por intentos fallidos`}>Bloqueado</span>}</td><td><small>{user.rol === "asesor" ? `${user.asignados} casos asignados` : user.actividad ? new Date(user.actividad).toLocaleDateString("es-GT") : "Sin actividad"}</small>{user.rol === "cliente" && <strong>{user.asesor || "Sin asignar"}</strong>}</td><td><Link className="admin-secondary-button" to={`/admin/users/${user.id}`}>Ver detalle</Link><button className="admin-secondary-button" type="button" onClick={() => openEdit(user)}>Editar</button><button className="admin-secondary-button" type="button" disabled={user.id === currentUserId && user.activo} title={user.id === currentUserId && user.activo ? "No puedes desactivar tu propia cuenta" : undefined} onClick={() => toggleUser(user)}>{user.activo ? "Desactivar" : "Activar"}</button>{user.bloqueado && <button className="admin-secondary-button" type="button" onClick={() => unlockUser(user)}>Desbloquear</button>}</td></tr>) : <tr><td colSpan="5" className="admin-table-state">No hay usuarios que coincidan con los filtros.</td></tr>}</tbody></table></div><AdminPagination page={currentPage} pages={pages} onChange={setPage} total={filtered.length} visible={visible.length} /></>}
    </section>
    {modal && <div className="admin-modal-backdrop"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="new-user-title"><header className="admin-modal__header"><h2 id="new-user-title">Crear usuario</h2><button className="admin-modal__close" type="button" onClick={() => setModal(false)} aria-label="Cerrar"><X aria-hidden="true" /></button></header><form className="admin-form" onSubmit={createUser}><label>Nombre<input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label><label>Correo<input required type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} /></label><label>Contraseña<input required type="password" autoComplete="new-password" value={form.contrasena} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} /></label><label>Rol<select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}><option value="cliente">Solicitante</option><option value="asesor">Asesor</option><option value="admin">Administrador</option></select></label><footer><button className="admin-primary-button" type="submit">Crear usuario</button></footer></form></section></div>}
    {editUser && <div className="admin-modal-backdrop"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title"><header className="admin-modal__header"><h2 id="edit-user-title">Editar usuario</h2><button className="admin-modal__close" type="button" onClick={() => setEditUser(null)} aria-label="Cerrar"><X aria-hidden="true" /></button></header><form className="admin-form" onSubmit={saveEdit}><label>Nombre<input required value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} /></label><label>Correo<input required type="email" value={editForm.correo} onChange={(e) => setEditForm({ ...editForm, correo: e.target.value })} /></label><label>Teléfono<input value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} /></label><label>Ciudad<input value={editForm.ciudad} onChange={(e) => setEditForm({ ...editForm, ciudad: e.target.value })} /></label><label>País<input value={editForm.pais} onChange={(e) => setEditForm({ ...editForm, pais: e.target.value })} /></label><label>Rol<select disabled={editUser?.id === currentUserId} value={editForm.rol} onChange={(e) => setEditForm({ ...editForm, rol: e.target.value })}><option value="cliente">Solicitante</option><option value="asesor">Asesor</option><option value="admin">Administrador</option></select>{editUser?.id === currentUserId && <small>No puedes cambiar tu propio rol.</small>}</label><footer><button className="admin-primary-button" type="submit">Guardar cambios</button></footer></form></section></div>}
  </AdminLayout>;
}
