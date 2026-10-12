const { EventEmitter } = require("events");

const CHANNEL = "visaguide_notification_events";
const MAX_CONNECTIONS_PER_USER = 6;
const RECENT_EVENT_TTL_MS = 60_000;

class NotificationRealtimeHub {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);
    this.connections = new Map();
    this.recentEvents = new Map();
  }

  publish(notification) {
    const userId = Number(notification?.id_usuario);
    const notificationId = Number(notification?.id);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(notificationId) || notificationId <= 0) return false;

    const rawVersion = notification.updated_at || notification.created_at || "";
    const parsedVersion = new Date(rawVersion).getTime();
    const normalizedVersion = Number.isFinite(parsedVersion) ? String(parsedVersion) : String(rawVersion);
    const eventKey = `${userId}:${notificationId}:${normalizedVersion}`;
    const now = Date.now();
    for (const [key, timestamp] of this.recentEvents) {
      if (now - timestamp > RECENT_EVENT_TTL_MS) this.recentEvents.delete(key);
    }
    if (this.recentEvents.has(eventKey)) return false;
    this.recentEvents.set(eventKey, now);
    this.emitter.emit(`user:${userId}`, notification);
    return true;
  }

  subscribe(userId, listener) {
    const normalizedUserId = Number(userId);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      const error = new Error("Asesor inválido");
      error.statusCode = 400;
      throw error;
    }
    const activeConnections = this.connections.get(normalizedUserId) || 0;
    if (activeConnections >= MAX_CONNECTIONS_PER_USER) {
      const error = new Error("Demasiadas conexiones de notificaciones activas");
      error.statusCode = 429;
      throw error;
    }

    const eventName = `user:${normalizedUserId}`;
    this.connections.set(normalizedUserId, activeConnections + 1);
    this.emitter.on(eventName, listener);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.emitter.off(eventName, listener);
      const remaining = Math.max(0, (this.connections.get(normalizedUserId) || 1) - 1);
      if (remaining) this.connections.set(normalizedUserId, remaining);
      else this.connections.delete(normalizedUserId);
    };
  }

  connectionCount(userId) {
    return this.connections.get(Number(userId)) || 0;
  }

  totalConnections() {
    return [...this.connections.values()].reduce((total, count) => total + count, 0);
  }
}

const notificationRealtimeHub = new NotificationRealtimeHub();
let bridgePromise = null;
let bridgeClient = null;
let reconnectTimer = null;
let stopping = false;

function parseNotificationPayload(payload) {
  try {
    const notification = JSON.parse(payload || "null");
    return notification && typeof notification === "object" ? notification : null;
  } catch {
    return null;
  }
}

async function connectBridge(pool) {
  const client = await pool.connect();
  bridgeClient = client;
  client.on("notification", (message) => {
    if (message.channel !== CHANNEL) return;
    const notification = parseNotificationPayload(message.payload);
    if (notification) notificationRealtimeHub.publish(notification);
  });
  client.on("error", (error) => {
    console.error(JSON.stringify({ event: "notification.bridge.error", message: error.message }));
    if (bridgeClient === client) bridgeClient = null;
    try { client.release(true); } catch { /* connection is already unavailable */ }
    scheduleReconnect(pool);
  });
  await client.query(`LISTEN ${CHANNEL}`);
  console.info(JSON.stringify({ event: "notification.bridge.connected" }));
}

function scheduleReconnect(pool) {
  if (stopping || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    bridgePromise = connectBridge(pool).catch((error) => {
      console.error(JSON.stringify({ event: "notification.bridge.retry_failed", message: error.message }));
      bridgePromise = null;
      scheduleReconnect(pool);
    });
  }, 5_000);
  reconnectTimer.unref?.();
}

function startNotificationBridge(pool) {
  if (process.env.NODE_ENV === "test" || bridgePromise || stopping) return bridgePromise || Promise.resolve();
  bridgePromise = connectBridge(pool).catch((error) => {
    console.error(JSON.stringify({ event: "notification.bridge.start_failed", message: error.message }));
    bridgePromise = null;
    scheduleReconnect(pool);
  });
  return bridgePromise;
}

async function stopNotificationBridge() {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const client = bridgeClient;
  bridgeClient = null;
  bridgePromise = null;
  if (!client) return;
  try { await client.query(`UNLISTEN ${CHANNEL}`); } catch { /* best effort during shutdown */ }
  client.release();
}

function publishNotification(pool, notification) {
  notificationRealtimeHub.publish(notification);
  if (process.env.NODE_ENV === "test") return;
  pool.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(notification)]).catch((error) => {
    console.error(JSON.stringify({ event: "notification.publish.failed", notificationId: notification.id, message: error.message }));
  });
}

module.exports = {
  CHANNEL,
  MAX_CONNECTIONS_PER_USER,
  NotificationRealtimeHub,
  notificationRealtimeHub,
  publishNotification,
  startNotificationBridge,
  stopNotificationBridge,
};
