import Sidebar from "../components/Sidebar";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import useDS160Form from "../hooks/useDS160Form";
import { secciones } from "../data/ds160Sections";
import DS160Field from "../components/ds160/DS160Field";
import { SaveIcon, DownloadIcon, CheckCircleIcon, InfoCircleIcon } from "../components/ds160/DS160Icons";
import "../styles/ds160.css";

function getSt() {
  const bg = "var(--vg-bg)";
  const card = "var(--vg-card)";
  const border = "var(--vg-border)";
  const text = "var(--vg-text)";
  const muted = "var(--vg-text-muted)";

  return {
    layout: { display: "flex", minHeight: "100vh" },

    page: {
      marginLeft: "var(--vg-sidebar-w)",
      flex: 1,
      minHeight: "100vh",
      background: bg,
      padding: "var(--vg-page-pad-top) var(--vg-page-pad-x) var(--vg-page-pad-bottom)",
      fontFamily: "var(--vg-font)",
      boxSizing: "border-box",
    },

    headerCard: {
      background: card,
      borderRadius: "14px",
      padding: "20px 26px 16px",
      boxShadow: "var(--vg-shadow-sm)",
      marginBottom: "20px",
      border: `1px solid ${border}`,
    },

    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: "14px",
    },

    headerActions: {
      display: "flex",
      gap: "10px",
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },

    titulo: { margin: 0, fontWeight: 700, color: text, letterSpacing: "-0.3px" },
    subtitulo: { margin: "3px 0 0 0", color: muted },

    guardarBtn: {
      display: "flex",
      alignItems: "center",
      gap: "7px",
      background: card,
      border: `1px solid ${border}`,
      borderRadius: "10px",
      padding: "9px 16px",
      fontSize: "13px",
      fontWeight: 500,
      color: muted,
      cursor: "pointer",
      boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
      fontFamily: "var(--vg-font)",
      flexShrink: 0,
    },

    barTrack: { width: "100%", height: "5px", background: border, borderRadius: "99px", overflow: "hidden" },
    barFill: { height: "100%", background: "var(--vg-red)", borderRadius: "99px", transition: "width 0.4s ease" },

    toast: {
      padding: "10px 16px",
      borderRadius: "8px",
      border: "1px solid",
      marginBottom: "16px",
      fontSize: "13px",
      fontWeight: 500,
    },

    mainContent: { display: "flex", gap: "20px", alignItems: "flex-start" },

    formCard: {
      flex: 1,
      background: card,
      borderRadius: "14px",
      padding: "28px 28px 24px",
      boxShadow: "var(--vg-shadow-sm)",
      border: `1px solid ${border}`,
    },

    helpSidebar: { width: "300px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "14px" },

    campoContainer: { marginBottom: "20px" },

    label: {
      display: "block",
      fontSize: "11px",
      fontWeight: 600,
      color: muted,
      marginBottom: "7px",
      letterSpacing: "0.5px",
      textTransform: "uppercase",
    },

    required: { color: "var(--vg-red)", marginLeft: "4px" },

    input: {
      width: "100%",
      padding: "12px 16px",
      fontSize: "15px",
      border: `1.5px solid ${border}`,
      borderRadius: "10px",
      boxSizing: "border-box",
      outline: "none",
      transition: "border-color 0.2s",
      fontFamily: "var(--vg-font)",
      color: text,
      background: "var(--vg-input)",
    },

    inputError: {
      borderColor: "var(--vg-red)",
      background: "var(--vg-danger-bg)",
    },

    errorText: {
      display: "block",
      marginTop: "6px",
      fontSize: "12px",
      color: "var(--vg-danger-text)",
      fontWeight: 500,
    },

    radioGroup: { display: "flex", gap: "10px" },

    radioBtn: {
      flex: 1,
      padding: "12px 20px",
      fontSize: "14px",
      border: `1.5px solid ${border}`,
      borderRadius: "10px",
      background: "var(--vg-input)",
      cursor: "pointer",
      transition: "all 0.15s",
      fontFamily: "var(--vg-font)",
      color: text,
      fontWeight: 500,
    },

    radioBtnSel: { background: "var(--vg-red)", color: "#ffffff", borderColor: "var(--vg-red)" },
    radioBtnError: { borderColor: "var(--vg-red)" },

    navegacion: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "28px",
      paddingTop: "18px",
      borderTop: `1px solid ${border}`,
    },

    navBtn: {
      padding: "12px 28px",
      fontWeight: 600,
      borderRadius: "99px",
      cursor: "pointer",
      transition: "all 0.2s",
      fontFamily: "var(--vg-font)",
      border: "none",
    },

    navNext: { background: "linear-gradient(135deg,#e11d48 0%,#f43f5e 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(225,29,72,0.28)" },
    navBack: { background: card, border: `1px solid ${border}`, color: muted },

    helpBox: {
      background: "var(--vg-info-bg)",
      borderRadius: "12px",
      padding: "16px 18px",
      border: "1px solid var(--vg-info-border)",
    },

    helpTitleRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" },
    helpTitle: { margin: 0, fontWeight: 600, color: "var(--vg-accent)" },
    helpText: { margin: 0, fontSize: "13px", color: muted, lineHeight: 1.5 },

    tipBox: {
      background: "var(--vg-success-bg)",
      borderRadius: "12px",
      padding: "16px 18px",
      border: "1px solid var(--vg-success-border)",
    },

    tipTitleRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" },
    tipTitle: { margin: 0, fontWeight: 600, color: "var(--vg-success)" },
    tipItem: { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" },
    tipText: { fontSize: "13px", color: muted, lineHeight: 1.4 },

    seccionesBox: {
      background: card,
      borderRadius: "12px",
      padding: "16px 18px",
      border: `1px solid ${border}`,
    },

    seccionesTitle: {
      margin: "0 0 10px 0",
      fontSize: "11px",
      fontWeight: 600,
      color: muted,
      letterSpacing: "0.5px",
      textTransform: "uppercase",
    },

    seccionesList: { listStyle: "none", margin: 0, padding: 0 },

    seccionItem: {
      display: "flex",
      alignItems: "center",
      padding: "8px 10px",
      borderRadius: "8px",
      fontSize: "13px",
      color: muted,
      cursor: "pointer",
      transition: "background 0.15s",
      marginBottom: "2px",
    },

    seccionActual: {
      background: "var(--vg-red)",
      color: "#fff",
      fontWeight: 600,
    },

    seccionDone: {
      color: "var(--vg-success)",
    },
  };
}

