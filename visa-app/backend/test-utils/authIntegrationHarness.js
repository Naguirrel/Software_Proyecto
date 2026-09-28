const express = require("express");
const createAuthRoutes = require("../routes/authRoutes");
const { createSessionMiddleware } = require("../auth");

const normalize = (sql) => String(sql).replace(/\s+/g, " ").trim();

function createInMemoryAuthDb() {
  const state = {
    users: [],
    tramites: [],
    passwordResets: [],
    emailVerifications: [],
    nextUserId: 1,
    nextRecordId: 1,
  };

  const findUser = (predicate) => state.users.find(predicate);
  const publicUser = (user) => ({ ...user, rol: user.rol || "cliente" });

  async function query(sql, values = []) {
    const text = normalize(sql);

    if (text.startsWith("SELECT") && text.includes("FROM usuario WHERE correo = $1")) {
      const user = findUser((row) => row.correo === values[0]);
      return { rows: user ? [publicUser(user)] : [] };
    }

    if (text.startsWith("SELECT") && text.includes("FROM usuario WHERE id_usuario = $1")) {
      const user = findUser((row) => row.id_usuario === values[0]);
      return { rows: user ? [publicUser(user)] : [] };
    }

    if (text.startsWith("INSERT INTO usuario")) {
      const [nombre, correo, contrasena] = values;
      if (findUser((row) => row.correo === correo)) {
        throw new Error('duplicate key value violates unique constraint "usuario_correo_key"');
      }
      const user = {
        id_usuario: state.nextUserId++,
        nombre,
        correo,
        contrasena,
        perfil: null,
        rol: "cliente",
        activo: true,
        email_verificado: false,
      };
      state.users.push(user);
      return { rows: [{ ...user }] };
    }

    if (text.startsWith("INSERT INTO tramite")) {
      state.tramites.push({ id_usuario: values[0] });
      return { rows: [] };
    }

    if (text.startsWith("UPDATE usuario SET contrasena = $1 WHERE id_usuario = $2")) {
      const user = findUser((row) => row.id_usuario === values[1]);
      if (user) user.contrasena = values[0];
      return { rows: [] };
    }

    if (text.startsWith("UPDATE usuario SET email_verificado = TRUE")) {
      const user = findUser((row) => row.id_usuario === values[0]);
      if (user) user.email_verificado = true;
      return { rows: user ? [{ ...user }] : [] };
    }

    if (text.startsWith("INSERT INTO password_resets")) {
      state.passwordResets.push({
        id: state.nextRecordId++,
        id_usuario: values[0],
        token_hash: values[1],
        expires_at: values[2],
        used_at: null,
      });
      return { rows: [] };
    }

    if (text.includes("FROM password_resets WHERE token_hash = $1")) {
      const record = state.passwordResets.find((row) => row.token_hash === values[0]);
      return { rows: record ? [{ ...record }] : [] };
    }

    if (text.startsWith("UPDATE password_resets SET used_at")) {
      const record = state.passwordResets.find((row) => row.id === values[0]);
      if (record) record.used_at = new Date();
      return { rows: [] };
    }

    if (text.startsWith("INSERT INTO email_verifications")) {
      state.emailVerifications.push({
        id: state.nextRecordId++,
        id_usuario: values[0],
        token_hash: values[1],
        expires_at: values[2],
        used_at: null,
      });
      return { rows: [] };
    }

    if (text.includes("FROM email_verifications WHERE token_hash = $1")) {
      const record = state.emailVerifications.find((row) => row.token_hash === values[0]);
      return { rows: record ? [{ ...record }] : [] };
    }

    if (text.startsWith("UPDATE email_verifications SET used_at")) {
      const record = state.emailVerifications.find((row) => row.id === values[0]);
      if (record) record.used_at = new Date();
      return { rows: [] };
    }

    throw new Error(`Consulta no soportada por la base en memoria: ${text}`);
  }

  return { state, pool: { query: jest.fn(query) } };
}

function createAuthIntegrationApp({ sendEmail } = {}) {
  const db = createInMemoryAuthDb();
  const schemaReady = Promise.resolve();
  const requireSession = createSessionMiddleware(db.pool);
  const activityLogService = { logActivity: jest.fn(() => Promise.resolve()) };
  const mailbox = [];
  const defaultSendEmail = jest.fn(async (message) => {
    mailbox.push(message);
    return { status: "dry_run" };
  });

  const app = express();
  app.use(express.json());
  app.use("/", createAuthRoutes(db.pool, {
    userSchemaReady: schemaReady,
    tramiteSchemaReady: schemaReady,
    passwordResetSchemaReady: schemaReady,
    emailVerificationSchemaReady: schemaReady,
    testUsersReady: schemaReady,
    requireSession,
    activityLogService,
    sendEmail: sendEmail || defaultSendEmail,
  }));
  app.get("/recurso-protegido", requireSession, (req, res) => res.json({ correo: req.auth.correo }));

  return { app, ...db, activityLogService, mailbox, sendEmail: sendEmail || defaultSendEmail };
}

function extractTokenFromMail(message) {
  const match = message.text.match(/token=([a-f0-9]+)/);
  return match ? match[1] : null;
}

module.exports = { createAuthIntegrationApp, extractTokenFromMail };
