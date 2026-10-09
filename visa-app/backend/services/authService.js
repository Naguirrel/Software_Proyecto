const bcrypt = require("bcrypt");
const crypto = require("crypto");

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
// RNF-13: bloquear la cuenta 15 minutos tras 5 intentos fallidos seguidos.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
const UNLOCK_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createAuthService(pool, { userSchemaReady, tramiteSchemaReady, passwordResetSchemaReady, emailVerificationSchemaReady, loginSecuritySchemaReady }) {

  async function findUserByEmail(correo) {
    await userSchemaReady;
    const result = await pool.query(
      `SELECT id_usuario, nombre, correo, perfil, COALESCE(rol, 'cliente') AS rol, activo, contrasena, email_verificado, idioma,
              bloqueado_hasta, intentos_reset_en
       FROM usuario WHERE correo = $1`,
      [correo]
    );
    return result.rows[0] || null;
  }

  async function createUser({ nombre, correo, contrasena }) {
    await userSchemaReady;
    await tramiteSchemaReady;
    
    const contrasenaHash = await bcrypt.hash(contrasena, SALT_ROUNDS);
    try {
      const result = await pool.query(
        "INSERT INTO usuario(nombre, correo, contrasena, rol, email_verificado) VALUES($1,$2,$3,'cliente',FALSE) RETURNING *",
        [nombre, correo, contrasenaHash]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === "23505" && error.constraint === "usuario_correo_key") {
        const conflict = new Error("El correo ya está registrado");
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }

  async function createInitialTramite(userId) {
    await pool.query(
      `INSERT INTO tramite (id_usuario, estado, etapa_actual, progreso, siguiente_paso, mensaje)
       VALUES ($1, 'En proceso', 'Configuración de perfil', 0, 'Seleccionar perfil de visa', 'Configura tu perfil para comenzar')
       ON CONFLICT DO NOTHING`,
      [userId]
    );
  }

  async function verifyPassword(contrasena, usuario) {
    if (!usuario || !contrasena) return false;
    
    const storedIsHashed = /^\$2[aby]\$/.test(usuario.contrasena || "");
    
    if (storedIsHashed) {
      return bcrypt.compare(contrasena, usuario.contrasena);
    }
    
    // Contraseña legacy en texto plano - migrar a bcrypt
    if (usuario.contrasena === contrasena) {
      const contrasenaHash = await bcrypt.hash(contrasena, SALT_ROUNDS);
      await pool.query(
        "UPDATE usuario SET contrasena = $1 WHERE id_usuario = $2",
        [contrasenaHash, usuario.id_usuario]
      );
      return true;
    }
    
    return false;
  }

  async function createPasswordResetToken(correo) {
    await passwordResetSchemaReady;
    const usuario = await findUserByEmail(correo);
    if (!usuario) return null;

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await pool.query(
      "INSERT INTO password_resets (id_usuario, token_hash, expires_at) VALUES ($1, $2, $3)",
      [usuario.id_usuario, tokenHash, expiresAt]
    );

    return { token, usuario };
  }

  async function resetPassword(token, nuevaContrasena) {
    await passwordResetSchemaReady;
    const tokenHash = hashToken(token || "");

    const result = await pool.query(
      "SELECT id, id_usuario, expires_at, used_at FROM password_resets WHERE token_hash = $1",
      [tokenHash]
    );
    const record = result.rows[0];

    if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
      return false;
    }

    const contrasenaHash = await bcrypt.hash(nuevaContrasena, SALT_ROUNDS);
    await pool.query("UPDATE usuario SET contrasena = $1 WHERE id_usuario = $2", [contrasenaHash, record.id_usuario]);
    await pool.query("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1", [record.id]);
    // Quien restablece la contraseña demuestra que controla el correo: se levanta el bloqueo.
    await unlockAccount(record.id_usuario);

    return true;
  }

  async function createEmailVerificationToken(usuario) {
    await emailVerificationSchemaReady;

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await pool.query(
      "INSERT INTO email_verifications (id_usuario, token_hash, expires_at) VALUES ($1, $2, $3)",
      [usuario.id_usuario, tokenHash, expiresAt]
    );

    return token;
  }

  async function requestEmailVerification(correo) {
    const usuario = await findUserByEmail(correo);
    if (!usuario || usuario.email_verificado) return null;

    const token = await createEmailVerificationToken(usuario);
    return { token, usuario };
  }

  async function verifyEmail(token) {
    await emailVerificationSchemaReady;
    const tokenHash = hashToken(token || "");

    const result = await pool.query(
      "SELECT id, id_usuario, expires_at, used_at FROM email_verifications WHERE token_hash = $1",
      [tokenHash]
    );
    const record = result.rows[0];

    if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
      return null;
    }

    const updated = await pool.query(
      "UPDATE usuario SET email_verificado = TRUE WHERE id_usuario = $1 RETURNING *",
      [record.id_usuario]
    );
    await pool.query("UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = $1", [record.id]);

    return updated.rows[0] || null;
  }

  // Devuelve la fecha de fin del bloqueo si la cuenta sigue bloqueada.
  function getActiveLock(usuario, now = new Date()) {
    if (!usuario?.bloqueado_hasta) return null;
    const lockedUntil = new Date(usuario.bloqueado_hasta);
    return lockedUntil > now ? lockedUntil : null;
  }

  // Registra un intento fallido y bloquea la cuenta al llegar al límite.
  // Solo cuentan los intentos posteriores al último reinicio (login exitoso,
  // bloqueo o desbloqueo) y dentro de la ventana del bloqueo.
  async function registerFailedLogin({ usuario, correo, ip }) {
    await loginSecuritySchemaReady;
    const now = new Date();
    await pool.query(
      "INSERT INTO login_attempts (id_usuario, correo, ip, created_at) VALUES ($1, $2, $3, $4)",
      [usuario?.id_usuario || null, String(correo || "").slice(0, 200), ip ? String(ip).slice(0, 64) : null, now]
    );

    if (!usuario) return { locked: false };

    const windowStart = new Date(now.getTime() - ACCOUNT_LOCK_MS);
    const lastReset = usuario.intentos_reset_en ? new Date(usuario.intentos_reset_en) : null;
    const since = lastReset && lastReset > windowStart ? lastReset : windowStart;

    const result = await pool.query(
      "SELECT COUNT(*)::int AS total FROM login_attempts WHERE id_usuario = $1 AND created_at > $2",
      [usuario.id_usuario, since]
    );
    const failedAttempts = Number(result.rows[0]?.total) || 0;
    if (failedAttempts < MAX_FAILED_LOGIN_ATTEMPTS) {
      return { locked: false, failedAttempts };
    }

    const lockedUntil = new Date(now.getTime() + ACCOUNT_LOCK_MS);
    await pool.query(
      "UPDATE usuario SET bloqueado_hasta = $1, intentos_reset_en = $2 WHERE id_usuario = $3",
      [lockedUntil, now, usuario.id_usuario]
    );
    return { locked: true, lockedUntil, failedAttempts };
  }

  // Reinicia el contador tras un login exitoso, solo si hubo intentos o bloqueo previos.
  async function clearFailedLogins(usuario) {
    await loginSecuritySchemaReady;
    const result = await pool.query(
      "SELECT COUNT(*)::int AS total FROM login_attempts WHERE id_usuario = $1 AND created_at > $2",
      [usuario.id_usuario, usuario.intentos_reset_en || new Date(0)]
    );
    if (!usuario.bloqueado_hasta && !(Number(result.rows[0]?.total) > 0)) return;
    await unlockAccount(usuario.id_usuario);
  }

  async function unlockAccount(userId) {
    const result = await pool.query(
      "UPDATE usuario SET bloqueado_hasta = NULL, intentos_reset_en = $1 WHERE id_usuario = $2 RETURNING *",
      [new Date(), userId]
    );
    return result.rows[0] || null;
  }

  async function createUnlockToken(usuario) {
    await loginSecuritySchemaReady;
    const token = crypto.randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO account_unlock_tokens (id_usuario, token_hash, expires_at) VALUES ($1, $2, $3)",
      [usuario.id_usuario, hashToken(token), new Date(Date.now() + UNLOCK_TOKEN_TTL_MS)]
    );
    return token;
  }

  async function unlockWithToken(token) {
    await loginSecuritySchemaReady;
    const result = await pool.query(
      "SELECT id, id_usuario, expires_at, used_at FROM account_unlock_tokens WHERE token_hash = $1",
      [hashToken(token || "")]
    );
    const record = result.rows[0];

    if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
      return null;
    }

    const usuario = await unlockAccount(record.id_usuario);
    await pool.query("UPDATE account_unlock_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1", [record.id]);
    return usuario;
  }

  return {
    MAX_FAILED_LOGIN_ATTEMPTS,
    ACCOUNT_LOCK_MS,
    getActiveLock,
    registerFailedLogin,
    clearFailedLogins,
    unlockAccount,
    createUnlockToken,
    unlockWithToken,
    findUserByEmail,
    createUser,
    createInitialTramite,
    verifyPassword,
    createPasswordResetToken,
    resetPassword,
    createEmailVerificationToken,
    requestEmailVerification,
    verifyEmail,
  };
}

module.exports = createAuthService;
