const fs = require("fs");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcrypt");
const createAuthService = require("../services/authService");
const { createAuthIntegrationApp } = require("../test-utils/authIntegrationHarness");
const {
  PRIVACY_NOTICE_VERSION,
  PRIVACY_OUTDATED_MESSAGE,
  PRIVACY_REQUIRED_MESSAGE,
  validatePrivacyConsent,
} = require("../config/privacyNotice");

// SP10-12: el registro exige aceptar el aviso de privacidad y guarda la fecha y la versión aceptadas.
// Las definiciones de RNF-16, 17 y 18 no estaban en el repositorio: se implementa lo que describe la tarea.

const USER = { nombre: "Ana Pérez", correo: "ana@example.com", contrasena: "clave-segura-123" };
const CONSENT = { acepta_privacidad: true, version_privacidad: PRIVACY_NOTICE_VERSION };

const root = path.join(__dirname, "..", "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

describe("validatePrivacyConsent", () => {
  test("acepta la aceptación explícita de la versión vigente", () => {
    expect(validatePrivacyConsent(CONSENT)).toBeNull();
  });

  test.each([
    ["sin los campos", {}],
    ["sin cuerpo", undefined],
    ["aceptación en false", { acepta_privacidad: false, version_privacidad: PRIVACY_NOTICE_VERSION }],
    ["aceptación como texto", { acepta_privacidad: "true", version_privacidad: PRIVACY_NOTICE_VERSION }],
    ["aceptación como número", { acepta_privacidad: 1, version_privacidad: PRIVACY_NOTICE_VERSION }],
    ["aceptación nula", { acepta_privacidad: null, version_privacidad: PRIVACY_NOTICE_VERSION }],
  ])("exige la aceptación: %s", (_label, body) => {
    expect(validatePrivacyConsent(body)).toBe(PRIVACY_REQUIRED_MESSAGE);
  });

  test.each([
    ["sin versión", { acepta_privacidad: true }],
    ["versión anterior", { acepta_privacidad: true, version_privacidad: "0.9" }],
    ["versión inventada", { acepta_privacidad: true, version_privacidad: "99" }],
    ["versión numérica", { acepta_privacidad: true, version_privacidad: 1 }],
  ])("exige la versión vigente: %s", (_label, body) => {
    expect(validatePrivacyConsent(body)).toBe(PRIVACY_OUTDATED_MESSAGE);
  });
});

describe("POST /register con el aviso de privacidad", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    ["sin aceptar", {}, PRIVACY_REQUIRED_MESSAGE],
    ["con la aceptación en false", { acepta_privacidad: false, version_privacidad: PRIVACY_NOTICE_VERSION }, PRIVACY_REQUIRED_MESSAGE],
    ["con una versión distinta de la vigente", { acepta_privacidad: true, version_privacidad: "0.1" }, PRIVACY_OUTDATED_MESSAGE],
    ["sin indicar la versión", { acepta_privacidad: true }, PRIVACY_OUTDATED_MESSAGE],
  ])("rechaza el registro %s con 400 y no crea el usuario", async (_label, consent, message) => {
    const { app, state } = createAuthIntegrationApp();

    const response = await request(app).post("/register").send({ ...USER, ...consent });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(message);
    expect(response.body.token).toBeUndefined();
    expect(state.users).toHaveLength(0);
  });

  test("guarda la versión aceptada y la fecha del servidor al registrarse", async () => {
    const { app, state } = createAuthIntegrationApp();
    const before = Date.now();

    const response = await request(app).post("/register").send({ ...USER, ...CONSENT });

    expect(response.status).toBe(200);
    expect(state.users).toHaveLength(1);
    expect(state.users[0].privacidad_version).toBe(PRIVACY_NOTICE_VERSION);
    expect(state.users[0].privacidad_aceptada_en).toBeInstanceOf(Date);
    expect(state.users[0].privacidad_aceptada_en.getTime()).toBeGreaterThanOrEqual(before);
  });

  test("ignora una fecha enviada por el cliente: la fecha la pone el servidor", async () => {
    const { app, state } = createAuthIntegrationApp();

    await request(app).post("/register").send({ ...USER, ...CONSENT, privacidad_aceptada_en: "2001-01-01T00:00:00Z" });

    expect(state.users[0].privacidad_aceptada_en.getUTCFullYear()).toBeGreaterThan(2020);
  });

  test("el consentimiento no se devuelve en la respuesta ni afecta al login", async () => {
    const { app, state } = createAuthIntegrationApp();
    const registered = await request(app).post("/register").send({ ...USER, ...CONSENT });

    const login = await request(app).post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });

    expect(registered.status).toBe(200);
    expect(login.status).toBe(200);
    expect(JSON.stringify(registered.body)).not.toContain("privacidad_aceptada_en");
    expect(state.users).toHaveLength(1);
  });

  test("una cuenta anterior sin consentimiento registrado sigue pudiendo iniciar sesión", async () => {
    const { app, state } = createAuthIntegrationApp();
    await request(app).post("/register").send({ ...USER, ...CONSENT });
    state.users[0].privacidad_version = null;
    state.users[0].privacidad_aceptada_en = null;

    const login = await request(app).post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });

    expect(login.status).toBe(200);
  });

  test("un registro con contraseña débil sigue rechazándose antes de guardar nada", async () => {
    const { app, state } = createAuthIntegrationApp();

    const response = await request(app).post("/register").send({ ...USER, contrasena: "abc", ...CONSENT });

    expect(response.status).toBe(400);
    expect(state.users).toHaveLength(0);
  });
});

