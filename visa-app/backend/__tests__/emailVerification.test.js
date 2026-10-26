const express = require("express");
const request = require("supertest");
const createAuthRoutes = require("../routes/authRoutes");
const { PRIVACY_CONSENT } = require("../test-utils/privacyConsent");

function createPool(handler) {
  return { query: jest.fn(handler) };
}

function buildApp(pool, { sendEmail } = {}) {
  const app = express();
  app.use(express.json());
  const activityLogService = { logActivity: jest.fn(() => Promise.resolve()) };
  const schemaReady = Promise.resolve();
  app.use("/", createAuthRoutes(pool, {
    userSchemaReady: schemaReady,
    tramiteSchemaReady: schemaReady,
    passwordResetSchemaReady: schemaReady,
    emailVerificationSchemaReady: schemaReady,
    testUsersReady: schemaReady,
    requireSession: (req, res, next) => next(),
    activityLogService,
    sendEmail,
  }));
  return app;
}

describe("POST /register envía la verificación de email", () => {
  test("registra al usuario y envía un correo de verificación sin bloquear la respuesta", async () => {
    const pool = createPool(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("INSERT INTO usuario")) {
        return { rows: [{ id_usuario: 5, nombre: "Ana", correo: "ana@example.com", rol: "cliente", email_verificado: false }] };
      }
      return { rows: [] };
    });
    const sendEmail = jest.fn(() => Promise.resolve({ status: "dry_run" }));
    const app = buildApp(pool, { sendEmail });

    const response = await request(app).post("/register").send({ nombre: "Ana", correo: "ana@example.com", contrasena: "clave123", ...PRIVACY_CONSENT });

    expect(response.status).toBe(200);
    expect(response.body.data.emailVerificado).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [message] = sendEmail.mock.calls[0];
    expect(message.to).toBe("ana@example.com");
    expect(message.text).toContain("/verificar-email?token=");
  });

  test("el registro no falla aunque el envío del correo de verificación falle", async () => {
    const pool = createPool(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("INSERT INTO usuario")) {
        return { rows: [{ id_usuario: 5, nombre: "Ana", correo: "ana@example.com", rol: "cliente", email_verificado: false }] };
      }
      return { rows: [] };
    });
    const sendEmail = jest.fn(() => Promise.reject(new Error("smtp down")));
    const app = buildApp(pool, { sendEmail });

    const response = await request(app).post("/register").send({ nombre: "Ana", correo: "ana@example.com", contrasena: "clave123", ...PRIVACY_CONSENT });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Usuario guardado en BD");
  });
});

describe("POST /verificar-email", () => {
  test("devuelve 400 si falta el token", async () => {
    const pool = createPool(async () => ({ rows: [] }));
    const app = buildApp(pool);

    const response = await request(app).post("/verificar-email").send({});

    expect(response.status).toBe(400);
  });

  test("devuelve 400 cuando el token es inválido o expiró", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM email_verifications")) return { rows: [] };
      return { rows: [] };
    });
    const app = buildApp(pool);

    const response = await request(app).post("/verificar-email").send({ token: "invalido" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/inválido o expiró/);
  });

  test("marca el correo como verificado con un token válido", async () => {
    const pool = createPool(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM email_verifications")) {
        return { rows: [{ id: 1, id_usuario: 5, expires_at: new Date(Date.now() + 60000), used_at: null }] };
      }
      if (normalized.includes("UPDATE usuario SET email_verificado")) {
        return { rows: [{ id_usuario: 5, correo: "ana@example.com", rol: "cliente", email_verificado: true }] };
      }
      return { rows: [] };
    });
    const app = buildApp(pool);

    const response = await request(app).post("/verificar-email").send({ token: "valido" });

    expect(response.status).toBe(200);
    expect(response.body.usuario.emailVerificado).toBe(true);
  });
});

describe("POST /reenviar-verificacion", () => {
  test("responde con mensaje genérico y no revela si el correo existe", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM usuario WHERE correo")) return { rows: [] };
      return { rows: [] };
    });
    const app = buildApp(pool);

    const response = await request(app).post("/reenviar-verificacion").send({ correo: "noexiste@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/Si el correo está registrado/);
  });

  test("no reenvía el correo si ya está verificado", async () => {
    const pool = createPool(async (sql, values) => {
      if (String(sql).includes("FROM usuario WHERE correo")) {
        return { rows: [{ id_usuario: 5, correo: values[0], email_verificado: true }] };
      }
      return { rows: [] };
    });
    const sendEmail = jest.fn(() => Promise.resolve({ status: "dry_run" }));
    const app = buildApp(pool, { sendEmail });

    const response = await request(app).post("/reenviar-verificacion").send({ correo: "ana@example.com" });

    expect(response.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("reenvía un nuevo enlace si el correo existe y no está verificado", async () => {
    const pool = createPool(async (sql, values) => {
      if (String(sql).includes("FROM usuario WHERE correo")) {
        return { rows: [{ id_usuario: 5, nombre: "Ana", correo: values[0], rol: "cliente", email_verificado: false }] };
      }
      return { rows: [] };
    });
    const sendEmail = jest.fn(() => Promise.resolve({ status: "dry_run" }));
    const app = buildApp(pool, { sendEmail });

    const response = await request(app).post("/reenviar-verificacion").send({ correo: "ana@example.com" });

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("ana@example.com");
  });
});
