const express = require("express");
const request = require("supertest");
const createAdvisorRoutes = require("../routes/advisorRoutes");

function buildApp() {
  const pool = {
    query: jest.fn(async (sql, values = []) => {
      if (/CREATE (TABLE|INDEX)/.test(sql)) return { rows: [] };
      if (sql.includes("SELECT * FROM tramite WHERE id_tramite")) {
        return { rows: [{ id_tramite: 3, id_usuario: 5, id_asesor: values[1], estado: "En proceso", etapa_actual: "Pago consular", progreso: 51 }] };
      }
      if (sql.includes("UPDATE tramite SET estado")) {
        return { rows: [{ id_tramite: 3, id_usuario: 5, id_asesor: values[5], estado: values[0], etapa_actual: values[1], progreso: values[2] }] };
      }
      if (sql.includes("SELECT nombre, correo, perfil FROM usuario")) {
        return { rows: [{ nombre: "Ana López", correo: "ana@example.com", perfil: "Estudiante F1" }] };
      }
      if (sql.includes("FROM tramite t JOIN usuario u") && sql.includes("WHERE t.id_asesor = $1")) {
        return { rows: [{ id_tramite: 3, id_usuario: 5, id_asesor: values[0], estado: "En proceso", etapa_actual: "Formulario DS-160", progreso: 17, solicitante_nombre: "Ana López", solicitante_correo: "ana@example.com", solicitante_perfil: "Estudiante F1" }] };
      }
      return { rows: [] };
    }),
  };
  const requireAdvisor = (req, res, next) => {
    if (req.get("x-role") !== "asesor") return res.status(403).json({ error: "Acceso no autorizado" });
    req.auth = { id_usuario: 9, nombre: "Laura", correo: "laura@example.com", rol: "asesor" };
    return next();
  };
  const app = express();
  app.use(express.json());
  app.use("/advisor", createAdvisorRoutes(pool, {
    requireAdvisor,
    activityLogService: { ensureSchema: jest.fn(async () => undefined), logActivity: jest.fn(async () => null) },
  }));
  return { app, pool };
}

describe("autorización del panel de asesor", () => {
  test("rechaza usuarios que no son asesores", async () => {
    const { app } = buildApp();
    await request(app).get("/advisor/processes").set("x-role", "cliente").expect(403);
  });

  test("lista únicamente solicitudes usando el id del asesor autenticado", async () => {
    const { app, pool } = buildApp();
    const response = await request(app).get("/advisor/processes").set("x-role", "asesor").expect(200);

    expect(response.body.processes).toHaveLength(1);
    expect(response.body.processes[0].solicitante.nombre).toBe("Ana López");
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("WHERE t.id_asesor = $1"), [9]);
  });

  test("valida los datos obligatorios del perfil", async () => {
    const { app } = buildApp();
    const response = await request(app).put("/advisor/profile").set("x-role", "asesor").send({ nombre: "" }).expect(400);
    expect(response.body.error).toBe("El nombre es obligatorio");
  });

  test("permite conservar la etapa de pago consular", async () => {
    const { app } = buildApp();
    const response = await request(app)
      .put("/advisor/processes/3")
      .set("x-role", "asesor")
      .send({ estado: "En proceso", etapaActual: "Pago consular" })
      .expect(200);

    expect(response.body.process.etapaActual).toBe("Pago consular");
    expect(response.body.process.progreso).toBe(51);
  });
});