describe("authService.createUser guarda el consentimiento", () => {
  function createService() {
    const pool = { query: jest.fn(async () => ({ rows: [{ id_usuario: 1 }] })) };
    const ready = Promise.resolve();
    const service = createAuthService(pool, {
      userSchemaReady: ready,
      tramiteSchemaReady: ready,
      passwordResetSchemaReady: ready,
      emailVerificationSchemaReady: ready,
      loginSecuritySchemaReady: ready,
    });
    return { service, pool };
  }

  test("inserta la versión y usa la hora del servidor (CURRENT_TIMESTAMP)", async () => {
    const { service, pool } = createService();

    await service.createUser({ nombre: "Ana", correo: "ana@example.com", contrasena: "clave-segura-123", privacidadVersion: "1.0" });

    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).toContain("privacidad_aceptada_en, privacidad_version");
    expect(sql).toContain("CURRENT_TIMESTAMP");
    expect(values[3]).toBe("1.0");
    expect(await bcrypt.compare("clave-segura-123", values[2])).toBe(true);
  });

  test("sin versión no registra fecha de aceptación", async () => {
    const { service, pool } = createService();

    await service.createUser({ nombre: "Ana", correo: "ana@example.com", contrasena: "clave-segura-123" });

    expect(pool.query.mock.calls[0][1][3]).toBeNull();
    expect(pool.query.mock.calls[0][0]).toContain("CASE WHEN $4::text IS NULL THEN NULL");
  });
});

describe("coherencia del aviso de privacidad", () => {
  test("la versión del backend coincide con la del frontend", () => {
    const frontend = read("frontend", "src", "config", "privacyNotice.js");
    const match = frontend.match(/PRIVACY_NOTICE_VERSION\s*=\s*"([^"]+)"/);

    expect(match).not.toBeNull();
    expect(match[1]).toBe(PRIVACY_NOTICE_VERSION);
  });

  test("las columnas existen en init.sql, la migración 008 y el esquema de la aplicación", () => {
    for (const source of [read("init.sql"), read("backend", "migrations", "008_privacy_consent.sql"), read("backend", "app.js")]) {
      expect(source).toContain("privacidad_aceptada_en");
      expect(source).toContain("privacidad_version");
      expect(source).toMatch(/privacidad_aceptada_en\s+TIMESTAMPTZ/);
    }
  });

  test("la migración es idempotente y va en una transacción", () => {
    const migration = read("backend", "migrations", "008_privacy_consent.sql");

    expect(migration.trim().startsWith("BEGIN;")).toBe(true);
    expect(migration.trim().endsWith("COMMIT;")).toBe(true);
    expect(migration.match(/ADD COLUMN IF NOT EXISTS/g)).toHaveLength(2);
  });

  test("OpenAPI documenta los dos campos como obligatorios en el registro", () => {
    const openapi = read("backend", "docs", "openapi.js");

    expect(openapi).toContain('required: ["nombre", "correo", "contrasena", "acepta_privacidad", "version_privacidad"]');
  });
});
