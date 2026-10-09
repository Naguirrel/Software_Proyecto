import { useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "../utils/sessionAuth";
import useIdioma from "../hooks/useIdioma";

export default function NotificationCenter({ userId, unreadCount = 0 }) {
  const { t } = useIdioma();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
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
                {notifications.map((notification) => (
                  <li key={notification.id} className={notification.leido ? "" : "is-unread"}>
                    <strong>{notification.titulo}</strong>
                    {notification.mensaje && <p>{notification.mensaje}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
