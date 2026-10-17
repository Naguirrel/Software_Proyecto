const express = require("express");
const request = require("supertest");
const createPerfilService = require("../services/perfilService");
const createPerfilRoutes = require("../routes/perfilRoutes");

jest.mock("../services/perfilService");

const AUTHENTICATED_CLIENT = {
  id_usuario: 7,
  nombre: "Ana Cliente",
  correo: "ana@example.com",
  perfil: "turismo_negocios",
  rol: "cliente",
};

const AUTHENTICATED_ADMIN = {
  id_usuario: 99,
  nombre: "Admin",
  correo: "admin@example.com",
  rol: "admin",
};

function requireSession(req, res, next) {
  const token = req.get("authorization");
  if (token === "Bearer cliente") {
    req.auth = AUTHENTICATED_CLIENT;
    return next();
  }
  if (token === "Bearer admin") {
    req.auth = AUTHENTICATED_ADMIN;
    return next();
  }
  return res.status(401).json({ error: "Sesión inválida o expirada" });
}

function createServiceMock() {
  return {
    PERFIL_A_VISA: { turismo_negocios: "B1/B2 (Turismo / Negocios)" },
    calcularEtapa: jest.fn(() => 2),
    findUserById: jest.fn(async () => AUTHENTICATED_CLIENT),
    guardarPerfil: jest.fn(async (_userId, perfil) => ({ ...AUTHENTICATED_CLIENT, perfil })),
    getTramiteByUserId: jest.fn(async () => ({
      id_tramite: 70,
      id_usuario: AUTHENTICATED_CLIENT.id_usuario,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      progreso: 17,
    })),
    getOrCreateTramite: jest.fn(async () => ({
      id_tramite: 70,
      id_usuario: AUTHENTICATED_CLIENT.id_usuario,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      progreso: 17,
      siguiente_paso: "Completar el formulario DS-160",
      mensaje: "Continúa con tu formulario",
    })),
    avanzarTramiteDS160: jest.fn(async () => {}),
    updateUsuarioPerfil: jest.fn(async (_userId, fields) => ({ ...AUTHENTICATED_CLIENT, ...fields })),
  };
}

function buildApp(service) {
  createPerfilService.mockReturnValue(service);
  const app = express();
  app.use(express.json());
  app.use("/", createPerfilRoutes({}, {
    userSchemaReady: Promise.resolve(),
    tramiteSchemaReady: Promise.resolve(),
    activityLogService: { logActivity: jest.fn(async () => {}) },
    notificacionService: { crear: jest.fn(async () => {}) },
    requireSession,
  }));
  return app;
}

describe("seguridad de rutas de perfil y trámite", () => {
  let service;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createServiceMock();
    app = buildApp(service);
  });

  test.each([
    ["POST", "/guardar-perfil", { perfil: "turismo_negocios" }],
    ["POST", "/estado-tramite", {}],
    ["POST", "/usuario-perfil", {}],
    ["PUT", "/usuario-perfil", { nombre: "Ana" }],
    ["PUT", "/tramite", { estado: "En proceso" }],
  ])("%s %s responde 401 sin sesión", async (method, path, body) => {
    const response = await request(app)[method.toLowerCase()](path).send(body);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Sesión inválida o expirada" });
  });

  test.each([
    ["POST", "/guardar-perfil", { perfil: "turismo_negocios" }],
    ["POST", "/estado-tramite", {}],
    ["POST", "/usuario-perfil", {}],
    ["PUT", "/usuario-perfil", { nombre: "Admin" }],
    ["PUT", "/tramite", { estado: "Completado" }],
  ])("%s %s responde 403 a una sesión que no es cliente", async (method, path, body) => {
    const response = await request(app)[method.toLowerCase()](path)
      .set("Authorization", "Bearer admin")
      .send(body);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Acceso permitido únicamente a clientes" });
  });

  test("guardar perfil ignora el correo del body y usa el id de la sesión", async () => {
    const response = await request(app)
      .post("/guardar-perfil")
      .set("Authorization", "Bearer cliente")
      .send({ correo: "victima@example.com", perfil: "estudiante" });

    expect(response.status).toBe(200);
    expect(service.guardarPerfil).toHaveBeenCalledWith(AUTHENTICATED_CLIENT.id_usuario, "estudiante");
  });

  test("las consultas de trámite y perfil usan exclusivamente el id de la sesión", async () => {
    const estado = await request(app)
      .post("/estado-tramite")
      .set("Authorization", "Bearer cliente")
      .send({ correo: "victima@example.com" });
    const perfil = await request(app)
      .post("/usuario-perfil")
      .set("Authorization", "Bearer cliente")
      .send({ correo: "victima@example.com" });

    expect(estado.status).toBe(200);
    expect(perfil.status).toBe(200);
    expect(service.findUserById).toHaveBeenNthCalledWith(1, AUTHENTICATED_CLIENT.id_usuario);
    expect(service.findUserById).toHaveBeenNthCalledWith(2, AUTHENTICATED_CLIENT.id_usuario);
  });

  test("actualizar perfil ignora identidades enviadas en el body", async () => {
    const response = await request(app)
      .put("/usuario-perfil")
      .set("Authorization", "Bearer cliente")
      .send({
        correo: "victima@example.com",
        id_usuario: 88,
        nombre: "Ana Actualizada",
        ciudad: "Guatemala",
      });

    expect(response.status).toBe(200);
    expect(service.updateUsuarioPerfil).toHaveBeenCalledWith(AUTHENTICATED_CLIENT.id_usuario, {
      nombre: "Ana Actualizada",
      telefono: undefined,
      ciudad: "Guatemala",
      pais: undefined,
      notificacionesEmail: undefined,
      idioma: undefined,
    });
  });

  test("un cliente no puede adelantar manualmente su trámite", async () => {
    const response = await request(app)
      .put("/tramite")
      .set("Authorization", "Bearer cliente")
      .send({
        id_tramite: 999,
        id_usuario: 88,
        estado: "En proceso",
        progreso: 34,
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "La etapa del trámite se actualiza automáticamente al completar cada actividad",
    });
  });
});
