import { useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { AdminPageHeader, AdminResourceState } from "../../components/admin/AdminShared";
import useAdminResource, { adminRequest } from "../../hooks/useAdminResource";

const editableFields = ["nombre", "telefono", "ciudad", "pais"];
const roleLabels = { admin: "Administrador", asesor: "Asesor", cliente: "Solicitante" };

export default function AdminProfile() {
  const resource = useAdminResource("/admin/profile");
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const saved = resource.data?.usuario;
  const form = draft || saved;
  const isDirty = Boolean(saved && draft && editableFields.some((field) => String(draft[field] || "") !== String(saved[field] || "")));

  const updateField = (field, value) => {
    setDraft((current) => ({ ...(current || saved), [field]: value }));
    setNotice(null);
  };

  const save = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(editableFields.map((field) => [field, String(form[field] || "").trim()]));
    if (!payload.nombre) {
      setNotice({ tone: "error", text: "El nombre es obligatorio." });
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await adminRequest("/admin/profile", { method: "PUT", body: JSON.stringify(payload) });
      resource.setData({ usuario: data.usuario });
      setDraft(null);
      setNotice({ tone: "success", text: "Perfil actualizado correctamente." });
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader title="Mi Perfil" description="Consulta los datos de tu cuenta y actualiza tu información de contacto." />
      <AdminResourceState {...resource} isEmpty={!saved && !resource.isLoading && !resource.error} empty="No se encontró el perfil administrativo." />
      {!resource.isLoading && !resource.error && form && (
        <section className="admin-profile-card">
          <header className="admin-profile-identity">
            <b aria-hidden="true">{String(form.nombre || "A").trim().slice(0, 2).toUpperCase()}</b>
            <div><span className="admin-section-kicker">CUENTA ADMINISTRATIVA</span><h2>{form.nombre || "Nombre pendiente"}</h2><p>{form.correo}</p></div>
          </header>
          <div className="admin-profile-content">
            <section className="admin-profile-readonly" aria-labelledby="profile-account-title">
              <h3 id="profile-account-title">Datos de la cuenta</h3>
              <p>Estos datos son de solo lectura en esta vista.</p>
              <dl>
                <div><dt>Correo electrónico</dt><dd>{form.correo || "Sin registrar"}</dd></div>
                <div><dt>Rol</dt><dd>{roleLabels[form.rol] || form.rol || "Sin registrar"}</dd></div>
              </dl>
            </section>
            <form className="admin-form admin-profile-form" onSubmit={save} noValidate aria-labelledby="profile-edit-title">
              <div className="admin-profile-form__heading"><h3 id="profile-edit-title">Información editable</h3><p>Actualiza los datos que aparecen en tu perfil.</p></div>
              <div className="admin-profile-fields">
                <label>Nombre<input autoComplete="name" value={form.nombre || ""} onChange={(event) => updateField("nombre", event.target.value)} aria-invalid={notice?.tone === "error" && !String(form.nombre || "").trim()} /></label>
                <label>Teléfono<input autoComplete="tel" type="tel" value={form.telefono || ""} onChange={(event) => updateField("telefono", event.target.value)} /></label>
                <label>Ciudad<input autoComplete="address-level2" value={form.ciudad || ""} onChange={(event) => updateField("ciudad", event.target.value)} /></label>
                <label>País<input autoComplete="country-name" value={form.pais || ""} onChange={(event) => updateField("pais", event.target.value)} /></label>
              </div>
              {notice && <p className={`admin-feedback admin-feedback--${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
              <footer><button className="admin-primary-button" type="submit" disabled={isSaving || !isDirty}>{isSaving ? "Guardando…" : "Guardar cambios"}</button></footer>
            </form>
          </div>
        </section>
      )}
    </AdminLayout>
  );
}
