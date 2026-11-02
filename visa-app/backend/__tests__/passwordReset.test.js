const express = require("express");
const request = require("supertest");
const createAuthRoutes = require("../routes/authRoutes");

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
    testUsersReady: schemaReady,
    requireSession: (req, res, next) => next(),
    activityLogService,
    sendEmail,
  }));
  return app;
}

describe("POST /forgot-password", () => {
  test("responde con mensaje genérico y no revela si el correo existe", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM usuario WHERE correo")) return { rows: [] };
      return { rows: [] };
    });
    const app = buildApp(pool);

    const response = await request(app).post("/forgot-password").send({ correo: "noexiste@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/Si el correo está registrado/);
  });

  test("genera un token y lo incluye en el correo enviado cuando el usuario existe", async () => {
    const pool = createPool(async (sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM usuario WHERE correo")) {
        return { rows: [{ id_usuario: 5, nombre: "Ana", correo: values[0], rol: "cliente" }] };
      }
      return { rows: [] };
    });
    const sendEmail = jest.fn(() => Promise.resolve({ status: "dry_run" }));
    const app = buildApp(pool, { sendEmail });

    const response = await request(app).post("/forgot-password").send({ correo: "ana@example.com" });

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [message] = sendEmail.mock.calls[0];
    expect(message.to).toBe("ana@example.com");
    expect(message.text).toContain("/restablecer-contrasena?token=");
  });

  test("devuelve 500 ante un error inesperado", async () => {
    const pool = createPool(async () => { throw new Error("db down"); });
    const app = buildApp(pool);

    const response = await request(app).post("/forgot-password").send({ correo: "ana@example.com" });

    expect(response.status).toBe(500);
  });

  test("avisa con 503 y un mensaje claro cuando el correo no se puede enviar", async () => {
    const pool = createPool(async (sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM usuario WHERE correo")) {
        return { rows: [{ id_usuario: 5, nombre: "Ana", correo: values[0], rol: "cliente" }] };
      }
      return { rows: [] };
    });
    const sendEmail = jest.fn(() => Promise.reject(new Error("connect ECONNREFUSED 208.91.112.55:587")));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const app = buildApp(pool, { sendEmail });

    const response = await request(app).post("/forgot-password").send({ correo: "ana@example.com" });
    consoleError.mockRestore();

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("No pudimos enviar el correo en este momento. Intenta de nuevo en unos minutos.");
    expect(JSON.stringify(response.body)).not.toContain("ECONNREFUSED");
  });
});

describe("POST /reset-password", () => {
  test("devuelve 400 si falta el token o la contraseña es muy corta", async () => {
    const pool = createPool(async () => ({ rows: [] }));
    const app = buildApp(pool);

    const withoutToken = await request(app).post("/reset-password").send({ nuevaContrasena: "1234" });
    expect(withoutToken.status).toBe(400);

    const shortPassword = await request(app).post("/reset-password").send({ token: "abc", nuevaContrasena: "12" });
    expect(shortPassword.status).toBe(400);
  });

  test("devuelve 400 cuando el token es inválido o expiró", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM password_resets")) return { rows: [] };
      return { rows: [] };
    });
    const app = buildApp(pool);

    const response = await request(app).post("/reset-password").send({ token: "invalido", nuevaContrasena: "nueva1234" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/inválido o expiró/);
  });

  test("actualiza la contraseña con un token válido", async () => {
    const pool = createPool(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM password_resets")) {
        return { rows: [{ id: 1, id_usuario: 5, expires_at: new Date(Date.now() + 60000), used_at: null }] };
      }
      if (normalized.startsWith("WITH consumed_token AS")) {
        return { rows: [{ id_usuario: 5 }] };
      }
      return { rows: [] };
    });
    const app = buildApp(pool);

    const response = await request(app).post("/reset-password").send({ token: "valido", nuevaContrasena: "nueva1234" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Contraseña actualizada correctamente");
  });
});