export default function DS160Form() {
  const { isValidating: authValidating } = useRequireAuth();
  const modoSenior = useModoSenior();
  const st = getSt();
  const {
    seccionActual,
    formData,
    errores,
    guardando,
    descargandoPdf,
    mensajeGuardado,
    cargando,
    seccion,
    totalSecciones,
    progreso,
    debeMostrar,
    handleChange,
    guardarProgreso,
    descargarPdf,
    finalizarFormulario,
    siguienteSeccion,
    anteriorSeccion,
  } = useDS160Form();

  const campoConAyuda = seccion?.campos.find(c => c.tip || c.porque);

  if (authValidating || cargando) {
    return (
      <div style={st.layout}>
        <Sidebar currentPage="ds160" />
        <main id="main-content" tabIndex="-1" className="vg-authenticated-page ds160-page" style={st.page}>
          <div className="ds160-header" style={st.headerCard}>
            <p style={{ textAlign: "center", color: "var(--vg-text-muted)", margin: 0 }}>Cargando formulario...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={st.layout}>
      <Sidebar currentPage="ds160" />
      <main id="main-content" tabIndex="-1" className="vg-authenticated-page ds160-page" style={st.page}>

        {/* HEADER */}
        <div className="ds160-header" style={st.headerCard}>
          <div style={st.headerRow}>
            <div>
              <h1 style={{ ...st.titulo, fontSize: modoSenior ? "40px" : "var(--vg-page-title)" }}>Formulario DS-160</h1>
              <p style={{ ...st.subtitulo, fontSize: modoSenior ? "18px" : "var(--vg-body-size)" }}>
                Sección {seccionActual}: {seccion?.titulo} ({seccionActual} de {totalSecciones})
              </p>
            </div>
            <div style={st.headerActions}>
              <button className="ds160-header-btn" style={st.guardarBtn} onClick={descargarPdf} disabled={descargandoPdf} aria-label="Descargar PDF">
                <DownloadIcon />
                {descargandoPdf ? "Descargando..." : "Descargar PDF"}
              </button>
              <button className="ds160-header-btn" style={st.guardarBtn} onClick={() => guardarProgreso()} disabled={guardando} aria-label="Guardar progreso">
                <SaveIcon />
                {guardando ? "Guardando..." : "Guardar progreso"}
              </button>
            </div>
          </div>
          <div className="ds160-progress" style={st.barTrack} role="progressbar" aria-valuenow={Math.round(progreso)} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ ...st.barFill, width: `${progreso}%` }} />
          </div>
        </div>

        {mensajeGuardado && (
          <div style={{
            ...st.toast,
            background: mensajeGuardado.startsWith("✓") ? "var(--vg-success-bg)" : "var(--vg-danger-bg)",
            borderColor: mensajeGuardado.startsWith("✓") ? "var(--vg-success-border)" : "var(--vg-danger-border)",
            color: mensajeGuardado.startsWith("✓") ? "var(--vg-success)" : "var(--vg-danger-text)"
          }}>
            {mensajeGuardado}
          </div>
        )}

        {/* MAIN */}
        <div className="ds160-content" style={st.mainContent}>

          {/* Formulario */}
          <div className="ds160-form-card" style={st.formCard}>
            {seccion?.campos.map(campo => (
              debeMostrar(campo) && (
                <DS160Field
                  key={campo.name}
                  campo={campo}
                  value={formData[campo.name]}
                  error={errores[campo.name]}
                  onChange={handleChange}
                  modoSenior={modoSenior}
                  styles={st}
                />
              )
            ))}
            <div className="ds160-nav" style={st.navegacion}>
              <button
                className="ds160-nav-btn"
                style={{ ...st.navBtn, ...st.navBack, fontSize: modoSenior ? "15px" : "13px", opacity: seccionActual === 1 ? 0.4 : 1 }}
                onClick={anteriorSeccion}
                disabled={seccionActual === 1}
              >
                ← Anterior
              </button>
              {seccionActual < totalSecciones ? (
                <button className="ds160-nav-btn ds160-nav-btn--next" style={{ ...st.navBtn, ...st.navNext, fontSize: modoSenior ? "16px" : "14px" }} onClick={siguienteSeccion}>
                  Siguiente →
                </button>
              ) : (
                <button
                  className="ds160-nav-btn ds160-nav-btn--next"
                  style={{ ...st.navBtn, ...st.navNext, fontSize: modoSenior ? "16px" : "14px", opacity: guardando ? 0.7 : 1 }}
                  onClick={finalizarFormulario}
                  disabled={guardando}
                >
                  {guardando ? "Finalizando..." : "Finalizar ✓"}
                </button>
              )}
            </div>
          </div>

          {/* Sidebar de ayuda */}
          <div className="ds160-help" style={st.helpSidebar}>

            {campoConAyuda?.porque && (
              <div className="ds160-help-box" style={st.helpBox}>
                <div style={st.helpTitleRow}>
                  <InfoCircleIcon />
                  <h4 style={{ ...st.helpTitle, fontSize: modoSenior ? "15px" : "13px" }}>
                    ¿Por qué preguntan esto?
                  </h4>
                </div>
                <p style={{ ...st.helpText, fontSize: modoSenior ? "15px" : "13px" }}>
                  {campoConAyuda.porque}
                </p>
              </div>
            )}

            {campoConAyuda?.tip && (
              <div className="ds160-help-box" style={st.tipBox}>
                <div style={st.tipTitleRow}>
                  <h4 style={{ ...st.tipTitle, fontSize: modoSenior ? "15px" : "13px" }}>Tip del Asesor</h4>
                </div>
                {campoConAyuda.tip.split(". ").filter(t => t.trim()).map((linea, i) => (
                  <div key={i} className="ds160-tip-item" style={st.tipItem}>
                    <CheckCircleIcon />
                    <span style={{ ...st.tipText, fontSize: modoSenior ? "14px" : "13px" }}>
                      {linea.trim().replace(/\.$/, "")}.
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="ds160-help-box" style={st.seccionesBox}>
              <h4 className="ds160-sections-title" style={st.seccionesTitle}>
                SECCIONES DEL FORMULARIO
              </h4>
              <ul style={st.seccionesList}>
                {secciones.map(sc => (
                  <li
                    key={sc.id}
                    className="ds160-section-item"
                    style={{
                      ...st.seccionItem,
                      ...(sc.id === seccionActual ? st.seccionActual : {}),
                      ...(sc.id < seccionActual ? st.seccionDone : {}),
                      fontSize: modoSenior ? "14px" : "13px"
                    }}
                  >
                    {sc.id < seccionActual && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="var(--vg-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        style={{ marginRight: "6px", flexShrink: 0 }} aria-hidden="true">
                        <polyline points="20,6 9,17 4,12" />
                      </svg>
                    )}
                    {sc.titulo}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}