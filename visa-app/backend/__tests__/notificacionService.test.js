const createNotificacionService = require("../services/notificacionService");

describe("notificacionService automatic notifications toggle", () => {
  function createService(query) {
    const pool = { query: jest.fn(query) };
    return { service: createNotificacionService(pool), pool };
  }

  test("skips creating a notification when automatic notifications are disabled", async () => {
    const { service, pool } = createService(async (sql) => {
      if (sql.includes("SELECT notificaciones_automaticas")) return { rows: [{ notificaciones_automaticas: false }] };
      return { rows: [] };
    });

    const result = await service.crearNotificacion({ userId: 4, titulo: "Hola", mensaje: "Mensaje" });

    expect(result).toBeNull();
    expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO notificaciones"), expect.anything());
  });

  test("creates a notification when automatic notifications are enabled", async () => {
    const { service, pool } = createService(async (sql) => {
      if (sql.includes("SELECT notificaciones_automaticas")) return { rows: [{ notificaciones_automaticas: true }] };
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 1, id_usuario: 4, titulo: "Hola", mensaje: "Mensaje", tipo: "info", leido: false }] };
      return { rows: [] };
    });

    const result = await service.crearNotificacion({ userId: 4, titulo: "Hola", mensaje: "Mensaje" });

    expect(result).toMatchObject({ id: 1, titulo: "Hola" });
  });

  test("defaults to enabled when the setting has never been saved", async () => {
    const { service } = createService(async (sql) => {
      if (sql.includes("SELECT notificaciones_automaticas")) return { rows: [] };
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 2, id_usuario: 4, titulo: "Hola", mensaje: "Mensaje", tipo: "info", leido: false }] };
      return { rows: [] };
    });

    const result = await service.crearNotificacion({ userId: 4, titulo: "Hola", mensaje: "Mensaje" });

    expect(result).toMatchObject({ id: 2 });
  });

  test("defaults to enabled when the settings table is not reachable", async () => {
    const { service } = createService(async (sql) => {
      if (sql.includes("SELECT notificaciones_automaticas")) return Promise.reject(new Error("relation admin_settings does not exist"));
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 3, id_usuario: 4, titulo: "Hola", mensaje: "Mensaje", tipo: "info", leido: false }] };
      return { rows: [] };
    });

    const result = await service.crearNotificacion({ userId: 4, titulo: "Hola", mensaje: "Mensaje" });

    expect(result).toMatchObject({ id: 3 });
  });

  test("does not re-emit an identical enriched notification when its dedupe key already exists", async () => {
    const { service, pool } = createService(async (sql) => {
      if (sql.includes("SELECT notificaciones_automaticas")) return { rows: [{ notificaciones_automaticas: true }] };
      if (sql.includes("INSERT INTO notificaciones AS existing")) return { rows: [] };
      return { rows: [] };
    });

    const result = await service.crearNotificacion({
      userId: 9,
      titulo: "Documento listo",
      mensaje: "Ana cargó su pasaporte.",
      tipo: "documento",
      actionUrl: "/advisor/documentos?document=31",
      entityType: "documento",
      entityId: 31,
      dedupeKey: "advisor:9:document:31:uploaded",
    });

    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE existing.titulo IS DISTINCT FROM EXCLUDED.titulo"),
      expect.arrayContaining([9, "Documento listo", "Ana cargó su pasaporte."])
    );
  });

  test("rejects external action URLs", async () => {
    const { service } = createService(async () => ({ rows: [] }));

    await expect(service.crearNotificacion({
      userId: 9,
      titulo: "Enlace inválido",
      mensaje: "No debe salir del sitio.",
      actionUrl: "https://example.com/phishing",
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test("uses one durable key when a task reminder changes from due soon to overdue", async () => {
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const { service, pool } = createService(async (sql, values) => {
      if (sql.includes("FROM advisor_tasks task")) {
        return { rows: [{ id: 8, title: "Revisar DS-160", due_at: dueAt, priority: "high" }] };
      }
      if (sql.includes("SELECT notificaciones_automaticas")) return { rows: [{ notificaciones_automaticas: true }] };
      if (sql.includes("INSERT INTO notificaciones AS existing")) {
        return { rows: [{ id: 44, id_usuario: values[0], titulo: values[1], mensaje: values[2], tipo: values[3] }] };
      }
      return { rows: [] };
    });

    const reminders = await service.ensureAdvisorTaskReminders(9);

    expect(reminders).toEqual([expect.objectContaining({ id: 44, titulo: "Tarea vencida" })]);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones AS existing"),
      expect.arrayContaining(["advisor:9:task:8:deadline"])
    );
  });
});
