import { useEffect, useState } from "react";
import { buildApiUrl } from "../../config/api";
import Sidebar from "../../components/Sidebar";
import useModoSenior from "../../hooks/useModoSenior";
import useRequireAuth from "../../hooks/useRequireAuth";
import useIdioma from "../../hooks/useIdioma";
import { setIdiomaPreferido, translateValue } from "../../i18n/translations";
import "../../styles/perfil.css";

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function getInitials(nombre) {
  if (!nombre) return "?";
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function truncar(texto, max = 18) {
  if (!texto) return "";
  return texto.length > max ? texto.slice(0, max - 1) + "…" : texto;
}

// ---------------------------------------------------------------------
// Iconos (inline SVG, sin dependencias externas)
// ---------------------------------------------------------------------

const Icon = {
  mail: (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  phone: (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
               19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0
               1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0
               0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0
               0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  pin: (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  pencil: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  ),
  camera: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1
               2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  shield: (props) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#dc2649" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  info: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#d97706" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8"  x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  help: (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#dc2649" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9.1 9.1a3 3 0 1 1 4.9 2.3c-.9.5-1.5 1.3-1.5 2.3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

// ---------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------

export default function Perfil() {
  const { isValidating, session } = useRequireAuth();
  const modoSenior = useModoSenior();
  const { idioma, t } = useIdioma();
  const s = getS();

  // Estado del servidor
  const [usuario, setUsuario] = useState(null);
  const [tramite, setTramite] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  // Estado del formulario en modo edición
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    ciudad: "",
    pais: "",
  });

  // -----------------------------------------------------------------
  // Carga inicial desde /usuario-perfil
  // -----------------------------------------------------------------
  useEffect(() => {
    if (isValidating || !session?.correo) return;
    const controller = new AbortController();

    const cargar = async () => {
      try {
        setCargando(true);
        setErrorCarga("");

        const res = await fetch(buildApiUrl("/usuario-perfil"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correo: session.correo }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("profile.loadError");

        const data = await res.json();
        setUsuario(data.usuario);
        setTramite(data.tramite);
        if (data.usuario?.preferencias?.idioma) setIdiomaPreferido(data.usuario.preferencias.idioma);
        setForm({
          nombre:   data.usuario.nombre   || "",
          telefono: data.usuario.telefono || "",
          ciudad:   data.usuario.ciudad   || "",
          pais:     data.usuario.pais     || "",
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setErrorCarga("profile.loadError");
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    };

    cargar();
    return () => controller.abort();
  }, [isValidating, session?.correo]);

  // Auto-dismiss del mensaje de éxito
  useEffect(() => {
    if (!mensajeOk) return;
    const t = setTimeout(() => setMensajeOk(""), 3000);
    return () => clearTimeout(t);
  }, [mensajeOk]);

  // -----------------------------------------------------------------
  // Helpers de actualización
  // -----------------------------------------------------------------
  const actualizarServidor = async (cambios) => {
    if (!session?.correo) return null;

    const res = await fetch(buildApiUrl("/usuario-perfil"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: session.correo, ...cambios }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || t("profile.saveError"));
    }

    const data = await res.json();
    return data.usuario;
  };

  // Guardar cambios del modo edición (nombre, teléfono, ciudad, país)
  const handleGuardarEdicion = async () => {
    try {
      setGuardando(true);
      const actualizado = await actualizarServidor(form);
      if (actualizado) {
        setUsuario(actualizado);
        // También refrescar la sesión local con el nuevo nombre
        const raw = localStorage.getItem("visaguide_session");
        if (raw) {
          try {
            const s = JSON.parse(raw);
            s.nombre = actualizado.nombre;
            localStorage.setItem("visaguide_session", JSON.stringify(s));
          } catch { /* no-op */ }
        }
      }
      setEditando(false);
      setMensajeOk("profile.saved");
    } catch (err) {
      alert(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleCancelarEdicion = () => {
    if (!usuario) return;
    setForm({
      nombre:   usuario.nombre   || "",
      telefono: usuario.telefono || "",
      ciudad:   usuario.ciudad   || "",
      pais:     usuario.pais     || "",
    });
    setEditando(false);
  };

  // Toggle de notificaciones (siempre en vivo, sin modo edición)
  const handleToggleNotificaciones = async () => {
    if (!usuario) return;
    const nuevoValor = !usuario.preferencias.notificacionesEmail;
    // Optimista
    setUsuario({
      ...usuario,
      preferencias: { ...usuario.preferencias, notificacionesEmail: nuevoValor },
    });
    try {
      await actualizarServidor({ notificacionesEmail: nuevoValor });
    } catch (err) {
      // Revertir si falla
      setUsuario((u) => u && ({
        ...u,
        preferencias: { ...u.preferencias, notificacionesEmail: !nuevoValor },
      }));
      alert(err.message);
    }
  };

  // Cambio de idioma (siempre en vivo)
  const handleCambiarIdioma = async (nuevoIdioma) => {
    if (!usuario) return;
    const idiomaAnterior = usuario.preferencias.idioma;
    setUsuario({
      ...usuario,
      preferencias: { ...usuario.preferencias, idioma: nuevoIdioma },
    });
    setIdiomaPreferido(nuevoIdioma);
    try {
      await actualizarServidor({ idioma: nuevoIdioma });
    } catch (err) {
      // Revertir si falla
      setUsuario((u) => u && ({
        ...u,
        preferencias: { ...u.preferencias, idioma: idiomaAnterior },
      }));
      setIdiomaPreferido(idiomaAnterior);
      alert(err.message);
    }
  };

  // -----------------------------------------------------------------
  // Estados de carga
  // -----------------------------------------------------------------
  if (isValidating || cargando) {
    return (
      <div style={s.layout}>
        <Sidebar currentPage="perfil" />
        <main id="main-content" tabIndex="-1" className="vg-authenticated-page" style={s.main}>
          <p style={s.loading}>{t("profile.loading")}</p>
        </main>
      </div>
    );
  }

  if (errorCarga || !usuario) {
    return (
      <div style={s.layout}>
        <Sidebar currentPage="perfil" />
        <main id="main-content" tabIndex="-1" className="vg-authenticated-page" style={s.main}>
          <p style={s.error}>{t("profile.loadError")}</p>
        </main>
      </div>
    );
  }

  // Tamaños condicionales por Modo Senior
  const fz = (base, senior) => (modoSenior ? senior : base);

  return (
    <div style={s.layout}>
      <Sidebar currentPage="perfil" />

      <main id="main-content" tabIndex="-1" className="vg-authenticated-page" style={s.main}>
        {/* ====================== HEADER ====================== */}
        <header style={s.header} className="perfil-header">
          <div>
            <h1 style={{ ...s.title, fontSize: modoSenior ? "44px" : "var(--vg-page-title)" }}>
              {t("profile.title")}
            </h1>
            <p style={{ ...s.subtitle, fontSize: modoSenior ? "19px" : "var(--vg-body-size)" }}>
              {t("profile.subtitle")}
            </p>
          </div>

          {!editando ? (
            <button
              type="button"
              style={s.editBtn}
              onClick={() => setEditando(true)}
            >
              <Icon.pencil />
              <span>{t("profile.edit")}</span>
            </button>
          ) : (
            <div style={s.editActions}>
              <button
                type="button"
                style={s.cancelBtn}
                onClick={handleCancelarEdicion}
                disabled={guardando}
              >
                {t("profile.cancel")}
              </button>
              <button
                type="button"
                style={{
                  ...s.saveBtn,
                  opacity: guardando ? 0.6 : 1,
                  cursor: guardando ? "not-allowed" : "pointer",
                }}
                onClick={handleGuardarEdicion}
                disabled={guardando}
              >
                {guardando ? t("profile.saving") : t("profile.save")}
              </button>
            </div>
          )}
        </header>

        <hr style={s.divider} />

        {mensajeOk && <div style={s.toastOk}>{t(mensajeOk)}</div>}

        {/* ====================== GRID PRINCIPAL ====================== */}
        <section style={s.grid} className="perfil-grid">
          {/* ------------ Columna izquierda: Avatar + Contacto ------------ */}
          <article style={s.userCard}>
            {/* Top navy con avatar */}
            <div style={s.userCardTop}>
              <div style={s.avatarRing}>
                <div style={s.avatarCircle}>
                  <span style={s.avatarInitials}>
                    {getInitials(usuario.nombre)}
                  </span>
                </div>
                <button
                  type="button"
                  style={s.avatarCameraBtn}
                  aria-label={t("profile.changePhoto")}
                  onClick={() =>
                    alert(t("profile.photoSoon"))
                  }
                >
                  <Icon.camera />
                </button>
              </div>
            </div>

            {/* Bottom blanco con info */}
            <div style={s.userCardBody}>
              {editando ? (
                <input
                  type="text"
                  style={s.nameInput}
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                  placeholder={t("profile.namePlaceholder")}
                />
              ) : (
                <h2 style={{ ...s.userName, fontSize: fz("22px", "26px") }}>
                  {usuario.nombre}
                </h2>
              )}

              <p style={{ ...s.userRole, fontSize: fz("14px", "16px") }}>
                {t("profile.role")}
              </p>

              <hr style={s.softDivider} />

              {/* Email — siempre solo-lectura */}
              <div style={s.contactRow}>
                <span style={s.contactIcon}><Icon.mail /></span>
                <span
                  style={{ ...s.contactText, fontSize: fz("14px", "16px") }}
                  title={usuario.correo}
                >
                  {truncar(usuario.correo, 22)}
                </span>
              </div>

              {/* Teléfono */}
              <div style={s.contactRow}>
                <span style={s.contactIcon}><Icon.phone /></span>
                {editando ? (
                  <input
                    type="tel"
                    style={s.contactInput}
                    value={form.telefono}
                    onChange={(e) =>
                      setForm({ ...form, telefono: e.target.value })
                    }
                    placeholder="+57 300 000 0000"
                  />
                ) : (
                  <span style={{ ...s.contactText, fontSize: fz("14px", "16px") }}>
                    {usuario.telefono || (
                      <span style={s.placeholderText}>{t("profile.notRegistered")}</span>
                    )}
                  </span>
                )}
              </div>

              {/* Ciudad / País */}
              <div style={s.contactRow}>
                <span style={s.contactIcon}><Icon.pin /></span>
                {editando ? (
                  <div style={s.locInputs}>
                    <input
                      type="text"
                      style={s.contactInput}
                      value={form.ciudad}
                      onChange={(e) =>
                        setForm({ ...form, ciudad: e.target.value })
                      }
                      placeholder={t("profile.city")}
                    />
                    <input
                      type="text"
                      style={s.contactInput}
                      value={form.pais}
                      onChange={(e) =>
                        setForm({ ...form, pais: e.target.value })
                      }
                      placeholder={t("profile.country")}
                    />
                  </div>
                ) : (
                  <span style={{ ...s.contactText, fontSize: fz("14px", "16px") }}>
                    {[usuario.ciudad, usuario.pais].filter(Boolean).join(", ") || (
                      <span style={s.placeholderText}>{t("profile.notRegistered")}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </article>

          {/* ------------ Columna derecha: Datos del trámite + Preferencias ------------ */}
          <div style={s.rightCol}>
            {/* ----- Datos del trámite ----- */}
            <article style={s.tramiteCard}>
              <header style={s.tramiteHeader}>
                <div style={s.tramiteTitleWrap}>
                  <Icon.shield />
                  <h2 style={{ ...s.tramiteTitle, fontSize: fz("18px", "21px") }}>
                    {t("profile.processTitle")}
                  </h2>
                </div>
                {tramite?.activo && (
                  <span style={s.activoPill}>
                    <span style={s.activoDot} aria-hidden="true" />
                    {t("profile.active")}
                  </span>
                )}
              </header>

              <div style={s.tramiteGrid}>
                <DatoCard
                  label={t("profile.visaType")}
                  valor={usuario.perfil ? translateValue(idioma, "visaType", usuario.perfil) : t("profile.notDefined")}
                  s={s}
                />
                <DatoCard
                  label={t("profile.consulate")}
                  valor={tramite?.consulado === "Sin definir" ? t("profile.notDefined") : tramite?.consulado}
                  s={s}
                />
              </div>

              <div style={s.estadoCard}>
                <div>
                  <div style={s.datoLabel}>{t("profile.currentStatus")}</div>
                  <div style={{ ...s.datoValor, fontSize: fz("16px", "19px") }}>
                    {translateValue(idioma, "serverStage", tramite?.etapaActual)}
                  </div>
                </div>
                <div style={s.etapaText}>
                  {t("profile.stageOf", { etapa: tramite?.etapa, total: tramite?.totalEtapas })}
                </div>
              </div>
            </article>

            {/* ----- Preferencias de cuenta ----- */}
            <article style={s.prefCard}>
              <h2 style={{ ...s.prefTitle, fontSize: fz("18px", "21px") }}>
                {t("profile.preferences")}
              </h2>

              {/* Notificaciones por Email */}
              <div style={s.prefRow}>
                <div style={s.prefText}>
                  <div style={{ ...s.prefRowTitle, fontSize: fz("15px", "17px") }}>
                    {t("profile.emailNotifications")}
                  </div>
                  <div style={{ ...s.prefRowDesc, fontSize: fz("13px", "15px") }}>
                    {t("profile.emailNotificationsDesc")}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={usuario.preferencias.notificacionesEmail}
                  aria-label={t("profile.emailNotifications")}
                  style={{
                    ...s.toggle,
                    backgroundColor: usuario.preferencias.notificacionesEmail
                      ? "var(--vg-success)"
                      : "var(--vg-border-mid)",
                  }}
                  onClick={handleToggleNotificaciones}
                >
                  <span
                    style={{
                      ...s.toggleKnob,
                      transform: usuario.preferencias.notificacionesEmail
                        ? "translateX(20px)"
                        : "translateX(0)",
                    }}
                  />
                </button>
              </div>

              {/* Idioma de la interfaz */}
              <div style={s.prefRow}>
                <div style={s.prefText}>
                  <div style={{ ...s.prefRowTitle, fontSize: fz("15px", "17px") }}>
                    {t("profile.language")}
                  </div>
                  <div style={{ ...s.prefRowDesc, fontSize: fz("13px", "15px") }}>
                    {t("profile.languageDesc")}
                  </div>
                </div>
                <select
                  style={s.select}
                  aria-label={t("profile.language")}
                  value={usuario.preferencias.idioma}
                  onChange={(e) => handleCambiarIdioma(e.target.value)}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </article>

            {/* ----- Aviso amarillo ----- */}
            <div style={s.notice}>
              <span style={s.noticeIcon}><Icon.info /></span>
              <p style={{ ...s.noticeText, fontSize: fz("14px", "16px") }}>
                {t("profile.notice")}
              </p>
            </div>
          </div>
        </section>

        {/* ----- Floating: Ayuda rápida ----- */}
        <button
          type="button"
          style={s.helpFab}
          onClick={() => (window.location.href = "/chat")}
        >
          <Icon.help />
          <span>{t("profile.quickHelp")}</span>
        </button>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------

function DatoCard({ label, valor, s }) {
  return (
    <div style={s.datoCard}>
      <div style={s.datoLabel}>{label}</div>
      <div style={s.datoValor}>{valor || "—"}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Estilos dinámicos con dark mode
// ---------------------------------------------------------------------

function getS() {
  const bg     = "var(--vg-bg)";
  const card   = "var(--vg-card)";
  const border = "var(--vg-border)";
  const text   = "var(--vg-text)";
  const muted  = "var(--vg-text-muted)";
  const subtle = "var(--vg-bg-alt)";

  return {
  layout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: bg,
    fontFamily: "var(--vg-font)",
  },

  main: {
    marginLeft: "var(--vg-sidebar-w)",
    flex: 1,
    padding: "var(--vg-page-pad-top) var(--vg-page-pad-x) var(--vg-page-pad-bottom)",
    color: text,
    position: "relative",
  },

  loading: { color: muted, paddingTop: "40px" },
  error:   { color: "var(--vg-danger-text)", paddingTop: "40px" },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "0",
  },
  title: {
    margin: 0,
    fontWeight: 800,
    color: text,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: muted,
    lineHeight: 1.5,
    maxWidth: "560px",
  },
  editBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: card,
    border: `1px solid ${border}`,
    borderRadius: "10px",
    padding: "10px 18px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
    color: text,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    flexShrink: 0,
  },
  editActions: { display: "flex", gap: "10px", flexShrink: 0 },
  cancelBtn: {
    backgroundColor: card,
    border: `1px solid ${border}`,
    borderRadius: "10px",
    padding: "10px 18px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
    color: muted,
  },
  saveBtn: {
    backgroundColor: "#dc2649",
    border: "1px solid #dc2649",
    borderRadius: "10px",
    padding: "10px 18px",
    fontSize: "14px",
    fontWeight: 600,
    color: "white",
    boxShadow: "0 2px 6px rgba(220,38,73,0.25)",
  },

  divider: {
    border: "none",
    borderTop: `1px solid ${border}`,
    margin: "24px 0 32px",
  },

  toastOk: {
    backgroundColor: "var(--vg-success-bg)",
    color: "var(--vg-success)",
    border: "1px solid var(--vg-border)",
    padding: "10px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "20px",
    display: "inline-block",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: "24px",
    alignItems: "start",
  },

  userCard: {
    backgroundColor: card,
    borderRadius: "18px",
    border: `1px solid ${border}`,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
  },
  userCardTop: {
    backgroundColor: "var(--vg-strong-surface)",
    height: "120px",
    position: "relative",
  },
  avatarRing: {
    position: "absolute",
    bottom: "-50px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "120px",
    height: "120px",
  },
  avatarCircle: {
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    backgroundColor: "var(--vg-border-mid)",
    border: `4px solid ${card}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(15,23,42,0.10)",
  },
  avatarInitials: {
    fontSize: "36px",
    fontWeight: 700,
    color: "var(--vg-text-muted)",
    letterSpacing: "1px",
  },
  avatarCameraBtn: {
    position: "absolute",
    bottom: "4px",
    right: "4px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#dc2649",
    border: `2px solid ${card}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(220,38,73,0.3)",
  },
  userCardBody: { padding: "62px 24px 24px", textAlign: "left" },
  userName: {
    margin: 0,
    fontWeight: 800,
    color: text,
    lineHeight: 1.2,
    textAlign: "center",
    wordBreak: "break-word",
  },
  userRole: { margin: "6px 0 0 0", color: muted, textAlign: "center" },
  nameInput: {
    width: "100%",
    fontSize: "20px",
    fontWeight: 800,
    color: text,
    textAlign: "center",
    border: `1px solid ${border}`,
    borderRadius: "8px",
    padding: "8px 10px",
    outline: "none",
    fontFamily: "inherit",
    background: "var(--vg-input)",
  },
  softDivider: {
    border: "none",
    borderTop: `1px solid ${border}`,
    margin: "20px 0 14px",
  },
  contactRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 0",
    color: text,
  },
  contactIcon: { color: muted, flexShrink: 0, display: "inline-flex", alignItems: "center" },
  contactText: { color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  contactInput: {
    flex: 1,
    minWidth: 0,
    border: `1px solid ${border}`,
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "14px",
    color: text,
    fontFamily: "inherit",
    outline: "none",
    background: "var(--vg-input)",
  },
  locInputs: { display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 },
  placeholderText: { color: "var(--vg-text-muted)", fontStyle: "italic" },

  rightCol: { display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 },

  tramiteCard: {
    backgroundColor: card,
    borderRadius: "18px",
    border: `1px solid ${border}`,
    padding: "24px 26px",
    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
  },
  tramiteHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  tramiteTitleWrap: { display: "flex", alignItems: "center", gap: "10px" },
  tramiteTitle: { margin: 0, fontWeight: 800, color: text },
  activoPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "var(--vg-success-bg)",
    color: "var(--vg-success)",
    padding: "5px 12px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.5px",
  },
  activoDot: { width: "6px", height: "6px", backgroundColor: "var(--vg-success)", borderRadius: "50%" },
  tramiteGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" },
  datoCard: {
    backgroundColor: subtle,
    border: `1px solid ${border}`,
    borderRadius: "12px",
    padding: "14px 16px",
  },
  datoLabel: { fontSize: "11px", fontWeight: 700, color: "var(--vg-text-muted)", letterSpacing: "0.6px", marginBottom: "6px" },
  datoValor: { fontSize: "16px", fontWeight: 700, color: text, lineHeight: 1.3 },
  estadoCard: {
    backgroundColor: subtle,
    border: `1px solid ${border}`,
    borderRadius: "12px",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  etapaText: { color: "var(--vg-red)", fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap" },

  prefCard: {
    backgroundColor: card,
    borderRadius: "18px",
    border: `1px solid ${border}`,
    padding: "24px 26px",
    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
  },
  prefTitle: { margin: "0 0 18px 0", fontWeight: 800, color: text },
  prefRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    padding: "16px 18px",
    backgroundColor: subtle,
    border: `1px solid ${border}`,
    borderRadius: "12px",
    marginBottom: "12px",
  },
  prefText: { flex: 1, minWidth: 0 },
  prefRowTitle: { fontWeight: 700, color: text, marginBottom: "4px" },
  prefRowDesc: { color: muted, lineHeight: 1.4 },

  toggle: {
    width: "46px",
    height: "26px",
    borderRadius: "999px",
    border: "none",
    position: "relative",
    cursor: "pointer",
    transition: "background-color 0.2s",
    flexShrink: 0,
    padding: 0,
    boxSizing: "border-box",
    overflow: "hidden",
  },
  toggleKnob: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    backgroundColor: "var(--vg-card)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 0.2s",
  },

  select: {
    border: `1px solid ${border}`,
    borderRadius: "10px",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: 600,
    color: text,
    backgroundColor: card,
    cursor: "pointer",
    fontFamily: "inherit",
    minWidth: "110px",
  },

  notice: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    backgroundColor: "var(--vg-amber-bg)",
    border: "1px solid var(--vg-amber-border)",
    borderRadius: "12px",
    padding: "14px 18px",
  },
  noticeIcon: { flexShrink: 0, paddingTop: "1px" },
  noticeText: { margin: 0, color: "var(--vg-amber-text)", lineHeight: 1.5 },

  helpFab: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--vg-strong-surface)",
    color: "white",
    border: "none",
    borderRadius: "999px",
    padding: "12px 20px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(15,23,42,0.25)",
    zIndex: 1000,
    fontFamily: "inherit",
  },
  };
}
