const express = require("express");
const request = require("supertest");
const createAdvisorRoutes = require("../routes/advisorRoutes");

function setup({ assigned = true, uploaded = false, notification = { id: 1 } } = {}) {
  const pool = { query: jest.fn(async (sql) => {
    if (sql.includes("FROM usuario u JOIN tramite t") && sql.includes("u.perfil")) return { rows: assigned ? [{ id_usuario: 42, perfil: "turismo_negocios", family_members: [] }] : [] };
    if (sql.includes("SELECT id FROM documentos WHERE")) return { rows: uploaded ? [{ id: 7 }] : [] };
    return { rows: [] };
  }) };
  const crearNotificacion = jest.fn(async () => notification);
  const app = express(); app.use(express.json());
  app.use("/advisor", createAdvisorRoutes(pool, { requireAdvisor: (req, _res, next) => { req.auth = { id_usuario: 9, rol: "asesor" }; next(); }, notificacionService: { crearNotificacion }, activityLogService: { ensureSchema: async () => {} } }));
  return { app, pool, crearNotificacion };
}

describe("recordatorios documentales del asesor", () => {
  test("registra un recordatorio para un requisito ausente y asignado", async () => {
    const { app, crearNotificacion } = setup();
    await request(app).post("/advisor/documents/reminders").send({ userId: 42, key: "passport" }).expect(201);
    expect(crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, tipo: "documento", actionUrl: "/documents", dedupeKey: expect.stringContaining("advisor-document-reminder:42:passport:") }));
  });
  test("rechaza clientes ajenos y documentos ya cargados", async () => {
    const other = setup({ assigned: false });
    await request(other.app).post("/advisor/documents/reminders").send({ userId: 42, key: "passport" }).expect(404);
    expect(other.crearNotificacion).not.toHaveBeenCalled();
    const loaded = setup({ uploaded: true });
    await request(loaded.app).post("/advisor/documents/reminders").send({ userId: 42, key: "passport" }).expect(409);
    expect(loaded.crearNotificacion).not.toHaveBeenCalled();
  });
  test("informa si el canal no crea otro recordatorio", async () => {
    const { app } = setup({ notification: null });
    await request(app).post("/advisor/documents/reminders").send({ userId: 42, key: "passport" }).expect(409);
  });
});
