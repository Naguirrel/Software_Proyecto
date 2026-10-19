import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Bell, CheckCheck, CircleAlert, FileText, MessageSquareText, Settings2, Trash2, UserPlus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdvisorNotifications } from "./advisorNotificationsStore";
import useIdioma from "../../hooks/useIdioma";
import NotificationPriorityBadge from "../NotificationPriorityBadge";
import { getNotificationPriority } from "../../utils/notificationPriority";

const typeLabels = {
  all: "Todos los tipos",
  assignment: "Asignaciones",
  documento: "Documentos",
  ds160: "DS-160",
  entrevista: "Entrevistas",
  chat: "Chat",
  task: "Tareas",
  alerta: "Alertas",
  info: "Información",
  etapa: "Etapas",
};

function NotificationIcon({ type }) {
  if (type === "documento" || type === "ds160") return <FileText aria-hidden="true" />;
  if (type === "chat" || type === "entrevista") return <MessageSquareText aria-hidden="true" />;
  if (type === "assignment") return <UserPlus aria-hidden="true" />;
  return <CircleAlert aria-hidden="true" />;
}

function relativeDate(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export default function AdvisorNotificationCenter() {
  const { t } = useIdioma();
  const {
    notifications, unreadCount, hasMore, status, error, preferences,
    loadNotifications, loadMore, markRead, markAllRead, archive, remove, updatePreferences,
  } = useAdvisorNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("all");
  const [type, setType] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  const close = (restoreFocus = true) => {
    setOpen(false);
    setSettingsOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === "Escape") close(); };
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const filtered = useMemo(() => notifications.filter((notification) => {
    if (view === "unread" && notification.leido) return false;
    return type === "all" || notification.tipo === type;
  }), [notifications, type, view]);

  const openNotification = async (notification) => {
    setBusyId(notification.id);
    setActionError("");
    try {
      await markRead(notification.id);
      close(false);
      if (notification.action_url) navigate(notification.action_url);
    } catch (requestError) {
      setActionError(requestError.message || "No fue posible abrir la notificación.");
    } finally { setBusyId(null); }
  };

  const toggleMutedType = (notificationType) => {
    const muted = preferences.muted_types || [];
    updatePreferences({
      ...preferences,
      muted_types: muted.includes(notificationType)
        ? muted.filter((item) => item !== notificationType)
        : [...muted, notificationType],
    }).catch((requestError) => setActionError(requestError.message));
  };

  return <div className="advisor-notifications">
    <button
      ref={triggerRef}
      type="button"
      className="admin-header__notification"
      aria-label={unreadCount ? `Abrir notificaciones, ${unreadCount} sin leer` : "Abrir notificaciones"}
      aria-expanded={open}
      aria-controls="advisor-notification-panel"
      onClick={() => setOpen((value) => !value)}
    >
      <Bell size={22} aria-hidden="true" />
      {unreadCount > 0 && <span className="advisor-notification-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section id="advisor-notification-panel" ref={panelRef} className="advisor-notification-panel" role="dialog" aria-modal="false" aria-labelledby="advisor-notification-title">
      <header>
        <div><h2 id="advisor-notification-title">Notificaciones</h2><span className={`advisor-live-status advisor-live-status--${status}`}>{status === "live" ? "En tiempo real" : status === "connecting" ? "Conectando…" : "Reconectando…"}</span></div>
        <div className="advisor-notification-header-actions">
          <button type="button" aria-label="Preferencias de notificaciones" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((value) => !value)}><Settings2 aria-hidden="true" /></button>
          <button ref={closeRef} type="button" aria-label="Cerrar notificaciones" onClick={() => close()}><X aria-hidden="true" /></button>
        </div>
      </header>
      {settingsOpen && <div className="advisor-notification-settings">
        <label><input type="checkbox" checked={Boolean(preferences.sound_enabled)} onChange={(event) => updatePreferences({ ...preferences, sound_enabled: event.target.checked }).catch((requestError) => setActionError(requestError.message))} /> Sonido para avisos nuevos</label>
        <fieldset><legend>Silenciar avisos emergentes</legend>{["chat", "documento", "ds160", "entrevista", "task"].map((item) => <label key={item}><input type="checkbox" checked={preferences.muted_types?.includes(item) || false} onChange={() => toggleMutedType(item)} /> {typeLabels[item]}</label>)}</fieldset>
      </div>}
      <div className="advisor-notification-toolbar">
        <div role="tablist" aria-label="Estado de las notificaciones">
          <button type="button" role="tab" aria-selected={view === "all"} onClick={() => setView("all")}>Todas</button>
          <button type="button" role="tab" aria-selected={view === "unread"} onClick={() => setView("unread")}>Sin leer</button>
        </div>
        <select aria-label="Filtrar por tipo" value={type} onChange={(event) => setType(event.target.value)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>
      {unreadCount > 0 && <button className="advisor-notification-read-all" type="button" onClick={() => markAllRead().catch((requestError) => setActionError(requestError.message))}><CheckCheck aria-hidden="true" /> Marcar todas como leídas</button>}
      <div className="advisor-notification-body" aria-live="polite">
        {(actionError || (error && status === "offline")) && <div className="advisor-notification-error" role="status"><span>{actionError || error}</span><button type="button" onClick={() => { setActionError(""); loadNotifications().catch((requestError) => setActionError(requestError.message)); }}>Actualizar</button></div>}
        {!filtered.length ? <p className="advisor-notification-empty">No hay notificaciones en este filtro.</p> : <ul>{filtered.map((notification) => { const priority = getNotificationPriority(notification); return <li key={notification.id} className={[notification.leido ? "" : "is-unread", `is-priority-${priority}`].filter(Boolean).join(" ")}>
          <button className="advisor-notification-content" type="button" disabled={busyId === notification.id} onClick={() => openNotification(notification)}>
            <span className={`advisor-notification-icon advisor-notification-icon--${notification.tipo}`}><NotificationIcon type={notification.tipo} /></span>
            <span><NotificationPriorityBadge priority={priority} label={t(`notifications.priority.${priority}`)} /><strong>{notification.titulo}</strong><small>{notification.mensaje}</small><time dateTime={notification.created_at} title={new Date(notification.created_at).toLocaleString("es-GT")}>{relativeDate(notification.created_at)}</time></span>
          </button>
          <div className="advisor-notification-item-actions">
            <button type="button" aria-label={`Archivar: ${notification.titulo}`} onClick={() => archive(notification.id).catch((requestError) => setActionError(requestError.message))}><Archive aria-hidden="true" /></button>
            <button type="button" aria-label={`Eliminar: ${notification.titulo}`} onClick={() => remove(notification.id).catch((requestError) => setActionError(requestError.message))}><Trash2 aria-hidden="true" /></button>
          </div>
        </li>; })}</ul>}
        {hasMore && <button type="button" className="advisor-notification-load-more" onClick={() => loadMore().catch((requestError) => setActionError(requestError.message))}>Cargar notificaciones anteriores</button>}
      </div>
    </section>}
  </div>;
}
