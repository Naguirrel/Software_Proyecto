const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const express = require("express");
const { Pool } = require("pg");

const EXPECTED_DATABASE = "visa_db_test";

function requireTestConfiguration() {
  if (process.env.NODE_ENV !== "test" || process.env.DB_NAME !== EXPECTED_DATABASE) {
    throw new Error(`PostgreSQL tests require NODE_ENV=test and DB_NAME=${EXPECTED_DATABASE}`);
  }
  for (const name of ["DB_HOST", "DB_PORT", "DB_USER", "SESSION_SECRET"]) {
    if (!process.env[name]) throw new Error(`PostgreSQL tests require ${name}`);
  }
}

async function assertTestDatabase(pool) {
  const result = await pool.query("SELECT current_database() AS database_name");
  if (result.rows[0]?.database_name !== EXPECTED_DATABASE) {
    throw new Error(`Refusing test writes or cleanup outside ${EXPECTED_DATABASE}`);
  }
}

async function prepareTestSchema(pool) {
  await assertTestDatabase(pool);
  const schema = await fs.readFile(path.join(__dirname, "../../init.sql"), "utf8");
  await pool.query(schema);
}

async function createPostgresTask5Harness() {
  requireTestConfiguration();
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  let uploadDir;

  try {
    // This SELECT must precede the schema initialization and all fixture writes.
    await prepareTestSchema(pool);

    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "visaguide-task5-"));
    process.env.LOCAL_UPLOAD_DIR = uploadDir;

    const createAuthRoutes = require("../routes/authRoutes");
    const createDocumentRoutes = require("../routes/documentRoutes");
    const createInterviewSessionRoutes = require("../routes/interviewSessionRoutes");
    const createAdminMetricsRoutes = require("../routes/adminMetricsRoutes");
    const { createRoleMiddleware, createSessionMiddleware } = require("../auth");
    const upload = require("../upload");
    const { notFoundHandler, errorHandler } = require("../middleware/errorHandler");

    const ready = Promise.resolve();
    const requireSession = createSessionMiddleware(pool);
    const requireAdmin = createRoleMiddleware(pool, ["admin"]);
    const activityLogService = { logActivity: jest.fn(async () => {}) };
    const mailbox = [];
    const runId = crypto.randomBytes(8).toString("hex");
    let nextEmail = 0;

    const app = express();
    app.use(express.json());
    app.use("/", createAuthRoutes(pool, {
      userSchemaReady: ready,
      tramiteSchemaReady: ready,
      passwordResetSchemaReady: ready,
      emailVerificationSchemaReady: ready,
      testUsersReady: ready,
      requireSession,
      activityLogService,
      sendEmail: async (message) => {
        mailbox.push(message);
        return { status: "captured" };
      },
    }));
    app.use("/", createDocumentRoutes(pool, {
      documentSchemaReady: ready,
      activityLogService,
      requireSession,
    }));
    app.use("/interview-sessions", createInterviewSessionRoutes(pool, {
      requireAdmin,
      activityLogService,
    }));
    app.use("/admin/metrics", createAdminMetricsRoutes(pool, { requireAdmin }));
    app.use(upload.handleUploadError);
    app.use(notFoundHandler);
    app.use(errorHandler);

    return {
      app,
      pool,
      mailbox,
      uploadDir,
      email() { return `task5-${runId}-${++nextEmail}@example.test`; },
      async close() {
        try {
          await assertTestDatabase(pool);
          const users = await pool.query(
            "SELECT id_usuario FROM usuario WHERE correo LIKE $1",
            [`task5-${runId}-%@example.test`]
          );
          const ids = users.rows.map((row) => row.id_usuario);
          if (ids.length) {
            // These tables reference usuario without ON DELETE CASCADE.
            await pool.query("DELETE FROM documentos WHERE usuario_id = ANY($1::int[])", [ids]);
            await pool.query("DELETE FROM interview_sessions WHERE user_id = ANY($1::int[])", [ids]);
            await pool.query("DELETE FROM tramite WHERE id_usuario = ANY($1::int[])", [ids]);
            await pool.query("DELETE FROM usuario WHERE id_usuario = ANY($1::int[])", [ids]);
          }
        } finally {
          await pool.end();
          const entries = await fs.readdir(uploadDir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isFile()) throw new Error("Unexpected entry in temporary upload directory");
            await fs.unlink(path.join(uploadDir, entry.name));
          }
          await fs.rmdir(uploadDir);
          delete process.env.LOCAL_UPLOAD_DIR;
        }
      },
    };
  } catch (error) {
    await pool.end();
    if (uploadDir) {
      const entries = await fs.readdir(uploadDir);
      for (const entry of entries) await fs.unlink(path.join(uploadDir, entry));
      await fs.rmdir(uploadDir);
      delete process.env.LOCAL_UPLOAD_DIR;
    }
    throw error;
  }
}

module.exports = {
  EXPECTED_DATABASE,
  requireTestConfiguration,
  assertTestDatabase,
  prepareTestSchema,
  createPostgresTask5Harness,
};
