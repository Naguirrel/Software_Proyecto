const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const {
  createRoleMiddleware,
  createSessionMiddleware,
  issueSessionToken,
  verifySessionToken,
} = require("../auth");

const DEVELOPMENT_SECRET = "visaguide-development-session-secret";
const ACTIVE_USER = {
  id_usuario: 7,
  nombre: "Usuario Activo",
  correo: "sesion@test.dev",
  perfil: "turismo_negocios",
  rol: "cliente",
  activo: true,
  email_verificado: true,
};

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function signPayload(payload) {
  return crypto.createHmac("sha256", DEVELOPMENT_SECRET).update(payload).digest("base64url");
}

function createApp({ databaseUser = ACTIVE_USER, allowedRoles } = {}) {
  const pool = {
    query: jest.fn(async () => ({ rows: databaseUser ? [databaseUser] : [] })),
  };
  const app = express();
  const middleware = allowedRoles
    ? createRoleMiddleware(pool, allowedRoles)
    : createSessionMiddleware(pool);

  app.get("/protected", middleware, (req, res) => res.json({ user: req.auth }));
  return { app, pool };
}

describe("seguridad de tokens y sesiones", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSessionSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
  });

  test("emite un token firmado con identidad, rol y expiración de ocho horas", () => {
    const issuedAt = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(issuedAt);

    const token = issueSessionToken(ACTIVE_USER);

    expect(verifySessionToken(token)).toEqual({
      sub: ACTIVE_USER.id_usuario,
      correo: ACTIVE_USER.correo,
      rol: ACTIVE_USER.rol,
      exp: issuedAt + (8 * 60 * 60 * 1000),
    });
  });

  test.each([
    ["vacío", ""],
    ["sin firma", "payload"],
    ["con segmento adicional", `${encode("payload")}.${encode("signature")}.extra`],
    ["con payload inválido", `${encode("no-json")}.${encode("signature")}`],
  ])("rechaza un token %s", (_caseName, token) => {
    expect(verifySessionToken(token)).toBeNull();
  });

  test("rechaza la alteración del payload o de la firma", () => {
    const token = issueSessionToken(ACTIVE_USER);
    const [payload, signature] = token.split(".");
    const alteredPayload = encode(JSON.stringify({
      ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      rol: "admin",
    }));

    expect(verifySessionToken(`${alteredPayload}.${signature}`)).toBeNull();
    expect(verifySessionToken(`${payload}.${signature.slice(0, -1)}x`)).toBeNull();
    expect(verifySessionToken(`${payload}.${signature}.extra`)).toBeNull();
  });

  test("rechaza un token expirado antes de consultar la base de datos", async () => {
    const issuedAt = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(issuedAt);
    const token = issueSessionToken(ACTIVE_USER);
    Date.now.mockReturnValue(issuedAt + (8 * 60 * 60 * 1000) + 1);
    const { app, pool } = createApp();

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    ["sin header", null],
    ["esquema Basic", "Basic credentials"],
    ["Bearer sin token", "Bearer"],
    ["token con espacios", "Bearer token otro"],
    ["headers concatenados", "Bearer token, Bearer otro"],
  ])("rechaza autorización malformada: %s", async (_caseName, authorization) => {
    const { app, pool } = createApp();
    const call = request(app).get("/protected");
    if (authorization) call.set("Authorization", authorization);

    const response = await call;

    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("acepta el esquema Bearer sin distinguir mayúsculas y carga al usuario activo", async () => {
    const { app, pool } = createApp();

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `bearer ${issueSessionToken(ACTIVE_USER)}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject(ACTIVE_USER);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM usuario WHERE id_usuario = $1"),
      [ACTIVE_USER.id_usuario]
    );
  });

  test.each([
    ["el usuario fue eliminado", null],
    ["el usuario fue desactivado", { ...ACTIVE_USER, activo: false }],
  ])("invalida la sesión cuando %s", async (_caseName, databaseUser) => {
    const { app } = createApp({ databaseUser });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${issueSessionToken(ACTIVE_USER)}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Sesión inválida o expirada" });
  });

  test("autoriza roles con el estado actual de la base de datos y no con un claim antiguo", async () => {
    const promotedUser = { ...ACTIVE_USER, rol: "admin" };
    const { app } = createApp({ databaseUser: promotedUser, allowedRoles: ["admin"] });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${issueSessionToken(ACTIVE_USER)}`);

    expect(response.status).toBe(200);
    expect(response.body.user.rol).toBe("admin");
  });

  test("exige SESSION_SECRET en producción", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    expect(() => issueSessionToken(ACTIVE_USER)).toThrow("SESSION_SECRET is required in production");
    expect(verifySessionToken("payload.signature")).toBeNull();
  });
});
