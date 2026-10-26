import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "../utils/sessionAuth";
import useIdioma from "../hooks/useIdioma";
import NotificationPriorityBadge from "./NotificationPriorityBadge";
import { getNotificationPriority } from "../utils/notificationPriority";
import { BellIcon } from "./icons/VisaGuideIcons";

export default function NotificationCenter({ userId, unreadCount = 0 }) {
  const { t } = useIdioma();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const requestControllerRef = useRef(null);

  const closePanel = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const loadNotifications = async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    setError("");
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const response = await fetch(buildApiUrl("/notificaciones/listar"), {
        method: "POST",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userId }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("notifications.error");
      const data = await response.json();
      setNotifications(data.notificaciones || []);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError("notifications.error");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const togglePanel = () => {
    if (!open) loadNotifications();
    setOpen((value) => !value);
  };

  const openNotification = async (notification) => {
    if (busyId !== null) return;
    setBusyId(notification.id);
    setActionError("");

    try {
      if (!notification.leido) {
        const response = await fetch(buildApiUrl(`/notificaciones/${notification.id}/leer`), {
          method: "PUT",
          headers: buildSessionHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId }),
        });
        if (!response.ok) throw new Error("No se pudo marcar la notificación como leída.");
      }

      const actionUrl = String(notification.action_url || "");
      const hasSafeAction = actionUrl.startsWith("/") && !actionUrl.startsWith("//");

      setNotifications((current) => (
        hasSafeAction
          ? current.map((item) => item.id === notification.id ? { ...item, leido: true } : item)
          : current.filter((item) => item.id !== notification.id)
      ));
      window.dispatchEvent(new CustomEvent("notificacionesLeidas"));

      if (hasSafeAction) {
        closePanel(false);
        navigate(actionUrl);
      }
    } catch (requestError) {
      setActionError(requestError.message || "No se pudo actualizar la notificación.");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closePanel();
    };
    const handlePointerDown = (event) => {
      if (
        !panelRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        closePanel(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  return (
    <div className="vg-notification-center">
      <button
        ref={triggerRef}
        type="button"
        className="vg-notification-trigger"
        aria-label={unreadCount > 0 ? t("notifications.openUnread", { count: unreadCount }) : t("notifications.open")}
        aria-expanded={open}
        aria-controls="vg-notification-panel"
        onClick={togglePanel}
      >
        <BellIcon size={22} strokeWidth={2} />
        {unreadCount > 0 && <span className="vg-notification-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <section
          id="vg-notification-panel"
          ref={panelRef}
          className="vg-notification-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="vg-notification-title"
        >
          <header className="vg-notification-panel__header">
            <h2 id="vg-notification-title">{t("notifications.title")}</h2>
            <button ref={closeRef} type="button" onClick={() => closePanel()} aria-label={t("notifications.close")}>×</button>
          </header>
          <div className="vg-notification-panel__body" aria-live="polite">
            {actionError && <p className="vg-notification-error" role="alert">{actionError}</p>}
            {loading ? (
              <p className="vg-notification-empty" role="status">{t("notifications.loading")}</p>
            ) : error ? (
              <div className="vg-notification-empty" role="alert">
                <p>{t(error)}</p>
                <button type="button" onClick={loadNotifications}>{t("notifications.retry")}</button>
              </div>
            ) : notifications.length === 0 ? (
              <p className="vg-notification-empty">{t("notifications.empty")}</p>
            ) : (
              <ul className="vg-notification-list">
                {notifications.map((notification) => {
                  const priority = getNotificationPriority(notification);
                  return (
                    <li key={notification.id} className={[notification.leido ? "" : "is-unread", `is-priority-${priority}`].filter(Boolean).join(" ")}>
                      <button
                        type="button"
                        className="vg-notification-item"
                        disabled={busyId === notification.id}
                        onClick={() => openNotification(notification)}
                        aria-label={`${notification.leido ? "Abrir" : "Leer"}: ${notification.titulo}`}
                      >
                        <NotificationPriorityBadge priority={priority} label={t(`notifications.priority.${priority}`)} />
                        <strong>{notification.titulo}</strong>
                        {notification.mensaje && <p>{notification.mensaje}</p>}
                        {!notification.action_url && (
                          <small>{busyId === notification.id ? "Actualizando…" : "Pulsa para quitar este aviso pendiente"}</small>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
