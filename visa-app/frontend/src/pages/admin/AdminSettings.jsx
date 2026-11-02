import { Bell, Settings } from "lucide-react";
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
                  <p>El nombre comercial y el sitio web aparecen en el pie de los correos que reciben los usuarios. La razón social y la zona horaria se guardan como referencia y por ahora no cambian nada en la plataforma.</p>
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
            ) : (
              <form className="admin-form" onSubmit={save}>
                <header>
                  <h3>Notificaciones automáticas</h3>
                  <p>Controla los avisos que aparecen dentro de la app. No afecta los correos ni los recordatorios por email.</p>
                </header>
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={form.notificaciones_automaticas !== false}
                    onChange={(event) => setDraft({ ...form, notificaciones_automaticas: event.target.checked })}
                  />
                  <span>
                    <strong>Activar notificaciones automáticas</strong>
                    <span>Crea avisos cuando cambia el estado de un trámite, se revisa un documento o DS-160, se asigna un asesor o hay retroalimentación de entrevista. Si la apagas, no se crea ningún aviso nuevo para clientes, asesores ni administradores.</span>
                  </span>
                </label>
                {notice && <p role="status">{notice}</p>}
                <button className="admin-primary-button" type="submit">Guardar cambios</button>
              </form>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
