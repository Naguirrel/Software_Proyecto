import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { advisorRequest } from "../../utils/advisorApi";
import { consumeAdvisorNotificationStream } from "../../utils/advisorNotificationStream";
import { mergeNotification, orderNotifications } from "../../utils/advisorNotificationState";
import { AdvisorNotificationsContext } from "./advisorNotificationsStore";

const CHANNEL_NAME = "visaguide-advisor-notifications";
const RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000];

function playNotificationSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.addEventListener("ended", () => context.close(), { once: true });
  } catch {
    // El navegador puede bloquear audio hasta que exista una interacción del usuario.
  }
}

export function AdvisorNotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [preferences, setPreferences] = useState({ sound_enabled: false, muted_types: [] });
  const notificationsRef = useRef([]);
  const broadcastRef = useRef(null);
  const toastTimersRef = useRef(new Map());
  const preferencesRef = useRef(preferences);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);

  const applySnapshot = useCallback((snapshot) => {
    const nextNotifications = orderNotifications(snapshot.notifications || []);
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
    setUnreadCount(Number(snapshot.unreadCount) || 0);
    setHasMore(Boolean(snapshot.hasMore));
  }, []);

  const dismissToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimersRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const applyIncoming = useCallback((notification, { broadcast = true, announce = true } = {}) => {
    const current = notificationsRef.current;
    const existing = current.find((item) => item.id === notification.id);
    const nextNotifications = mergeNotification(current, notification);
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
    if (!notification.leido && !notification.archivado && (!existing || existing.leido || existing.archivado)) {
      setUnreadCount((count) => count + 1);
    }
    const muted = preferencesRef.current.muted_types?.includes(notification.tipo);
    if (announce && !muted && document.visibilityState !== "hidden") {
      setToasts((current) => [notification, ...current.filter((toast) => toast.id !== notification.id)].slice(0, 3));
      const currentTimer = toastTimersRef.current.get(notification.id);
      if (currentTimer) window.clearTimeout(currentTimer);
      toastTimersRef.current.set(notification.id, window.setTimeout(() => dismissToast(notification.id), 6_000));
      if (preferencesRef.current.sound_enabled) playNotificationSound();
    }
    window.dispatchEvent(new CustomEvent("advisor:notification", { detail: notification }));
    if (broadcast) broadcastRef.current?.postMessage({ kind: "notification", notification });
  }, [dismissToast]);

  useEffect(() => () => {
    for (const timer of toastTimersRef.current.values()) window.clearTimeout(timer);
    toastTimersRef.current.clear();
  }, []);

  const loadNotifications = useCallback(async (query = "") => {
    const data = await advisorRequest(`/notifications${query ? `?${query}` : ""}`);
    applySnapshot(data);
    setError("");
    return data;
  }, [applySnapshot]);

  const loadMore = useCallback(async () => {
    const oldest = notificationsRef.current.at(-1);
    if (!oldest || !hasMore) return;
    const data = await advisorRequest(`/notifications?limit=50&beforeId=${oldest.id}`);
    const byId = new Map(notificationsRef.current.map((notification) => [notification.id, notification]));
    for (const notification of data.notifications || []) byId.set(notification.id, notification);
    const nextNotifications = orderNotifications([...byId.values()]);
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
    setHasMore(Boolean(data.hasMore));
  }, [hasMore]);

  useEffect(() => {
    let active = true;
    advisorRequest("/notifications/preferences/current")
      .then((data) => { if (active) setPreferences(data.preferences); })
      .catch(() => {});
    const initialLoadTimer = window.setTimeout(() => {
      loadNotifications().catch((requestError) => { if (active) setError(requestError.message); });
    }, 0);
    return () => { active = false; window.clearTimeout(initialLoadTimer); };
  }, [loadNotifications]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return undefined;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    broadcastRef.current = channel;
    channel.onmessage = (message) => {
      if (message.data?.kind === "notification") applyIncoming(message.data.notification, { broadcast: false, announce: false });
      if (message.data?.kind === "refresh") loadNotifications().catch(() => {});
    };
    return () => {
      broadcastRef.current = null;
      channel.close();
    };
  }, [applyIncoming, loadNotifications]);

  useEffect(() => {
    let disposed = false;
    let controller = null;
    let reconnectAttempt = 0;
    let reconnectTimer = null;

    const connect = async () => {
      if (disposed) return;
      controller = new AbortController();
      setStatus("connecting");
      try {
        await consumeAdvisorNotificationStream({
          signal: controller.signal,
          onOpen: () => {
            reconnectAttempt = 0;
            setStatus("live");
            setError("");
          },
          onEvent: ({ event, data }) => {
            if (event === "snapshot") applySnapshot(data);
            if (event === "notification") applyIncoming(data);
            if (event === "stream-error") setError(data.message);
          },
        });
      } catch (streamError) {
        if (disposed || streamError.name === "AbortError") return;
        setStatus("offline");
        setError(streamError.message);
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delay + Math.round(Math.random() * 500));
      }
    };
    connect();
    return () => {
      disposed = true;
      controller?.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [applyIncoming, applySnapshot]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") loadNotifications().catch(() => {});
    }, 60_000);
    const refreshNow = () => {
      loadNotifications().catch(() => {});
      broadcastRef.current?.postMessage({ kind: "refresh" });
    };
    window.addEventListener("advisor:notifications-refresh", refreshNow);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("advisor:notifications-refresh", refreshNow);
    };
  }, [loadNotifications]);

  const markRead = useCallback(async (id) => {
    const current = notificationsRef.current.find((item) => item.id === id);
    if (!current || current.leido) return current;
    const data = await advisorRequest(`/notifications/${id}/read`, { method: "PUT" });
    const nextNotifications = notificationsRef.current.map((item) => item.id === id ? data.notification : item);
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
    setUnreadCount((count) => Math.max(0, count - 1));
    broadcastRef.current?.postMessage({ kind: "refresh" });
    return data.notification;
  }, []);

  const markAllRead = useCallback(async () => {
    await advisorRequest("/notifications/read-all", { method: "PUT" });
    const nextNotifications = notificationsRef.current.map((item) => ({ ...item, leido: true }));
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
    setUnreadCount(0);
    broadcastRef.current?.postMessage({ kind: "refresh" });
  }, []);

  const archive = useCallback(async (id) => {
    await advisorRequest(`/notifications/${id}/archive`, { method: "PUT" });
    const archived = notificationsRef.current.find((item) => item.id === id);
    const nextNotifications = notificationsRef.current.filter((item) => item.id !== id);
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
    if (archived && !archived.leido) setUnreadCount((count) => Math.max(0, count - 1));
    broadcastRef.current?.postMessage({ kind: "refresh" });
  }, []);

  const remove = useCallback(async (id) => {
    await advisorRequest(`/notifications/${id}`, { method: "DELETE" });
    const deleted = notificationsRef.current.find((item) => item.id === id);
    const nextNotifications = notificationsRef.current.filter((item) => item.id !== id);
    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
    if (deleted && !deleted.leido) setUnreadCount((count) => Math.max(0, count - 1));
    broadcastRef.current?.postMessage({ kind: "refresh" });
  }, []);

  const updatePreferences = useCallback(async (nextPreferences) => {
    const data = await advisorRequest("/notifications/preferences/current", {
      method: "PUT",
      body: JSON.stringify({
        soundEnabled: nextPreferences.sound_enabled,
        mutedTypes: nextPreferences.muted_types,
      }),
    });
    setPreferences(data.preferences);
  }, []);

  const countsByType = useMemo(() => notifications.reduce((counts, notification) => {
    if (!notification.leido && !notification.archivado) counts[notification.tipo] = (counts[notification.tipo] || 0) + 1;
    return counts;
  }, {}), [notifications]);

  const value = useMemo(() => ({
    notifications, unreadCount, countsByType, hasMore, status, error, toasts, preferences,
    loadNotifications, loadMore, markRead, markAllRead, archive, remove, updatePreferences, dismissToast,
  }), [
    notifications, unreadCount, countsByType, hasMore, status, error, toasts, preferences,
    loadNotifications, loadMore, markRead, markAllRead, archive, remove, updatePreferences, dismissToast,
  ]);

  return <AdvisorNotificationsContext.Provider value={value}>{children}</AdvisorNotificationsContext.Provider>;
}
