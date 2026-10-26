import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../utils/apiClient";
import { buildSessionHeaders } from "../utils/sessionAuth";

// Las notificaciones llegan al cliente en menos de un minuto (RNF-31): se consulta el contador
// cada 30 s mientras la pestaña está visible y de inmediato al volver a ella.
export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;

export default function useUnreadNotifications(userId, { pollInterval = NOTIFICATION_POLL_INTERVAL_MS } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return undefined;
    }

    let active = true;
    let requestInFlight = false;
    const controllers = new Set();

    const load = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const data = await apiRequest("/notificaciones/no-leidas", {
          method: "POST",
          headers: buildSessionHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId }),
          signal: controller.signal,
        });
        if (active) setUnreadCount(Number(data?.total) || 0);
      } catch {
        // Silencioso: se conserva el último contador y se reintenta en la siguiente consulta.
      } finally {
        requestInFlight = false;
        controllers.delete(controller);
      }
    };

    load();
    const intervalId = pollInterval > 0
      ? window.setInterval(() => document.visibilityState !== "hidden" && load(), pollInterval)
      : null;
    const handleVisibility = () => { if (document.visibilityState === "visible") load(); };
    const handleRefresh = () => load();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("notificacionesLeidas", handleRefresh);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("notificacionesLeidas", handleRefresh);
      controllers.forEach((controller) => controller.abort());
    };
  }, [userId, pollInterval, revision]);

  return { unreadCount, refresh };
}
