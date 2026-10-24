const crypto = require("crypto");
const bcrypt = require("bcrypt");
const createAuthService = require("../services/authService");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPool(handler) {
  return { query: jest.fn(handler) };
}

const schemaReady = Promise.resolve();

describe("authService - recuperación de contraseña", () => {
  test("createPasswordResetToken devuelve null si el correo no existe", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM usuario WHERE correo")) return { rows: [] };
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      passwordResetSchemaReady: schemaReady,
    });

    const result = await authService.createPasswordResetToken("noexiste@example.com");

    expect(result).toBeNull();
  });

  test("createPasswordResetToken genera un token y guarda su hash con expiración", async () => {
    let insertedValues;
    const pool = createPool(async (sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM usuario WHERE correo")) {
        return { rows: [{ id_usuario: 5, nombre: "Ana", correo: values[0], rol: "cliente" }] };
      }
      if (normalized.includes("INSERT INTO password_resets")) {
        insertedValues = values;
        return { rows: [] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      passwordResetSchemaReady: schemaReady,
    });

    const result = await authService.createPasswordResetToken("ana@example.com");

    expect(result.usuario.id_usuario).toBe(5);
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(insertedValues[0]).toBe(5);
    expect(insertedValues[1]).toBe(hashToken(result.token));
    expect(insertedValues[2]).toBeInstanceOf(Date);
    expect(insertedValues[2].getTime()).toBeGreaterThan(Date.now());
  });

  test("resetPassword devuelve false con token inexistente", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM password_resets")) return { rows: [] };
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      passwordResetSchemaReady: schemaReady,
    });

    const success = await authService.resetPassword("token-invalido", "nueva1234");

    expect(success).toBe(false);
  });

  test("resetPassword devuelve false con token expirado", async () => {
    const token = "a".repeat(64);
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM password_resets")) {
        return { rows: [{ id: 1, id_usuario: 5, expires_at: new Date(Date.now() - 1000), used_at: null }] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      passwordResetSchemaReady: schemaReady,
    });

    const success = await authService.resetPassword(token, "nueva1234");

    expect(success).toBe(false);
  });

  test("resetPassword devuelve false con token ya utilizado", async () => {
    const token = "b".repeat(64);
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM password_resets")) {
        return { rows: [{ id: 1, id_usuario: 5, expires_at: new Date(Date.now() + 1000 * 60), used_at: new Date() }] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      passwordResetSchemaReady: schemaReady,
    });

    const success = await authService.resetPassword(token, "nueva1234");

    expect(success).toBe(false);
  });

  test("resetPassword actualiza la contraseña con bcrypt y marca el token como usado", async () => {
    const token = "c".repeat(64);
    const queries = [];
    const pool = createPool(async (sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      queries.push({ normalized, values });
      if (normalized.includes("FROM password_resets")) {
        return { rows: [{ id: 9, id_usuario: 5, expires_at: new Date(Date.now() + 1000 * 60), used_at: null }] };
      }
      if (normalized.startsWith("WITH consumed_token AS")) {
        return { rows: [{ id_usuario: 5 }] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      passwordResetSchemaReady: schemaReady,
    });

    const success = await authService.resetPassword(token, "nueva1234");

    expect(success).toBe(true);

    const atomicUpdate = queries.find((q) => q.normalized.startsWith("WITH consumed_token AS"));
    expect(atomicUpdate.values[0]).toBe(hashToken(token));
    expect(atomicUpdate.values[1]).toBeInstanceOf(Date);
    expect(await bcrypt.compare("nueva1234", atomicUpdate.values[2])).toBe(true);
    expect(atomicUpdate.normalized).toContain("UPDATE password_resets");
    expect(atomicUpdate.normalized).toContain("AND used_at IS NULL");
    expect(atomicUpdate.normalized).toContain("AND expires_at > $2");
    expect(atomicUpdate.normalized).toContain("session_version = COALESCE(target.session_version, 0) + 1");
    expect(atomicUpdate.normalized).toContain("bloqueado_hasta = NULL");
  });

  test("resetPassword devuelve false si otra solicitud consumió el token durante el hash", async () => {
    const token = "d".repeat(64);
    const pool = createPool(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM password_resets")) {
        return { rows: [{ id: 10, id_usuario: 5, expires_at: new Date(Date.now() + 60_000), used_at: null }] };
      }
      if (normalized.startsWith("WITH consumed_token AS")) return { rows: [] };
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      passwordResetSchemaReady: schemaReady,
    });

    await expect(authService.resetPassword(token, "nueva1234")).resolves.toBe(false);
  });
});

