const express = require("express");
const request = require("supertest");
const createAdvisorNotificationRoutes = require("../routes/advisorNotificationRoutes");
const { NotificationRealtimeHub, MAX_CONNECTIONS_PER_USER } = require("../services/notificationRealtime");

function createNotificationService() {
  return {
    ensureAdvisorTaskReminders: jest.fn(async () => []),
    listarPaginaPorUsuario: jest.fn(async () => ({
      notifications: [{ id: 7, id_usuario: 9, titulo: "Nuevo mensaje", tipo: "chat", leido: false }],
      hasMore: false,
    })),
    contarNoLeidas: jest.fn(async () => 1),
    marcarTodasLeidas: jest.fn(async () => 1),
    marcarLeida: jest.fn(async (id, userId) => ({ id: Number(id), id_usuario: userId, leido: true })),
    archivar: jest.fn(async (id, userId) => ({ id: Number(id), id_usuario: userId, archivado: true, leido: true })),
    eliminar: jest.fn(async (id) => Number(id)),
    getAdvisorPreferences: jest.fn(async (advisorId) => ({ advisor_id: advisorId, sound_enabled: false, muted_types: [] })),
    updateAdvisorPreferences: jest.fn(async (advisorId, payload) => ({
      advisor_id: advisorId,
      sound_enabled: payload.soundEnabled === true,
      muted_types: payload.mutedTypes || [],
    })),
  };
}

function buildApp(notificationService) {
  const app = express();
  app.use(express.json());
  const requireAdvisor = (req, _res, next) => {
    req.auth = { id_usuario: 9, rol: "asesor" };
    next();
  };
  app.use("/advisor/notifications", createAdvisorNotificationRoutes({}, {
    requireAdvisor,
    notificationService,
  }));
  return app;
}

describe("notificaciones del asesor", () => {
  test("limita la consulta y las mutaciones al asesor autenticado", async () => {
    const service = createNotificationService();
    const app = buildApp(service);

    const response = await request(app)
      .get("/advisor/notifications?status=unread&type=chat&limit=25&beforeId=50")
      .expect(200);

    expect(response.body).toMatchObject({ unreadCount: 1, hasMore: false });
    expect(service.ensureAdvisorTaskReminders).toHaveBeenCalledWith(9);
    expect(service.listarPaginaPorUsuario).toHaveBeenCalledWith(9, expect.objectContaining({
      status: "unread",
      type: "chat",
      limit: "25",
      beforeId: "50",
    }));

    await request(app).put("/advisor/notifications/7/read").expect(200);
    await request(app).put("/advisor/notifications/7/archive").expect(200);
    await request(app).delete("/advisor/notifications/7").expect(200);

    expect(service.marcarLeida).toHaveBeenCalledWith("7", 9);
    expect(service.archivar).toHaveBeenCalledWith("7", 9);
    expect(service.eliminar).toHaveBeenCalledWith("7", 9);
  });

  test("guarda preferencias propias y normaliza la respuesta", async () => {
    const service = createNotificationService();
    const app = buildApp(service);

    const response = await request(app)
      .put("/advisor/notifications/preferences/current")
      .send({ soundEnabled: true, mutedTypes: ["info", "chat"] })
      .expect(200);

    expect(service.updateAdvisorPreferences).toHaveBeenCalledWith(9, {
      soundEnabled: true,
      mutedTypes: ["info", "chat"],
    });
    expect(response.body.preferences).toMatchObject({ advisor_id: 9, sound_enabled: true });
  });
});

describe("concentrador de eventos de notificación", () => {
  test("aísla eventos por usuario, deduplica y libera suscripciones", () => {
    const hub = new NotificationRealtimeHub();
    const advisorNine = jest.fn();
    const advisorTen = jest.fn();
    const unsubscribeNine = hub.subscribe(9, advisorNine);
    const unsubscribeTen = hub.subscribe(10, advisorTen);
    const notification = { id: 3, id_usuario: 9, titulo: "Documento nuevo", updated_at: "2026-10-12T10:00:00.000Z" };

    expect(hub.publish(notification)).toBe(true);
    expect(hub.publish({ ...notification, updated_at: new Date(notification.updated_at) })).toBe(false);
    expect(advisorNine).toHaveBeenCalledTimes(1);
    expect(advisorTen).not.toHaveBeenCalled();

    unsubscribeNine();
    unsubscribeTen();
    expect(hub.totalConnections()).toBe(0);
  });

  test("rechaza conexiones excesivas por asesor", () => {
    const hub = new NotificationRealtimeHub();
    const unsubscribe = Array.from({ length: MAX_CONNECTIONS_PER_USER }, () => hub.subscribe(9, () => {}));

    expect(() => hub.subscribe(9, () => {})).toThrow("Demasiadas conexiones");
    unsubscribe.forEach((close) => close());
  });
});
