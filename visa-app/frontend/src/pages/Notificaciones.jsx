import { useEffect, useState, useCallback } from "react";
import { buildApiUrl } from "../config/api";
import Sidebar from "../components/Sidebar";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import useIdioma from "../hooks/useIdioma";
import NotificationPriorityBadge from "../components/NotificationPriorityBadge";
import { getNotificationPriority } from "../utils/notificationPriority";
import { buildSessionHeaders } from "../utils/sessionAuth";

const TIPO_CONFIG = {
  etapa:       { label: "Etapa",       bg: "var(--vg-info-bg)", color: "var(--vg-info-text)" },
  documento:   { label: "Documento",   bg: "var(--vg-amber-bg)", color: "var(--vg-amber-text)" },
  entrevista:  { label: "Entrevista",  bg: "var(--vg-success-bg)", color: "var(--vg-success)" },
  alerta:      { label: "Alerta",      bg: "var(--vg-danger-bg)", color: "var(--vg-danger-text)" },
  info:        { label: "Info",        bg: "var(--vg-info-bg)", color: "var(--vg-info-text)" },
};

function formatFecha(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Notificaciones() {
  const { isValidating, session } = useRequireAuth();
  const modoSenior = useModoSenior();
  const { t } = useIdioma();

  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [errorAccion, setErrorAccion] = useState("");
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  const fs = (base) => (modoSenior ? base + 3 : base);

  const cargarNotificaciones = useCallback(async (signal) => {
    if (!session?.id) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl("/notificaciones/listar"), {
        method: "POST",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userId: session.id }),
        signal,
      });
      if (!res.ok) throw new Error("No se pudieron cargar las notificaciones");
      const data = await res.json();
      setNotificaciones(data.notificaciones || []);
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message);
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [session]);

  useEffect(() => {
    if (isValidating || !session) return;
    const controller = new AbortController();
    cargarNotificaciones(controller.signal);
    return () => controller.abort();
  }, [isValidating, session, cargarNotificaciones]);

  const marcarLeida = async (id) => {
    setErrorAccion("");
    try {
      const res = await fetch(buildApiUrl(`/notificaciones/${id}/leer`), {
        method: "PUT",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userId: session.id }),
      });
      if (!res.ok) throw new Error("Error al marcar notificación");
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leido: true } : n))
      );
      window.dispatchEvent(new CustomEvent("notificacionesLeidas"));
    } catch (e) {
      setErrorAccion(e.message || "No se pudo actualizar la notificación");
    }
  };

  const marcarTodasLeidas = async () => {
    setMarcandoTodas(true);
    setErrorAccion("");
    try {
      const res = await fetch(buildApiUrl("/notificaciones/leer-todas"), {
        method: "PUT",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userId: session.id }),
      });
      if (!res.ok) throw new Error("Error al marcar todas");
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
      window.dispatchEvent(new CustomEvent("notificacionesLeidas"));
    } catch (e) {
      setErrorAccion(e.message || "No se pudieron actualizar las notificaciones");
    } finally {
      setMarcandoTodas(false);
    }
  };

  const eliminarNotificacion = async (id) => {
    setEliminandoId(id);
    setErrorAccion("");
    try {
      const res = await fetch(buildApiUrl(`/notificaciones/${id}`), {
        method: "DELETE",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userId: session.id }),
      });
      if (!res.ok) throw new Error("No se pudo eliminar la notificación");
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new CustomEvent("notificacionesLeidas"));
    } catch (e) {
      setErrorAccion(e.message || "No se pudo eliminar la notificación");
    } finally {
      setEliminandoId(null);
    }
  };

  const noLeidas = notificaciones.filter((n) => !n.leido).length;

  if (isValidating) {
    return (
      <div style={s.layout}>
        <Sidebar currentPage="notificaciones" />
        <main id="main-content" tabIndex="-1" className="vg-authenticated-page" style={s.main}>
          <p style={{ color: "var(--vg-text-muted)", paddingTop: "40px", fontSize: fs(14) }}>
            Verificando sesión...
          </p>
        </main>
      </div>
    );
  }

  return (
    <div style={s.layout}>
      <Sidebar currentPage="notificaciones" />
      <main id="main-content" tabIndex="-1" className="vg-authenticated-page" style={s.main}>
        {/* Encabezado */}
        <div style={s.header}>
          <div>
            <h1 style={{ ...s.titulo, fontSize: modoSenior ? "44px" : "var(--vg-page-title)" }}>Notificaciones</h1>
            {noLeidas > 0 && (
              <p style={{ ...s.subtitulo, fontSize: fs(13) }}>
                Tienes{" "}
                <span style={s.badge}>{noLeidas}</span>{" "}
                notificación{noLeidas !== 1 ? "es" : ""} sin leer
              </p>
            )}
          </div>
          {noLeidas > 0 && (
            <button
              style={{
                ...s.btnTodas,
                opacity: marcandoTodas ? 0.6 : 1,
                fontSize: fs(13),
              }}
              onClick={marcarTodasLeidas}
              disabled={marcandoTodas}
            >
              {marcandoTodas ? "Marcando..." : "Marcar todas como leídas"}
            </button>
          )}
        </div>

        {errorAccion && (
          <p role="alert" style={{ ...s.errorAccion, fontSize: fs(13) }}>
            {errorAccion}
          </p>
        )}

        {/* Estados */}
        {cargando && (
          <div style={s.centrado}>
            <p style={{ color: "var(--vg-text-muted)", fontSize: fs(14) }}>Cargando notificaciones...</p>
          </div>
        )}

        {!cargando && error && (
          <div style={s.errorBox}>
            <p style={{ color: "#dc2626", fontSize: fs(14), margin: 0 }}>{error}</p>
            <button style={s.btnReintentar} onClick={() => cargarNotificaciones()}>
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && notificaciones.length === 0 && (
          <div style={s.vacio}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p style={{ color: "#94a3b8", fontSize: fs(15), marginTop: "16px" }}>
              No tienes notificaciones
            </p>
          </div>
        )}

        {/* Lista */}
        {!cargando && !error && notificaciones.length > 0 && (
          <div style={s.lista}>
            {notificaciones.map((n) => {
              const cfg = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.info;
              const prioridad = getNotificationPriority(n);
              const esAlta = prioridad === "alta";
              return (
                <div
                  key={n.id}
                  data-priority={prioridad}
                  style={{
                    ...s.card,
                    backgroundColor: esAlta ? "var(--vg-danger-bg)" : n.leido ? "#ffffff" : "#f0f9ff",
                    borderLeft: esAlta
                      ? "4px solid var(--vg-danger-text)"
                      : n.leido ? "4px solid #e2e8f0" : "4px solid #dc2649",
                    opacity: prioridad === "baja" && n.leido ? 0.8 : 1,
                  }}
                >
                  {!n.leido && <span style={s.puntoPendiente} />}

                  <div style={s.cardBody}>
                    <div style={s.cardTop}>
                      <NotificationPriorityBadge priority={prioridad} label={t(`notifications.priority.${prioridad}`)} />
                      <span style={{ ...s.tipoBadge, background: cfg.bg, color: cfg.color, fontSize: fs(11) }}>
                        {cfg.label}
                      </span>
                      <span style={{ ...s.fecha, fontSize: fs(12) }}>
                        {formatFecha(n.created_at)}
                      </span>
                    </div>

                    <p style={{ ...s.cardTitulo, fontSize: fs(15) }}>{n.titulo}</p>
                    <p style={{ ...s.cardMensaje, fontSize: fs(13) }}>{n.mensaje}</p>

                    {n.etapa_relacionada && (
                      <p style={{ ...s.etapaTag, fontSize: fs(12) }}>
                        Etapa: {n.etapa_relacionada}
                      </p>
                    )}
                  </div>

                  {!n.leido && (
                    <button
                      style={{ ...s.btnLeer, fontSize: fs(12) }}
                      onClick={() => marcarLeida(n.id)}
                      aria-label={`Marcar como leída: ${n.titulo}`}
                    >
                      Marcar como leída
                    </button>
                  )}
                  <button
                    style={{ ...s.btnEliminar, fontSize: fs(12) }}
                    onClick={() => eliminarNotificacion(n.id)}
                    disabled={eliminandoId === n.id}
                    aria-label={`Eliminar: ${n.titulo}`}
                  >
                    {eliminandoId === n.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

const s = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "var(--vg-bg)",
    fontFamily: "var(--vg-font)",
  },
  main: {
    marginLeft: "var(--vg-sidebar-w)",
    flex: 1,
    padding: "var(--vg-page-pad-top) var(--vg-page-pad-x) var(--vg-page-pad-bottom)",
    maxWidth: "var(--vg-content-max)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: "24px",
    marginBottom: "32px",
    borderBottom: "1px solid var(--vg-border)",
    flexWrap: "wrap",
    gap: "12px",
  },
  titulo: {
    color: "var(--vg-text)",
    fontWeight: "700",
    margin: 0,
  },
  subtitulo: {
    color: "var(--vg-text-muted)",
    margin: "6px 0 0 0",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  badge: {
    backgroundColor: "#dc2649",
    color: "white",
    borderRadius: "999px",
    padding: "2px 8px",
    fontSize: "12px",
    fontWeight: "600",
  },
  btnTodas: {
    backgroundColor: "transparent",
    border: "1px solid #dc2649",
    color: "#dc2649",
    borderRadius: "8px",
    padding: "8px 16px",
    cursor: "pointer",
    fontWeight: "500",
    fontFamily: "var(--vg-font)",
  },
  centrado: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "60px",
  },
  errorBox: {
    backgroundColor: "var(--vg-danger-bg)",
    border: "1px solid var(--vg-border)",
    borderRadius: "10px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  btnReintentar: {
    backgroundColor: "#dc2649",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: "13px",
    fontFamily: "var(--vg-font)",
  },
  vacio: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: "80px",
    color: "#94a3b8",
  },
  lista: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    borderRadius: "12px",
    border: "1px solid var(--vg-border)",
    padding: "18px 20px",
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    position: "relative",
    transition: "box-shadow 0.15s ease",
  },
  puntoPendiente: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    backgroundColor: "#dc2649",
    flexShrink: 0,
    marginTop: "6px",
  },
  cardBody: {
    flex: 1,
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },
  tipoBadge: {
    borderRadius: "6px",
    padding: "2px 8px",
    fontWeight: "600",
  },
  fecha: {
    color: "#94a3b8",
  },
  cardTitulo: {
    color: "var(--vg-text)",
    fontWeight: "600",
    margin: "0 0 4px 0",
  },
  cardMensaje: {
    color: "var(--vg-text-muted)",
    margin: 0,
    lineHeight: "1.5",
  },
  etapaTag: {
    marginTop: "8px",
    color: "var(--vg-info-text)",
    fontWeight: "500",
  },
  btnLeer: {
    flexShrink: 0,
    backgroundColor: "transparent",
    border: "1px solid var(--vg-border)",
    borderRadius: "7px",
    padding: "6px 12px",
    color: "var(--vg-text-muted)",
    cursor: "pointer",
    fontFamily: "var(--vg-font)",
    whiteSpace: "nowrap",
  },
  btnEliminar: {
    flexShrink: 0,
    backgroundColor: "transparent",
    border: "1px solid var(--vg-danger-text)",
    borderRadius: "7px",
    padding: "6px 12px",
    color: "var(--vg-danger-text)",
    cursor: "pointer",
    fontFamily: "var(--vg-font)",
    whiteSpace: "nowrap",
  },
  errorAccion: {
    margin: "0 0 16px",
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "var(--vg-danger-bg)",
    color: "var(--vg-danger-text)",
  },
};