describe("authService - verificación de email", () => {
  test("createEmailVerificationToken genera un token y guarda su hash con expiración de 24h", async () => {
    let insertedValues;
    const pool = createPool(async (sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("INSERT INTO email_verifications")) {
        insertedValues = values;
        return { rows: [] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      emailVerificationSchemaReady: schemaReady,
    });

    const token = await authService.createEmailVerificationToken({ id_usuario: 7 });

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(insertedValues[0]).toBe(7);
    expect(insertedValues[1]).toBe(hashToken(token));
    expect(insertedValues[2]).toBeInstanceOf(Date);
    const hoursUntilExpiry = (insertedValues[2].getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hoursUntilExpiry).toBeGreaterThan(23);
    expect(hoursUntilExpiry).toBeLessThanOrEqual(24);
  });

  test("requestEmailVerification devuelve null si el correo no existe", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM usuario WHERE correo")) return { rows: [] };
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      emailVerificationSchemaReady: schemaReady,
    });

    const result = await authService.requestEmailVerification("noexiste@example.com");

    expect(result).toBeNull();
  });

  test("requestEmailVerification devuelve null si el correo ya está verificado", async () => {
    const pool = createPool(async (sql, values) => {
      if (String(sql).includes("FROM usuario WHERE correo")) {
        return { rows: [{ id_usuario: 5, correo: values[0], email_verificado: true }] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      emailVerificationSchemaReady: schemaReady,
    });

    const result = await authService.requestEmailVerification("ana@example.com");

    expect(result).toBeNull();
  });

  test("requestEmailVerification genera un token cuando el correo no está verificado", async () => {
    const pool = createPool(async (sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM usuario WHERE correo")) {
        return { rows: [{ id_usuario: 5, correo: values[0], email_verificado: false }] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      emailVerificationSchemaReady: schemaReady,
    });

    const result = await authService.requestEmailVerification("ana@example.com");

    expect(result.usuario.id_usuario).toBe(5);
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("verifyEmail devuelve null con token inexistente", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM email_verifications")) return { rows: [] };
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      emailVerificationSchemaReady: schemaReady,
    });

    const result = await authService.verifyEmail("token-invalido");

    expect(result).toBeNull();
  });

  test("verifyEmail devuelve null con token expirado o ya utilizado", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM email_verifications")) {
        return { rows: [{ id: 1, id_usuario: 5, expires_at: new Date(Date.now() - 1000), used_at: null }] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      emailVerificationSchemaReady: schemaReady,
    });

    const result = await authService.verifyEmail("a".repeat(64));

    expect(result).toBeNull();
  });

  test("verifyEmail marca el usuario como verificado y el token como usado", async () => {
    const queries = [];
    const pool = createPool(async (sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      queries.push({ normalized, values });
      if (normalized.includes("FROM email_verifications")) {
        return { rows: [{ id: 9, id_usuario: 5, expires_at: new Date(Date.now() + 60000), used_at: null }] };
      }
      if (normalized.includes("UPDATE usuario SET email_verificado")) {
        return { rows: [{ id_usuario: 5, correo: "ana@example.com", email_verificado: true, rol: "cliente" }] };
      }
      return { rows: [] };
    });
    const authService = createAuthService(pool, {
      userSchemaReady: schemaReady,
      tramiteSchemaReady: schemaReady,
      emailVerificationSchemaReady: schemaReady,
    });

    const result = await authService.verifyEmail("b".repeat(64));

    expect(result).toMatchObject({ id_usuario: 5, email_verificado: true });

    const markUsed = queries.find((q) => q.normalized.includes("UPDATE email_verifications SET used_at"));
    expect(markUsed.values[0]).toBe(9);
  });
});
