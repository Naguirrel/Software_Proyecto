const express = require("express");
const createNotificacionService = require("../services/notificacionService");
const { notificationRealtimeHub } = require("../services/notificationRealtime");

const HEARTBEAT_INTERVAL_MS = 25_000;

function handleError(res, error, fallback = "No fue posible procesar las notificaciones") {
  if (res.headersSent) return res.end();
  const status = error.statusCode || 500;
  if (status >= 500) console.error("ADVISOR NOTIFICATION ERROR:", error);
  return res.status(status).json({ error: status >= 500 ? fallback : error.message });
}

function writeEvent(res, { event, data, id }) {
  if (res.writableEnded || res.destroyed) return false;
  if (id !== undefined && id !== null) res.write(`id: ${id}\n`);
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  return true;
}

module.exports = function createAdvisorNotificationRoutes(pool, {
  requireAdvisor = (_req, _res, next) => next(),
  notificationService = createNotificacionService(pool),
  realtimeHub = notificationRealtimeHub,
} = {}) {
  const router = express.Router();
  router.use(requireAdvisor);

  router.get("/", async (req, res) => {
    try {
      await notificationService.ensureAdvisorTaskReminders(req.auth.id_usuario).catch((error) => {
        console.error("ADVISOR TASK REMINDER ERROR:", error);
      });
      const page = await notificationService.listarPaginaPorUsuario(req.auth.id_usuario, req.query);
      const unreadCount = await notificationService.contarNoLeidas(req.auth.id_usuario);
      return res.json({ ...page, unreadCount });
    } catch (error) { return handleError(res, error); }
  });

  router.get("/stream", async (req, res) => {
    let unsubscribe;
    try {
      unsubscribe = realtimeHub.subscribe(req.auth.id_usuario, (notification) => {
        if (!res.writableEnded) writeEvent(res, { event: "notification", id: notification.id, data: notification });
      });
      console.info(JSON.stringify({
        event: "notification.stream.opened",
        advisorId: req.auth.id_usuario,
        activeConnections: realtimeHub.connectionCount?.(req.auth.id_usuario),
      }));
    } catch (error) { return handleError(res, error); }

    res.status(200);
    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write("retry: 3000\n\n");

    try {
      await notificationService.ensureAdvisorTaskReminders(req.auth.id_usuario).catch((error) => {
        console.error("ADVISOR TASK REMINDER ERROR:", error);
      });
      const [page, unreadCount] = await Promise.all([
        notificationService.listarPaginaPorUsuario(req.auth.id_usuario, { limit: 30 }),
        notificationService.contarNoLeidas(req.auth.id_usuario),
      ]);
      writeEvent(res, {
        event: "snapshot",
        data: { notifications: page.notifications, hasMore: page.hasMore, unreadCount },
      });
    } catch (error) {
      writeEvent(res, { event: "stream-error", data: { message: "No fue posible sincronizar las notificaciones" } });
    }

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(`: heartbeat ${Date.now()}\n\n`);
    }, HEARTBEAT_INTERVAL_MS);
    heartbeat.unref?.();

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe?.();
      console.info(JSON.stringify({
        event: "notification.stream.closed",
        advisorId: req.auth.id_usuario,
        activeConnections: realtimeHub.connectionCount?.(req.auth.id_usuario),
      }));
    };
    req.on("close", cleanup);
    res.on("close", cleanup);
    return undefined;
  });

  router.put("/read-all", async (req, res) => {
    try {
      const updated = await notificationService.marcarTodasLeidas(req.auth.id_usuario);
      return res.json({ message: "Notificaciones marcadas como leídas", updated });
    } catch (error) { return handleError(res, error); }
  });

  router.put("/:id/read", async (req, res) => {
    try {
      const notification = await notificationService.marcarLeida(req.params.id, req.auth.id_usuario);
      return res.json({ notification });
    } catch (error) { return handleError(res, error); }
  });

  router.put("/:id/archive", async (req, res) => {
    try {
      const notification = await notificationService.archivar(req.params.id, req.auth.id_usuario);
      return res.json({ notification });
    } catch (error) { return handleError(res, error); }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await notificationService.eliminar(req.params.id, req.auth.id_usuario);
      return res.json({ message: "Notificación eliminada" });
    } catch (error) { return handleError(res, error); }
  });

  router.get("/preferences/current", async (req, res) => {
    try {
      const preferences = await notificationService.getAdvisorPreferences(req.auth.id_usuario);
      return res.json({ preferences });
    } catch (error) { return handleError(res, error); }
  });

  router.put("/preferences/current", async (req, res) => {
    try {
      const preferences = await notificationService.updateAdvisorPreferences(req.auth.id_usuario, req.body);
      return res.json({ preferences });
    } catch (error) { return handleError(res, error); }
  });

  return router;
};

module.exports.HEARTBEAT_INTERVAL_MS = HEARTBEAT_INTERVAL_MS;
module.exports.writeEvent = writeEvent;
