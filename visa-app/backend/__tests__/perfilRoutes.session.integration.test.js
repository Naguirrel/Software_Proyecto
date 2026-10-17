const express = require("express");
const request = require("supertest");
const { createSessionMiddleware, issueSessionToken } = require("../auth");
const createPerfilRoutes = require("../routes/perfilRoutes");

const CLIENT = {
  id_usuario: 7,
  nombre: "Ana Cliente",
  correo: "ana@example.com",
  perfil: "turismo_negocios",
  rol: "cliente",
  activo: true,
  email_verificado: true,
  idioma: "es",
  telefono: null,
  ciudad: "Guatemala",
  pais: "Guatemala",
  notificaciones_email: true,
};

const ADMIN = {
  ...CLIENT,
  id_usuario: 99,
  correo: "admin@example.com",
  rol: "admin",
};

function buildApp() {
  const users = new Map([[CLIENT.id_usuario, CLIENT], [ADMIN.id_usuario, ADMIN]]);
  const pool = {
    query: jest.fn(async (sql, values) => {
      const statement = String(sql);
      if (statement.includes("FROM usuario WHERE id_usuario = $1")) {
        const user = users.get(Number(values[0]));
        return { rows: user ? [{ ...user }] : [] };
      }
      if (statement.includes("FROM tramite WHERE id_usuario = $1")) {
        return {
          rows: [{
            id_tramite: 70,
            id_usuario: Number(values[0]),
            estado: "En proceso",
            etapa_actual: "Formulario DS-160",
            progreso: 17,
          }],
        };
      }
      throw new Error(`Consulta inesperada: ${statement}`);
    }),
  };

  const app = express();
  app.use(express.json());
  app.use("/", createPerfilRoutes(pool, {
    userSchemaReady: Promise.resolve(),
    tramiteSchemaReady: Promise.resolve(),
    activityLogService: { logActivity: jest.fn(async () => {}) },
    notificacionService: { crear: jest.fn(async () => {}) },
    requireSession: createSessionMiddleware(pool),
  }));
  return { app, pool };
}

describe("integración de sesión en rutas de perfil", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeAll(() => {
    process.env.SESSION_SECRET = "perfil-routes-integration-secret";
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  test("el middleware real rechaza ausencia de token y un rol no cliente", async () => {
    const { app } = buildApp();

    await request(app).post("/usuario-perfil").send({}).expect(401);
    await request(app)
      .post("/usuario-perfil")
      .set("Authorization", `Bearer ${issueSessionToken(ADMIN)}`)
      .send({})
      .expect(403);
  });

  test("la identidad firmada prevalece sobre cualquier identidad enviada en el body", async () => {
    const { app, pool } = buildApp();

    const response = await request(app)
      .post("/usuario-perfil")
      .set("Authorization", `Bearer ${issueSessionToken(CLIENT)}`)
      .send({ id_usuario: ADMIN.id_usuario, correo: ADMIN.correo })
      .expect(200);

    expect(response.body.usuario).toMatchObject({ id: CLIENT.id_usuario, correo: CLIENT.correo });
    const userLookups = pool.query.mock.calls.filter(([sql]) =>
      String(sql).includes("FROM usuario WHERE id_usuario = $1")
    );
    expect(userLookups).toHaveLength(2);
    expect(userLookups.every(([, values]) => values[0] === CLIENT.id_usuario)).toBe(true);
  });
});
