import { Bell, FileText, LockKeyhole, Settings, ShieldCheck } from "lucide-react";
import { useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { AdminPageHeader, AdminResourceState } from "../../components/admin/AdminShared";
import useAdminResource, { adminRequest } from "../../hooks/useAdminResource";

const empty = {
  nombre_comercial: "",
  razon_social: "",
  sitio_web: "",
  idioma: "es",
  zona_horaria: "America/Guatemala",
  notificaciones_automaticas: true,
};

const sections = [
  ["general", <Settings aria-hidden="true" />, "General"],
  ["notifications", <Bell aria-hidden="true" />, "Notificaciones automáticas"],
  ["documents", <FileText aria-hidden="true" />, "Requisitos documentales"],
  ["roles", <ShieldCheck aria-hidden="true" />, "Roles y permisos"],
  ["security", <LockKeyhole aria-hidden="true" />, "Seguridad"],
];

export default function AdminSettingsPage() {
  const resource = useAdminResource("/admin/settings");
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState("general");
  const form = { ...(draft || resource.data?.configuracion || empty), idioma: "es" };

  const save = async (event) => {
    event.preventDefault();
    try {
      const data = await adminRequest("/admin/settings", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setDraft(data.configuracion);
      setNotice("Configuración guardada.");
    } catch (error) {
      setNotice(error.message);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader title="Configuración" description="Ajustes globales de la plataforma VisaGuide." />
      <AdminResourceState isLoading={resource.isLoading} error={resource.error} retry={resource.retry} />
      {!resource.isLoading && !resource.error && (
        <div className="admin-settings-layout">
          <nav aria-label="Secciones de configuración">
            {sections.map(([value, icon, label]) => (
              <button type="button" key={value} className={section === value ? "is-active" : ""} onClick={() => setSection(value)}>
                {icon}{label}
              </button>
            ))}
          </nav>
          <section className="admin-settings-card">
            {section === "general" ? (
              <form className="admin-form" onSubmit={save}>
                <header>
                  <h3>Información de la Agencia</h3>
                  <p>Los datos que verán los solicitantes en sus correos y perfiles.</p>
                </header>
                <div className="admin-form-grid">
                  <label>Nombre comercial<input value={form.nombre_comercial || ""} onChange={(event) => setDraft({ ...form, nombre_comercial: event.target.value })} /></label>
                  <label>Razón social<input value={form.razon_social || ""} onChange={(event) => setDraft({ ...form, razon_social: event.target.value })} /></label>
                  <label className="wide">Sitio web<input type="url" value={form.sitio_web || ""} onChange={(event) => setDraft({ ...form, sitio_web: event.target.value })} /></label>
                  <label>Zona horaria<input value={form.zona_horaria || ""} onChange={(event) => setDraft({ ...form, zona_horaria: event.target.value })} /></label>
                </div>
                {notice && <p role="status">{notice}</p>}
                <button className="admin-primary-button" type="submit">Guardar cambios</button>
              </form>
            ) : section === "notifications" ? (
              <form className="admin-form" onSubmit={save}>
                <header>
                  <h3>Notificaciones automáticas</h3>
                  <p>Controla si la plataforma avisa a los usuarios cuando ocurren cambios en su proceso.</p>
                </header>
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={form.notificaciones_automaticas !== false}
                    onChange={(event) => setDraft({ ...form, notificaciones_automaticas: event.target.checked })}
                  />
                  <span>
                    <strong>Activar notificaciones automáticas</strong>
                    <span>Envía avisos a los usuarios cuando cambia el estado de su trámite, se revisa su DS-160, se les asigna un asesor, o reciben retroalimentación de entrevista.</span>
                  </span>
                </label>
                {notice && <p role="status">{notice}</p>}
                <button className="admin-primary-button" type="submit">Guardar cambios</button>
              </form>
            ) : (
              <div className="admin-resource-state">
                <strong>Configuración aún no disponible</strong>
                <span>Esta sección requiere reglas de negocio adicionales antes de habilitar cambios seguros.</span>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
