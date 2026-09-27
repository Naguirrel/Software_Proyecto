const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const express = require("express");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const cors = require("cors");
const { createCorsOptions } = require("./config/cors");
const upload = require("./upload");
const createInterviewSessionRoutes = require("./routes/interviewSessionRoutes");
const createQuestionBankRoutes = require("./routes/questionBankRoutes");
const createAuthRoutes = require("./routes/authRoutes");
const createPerfilRoutes = require("./routes/perfilRoutes");
const createDs160Routes = require("./routes/ds160Routes");
const createDocumentRoutes = require("./routes/documentRoutes");
const createNotificacionRoutes = require("./routes/notificacionRoutes");
const createAdminMetricsRoutes = require("./routes/adminMetricsRoutes");
const createAdminDocumentRoutes = require("./routes/adminDocumentRoutes");
const createAdminProcessRoutes = require("./routes/adminProcessRoutes");
const createAdminManagementRoutes = require("./routes/adminManagementRoutes");
const createConsularRoutes = require("./routes/consularRoutes");
const { createRoleMiddleware, createSessionMiddleware, issueSessionToken } = require("./auth");
const createInterviewSessionService = require("./services/interviewSessionService");
const { createQuestionBankService } = require("./services/questionBankService");
const createNotificacionService = require("./services/notificacionService");
const createActivityLogService = require("./services/activityLogService");
const createEmailReminderService = require("./services/emailReminderService");
const createConsularPaymentService = require("./services/consularPaymentService");
const createConsularAppointmentService = require("./services/consularAppointmentService");
const { streamDs160Pdf } = require("./services/ds160PdfService");
const { LOCAL_STORAGE_DIR, uploadStoredFile, deleteStoredFile, getStoredFile } = require("./storage");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { createApiDocsRouter } = require("./swagger");

const app = express();

app.set("trust proxy", 1);
app.use(cors(createCorsOptions()));
app.use(express.json());
app.use(createApiDocsRouter());

if (process.env.NODE_ENV !== "production") {
  app.use("/local-files", express.static(LOCAL_STORAGE_DIR));
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const SALT_ROUNDS = 10;

// Conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});
const requireAdmin = createRoleMiddleware(pool, ["admin"]);
const requireStaff = createRoleMiddleware(pool, ["asesor", "admin"]);
const requireSession = createSessionMiddleware(pool);

pool
  .connect()
  .then(() => console.log("Conectado a PostgreSQL"))
  .catch((err) => console.error("Error conexión:", err));

async function ensureDocumentSchema() {
  await pool.query(`
    ALTER TABLE documentos
      ADD COLUMN IF NOT EXISTS documento_key VARCHAR(80),
      ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'review',
      ADD COLUMN IF NOT EXISTS feedback TEXT,
      ADD COLUMN IF NOT EXISTS storage_key TEXT,
      ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS documentos_usuario_documento_key_idx
    ON documentos(usuario_id, documento_key)
    WHERE usuario_id IS NOT NULL AND documento_key IS NOT NULL
  `);
}

const documentSchemaReady = ensureDocumentSchema().catch((error) => {
  console.error("ERROR DOCUMENT SCHEMA:", error);
});

async function ensureUserSchema() {
  await pool.query(`
    ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS telefono             VARCHAR(40),
      ADD COLUMN IF NOT EXISTS ciudad               VARCHAR(120),
      ADD COLUMN IF NOT EXISTS pais                 VARCHAR(120),
      ADD COLUMN IF NOT EXISTS notificaciones_email BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS idioma               VARCHAR(10)  DEFAULT 'es',
      ADD COLUMN IF NOT EXISTS rol                  VARCHAR(20)  DEFAULT 'cliente',
      ADD COLUMN IF NOT EXISTS email_verificado     BOOLEAN DEFAULT TRUE
  `);
  await pool.query(`
    UPDATE usuario SET rol = 'cliente'
    WHERE rol IS NULL OR rol NOT IN ('cliente', 'asesor', 'admin')
  `);
  await pool.query("ALTER TABLE usuario ALTER COLUMN rol SET DEFAULT 'cliente', ALTER COLUMN rol SET NOT NULL");
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'usuario_rol_check' AND conrelid = 'usuario'::regclass
      ) THEN
        ALTER TABLE usuario ADD CONSTRAINT usuario_rol_check
        CHECK (rol IN ('cliente', 'asesor', 'admin'));
      END IF;
    END $$
  `);
}

async function ensureTramiteSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tramite (
      id_tramite SERIAL PRIMARY KEY,
      id_usuario INT UNIQUE REFERENCES usuario(id_usuario),
      estado VARCHAR(100) DEFAULT 'En proceso',
      etapa_actual VARCHAR(200) DEFAULT 'Configuración de perfil',
      progreso INT DEFAULT 0,
      siguiente_paso VARCHAR(200) DEFAULT 'Seleccionar perfil de visa',
      mensaje TEXT DEFAULT 'Configura tu perfil para comenzar'
    )
  `);
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS tramite_usuario_idx ON tramite(id_usuario)");
  await pool.query("ALTER TABLE tramite ADD COLUMN IF NOT EXISTS id_asesor INT REFERENCES usuario(id_usuario)");
  await pool.query(`ALTER TABLE tramite
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query("CREATE INDEX IF NOT EXISTS tramite_asesor_idx ON tramite(id_asesor)");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_change_history (
      id SERIAL PRIMARY KEY,
      process_id INT NOT NULL REFERENCES tramite(id_tramite) ON DELETE CASCADE,
      field_name VARCHAR(100) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
      changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS process_change_history_process_idx
    ON process_change_history(process_id, changed_at DESC, id DESC)
  `);
}

async function ensurePasswordResetSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS password_resets_usuario_idx ON password_resets(id_usuario)");
}

async function ensureEmailVerificationSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id SERIAL PRIMARY KEY,
      id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS email_verifications_usuario_idx ON email_verifications(id_usuario)");
}

async function ensureAdminSchema() {
  await userSchemaReady;
  await tramiteSchemaReady;
  await pool.query(`ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS capacidad_asesor INT DEFAULT 50,
    ADD COLUMN IF NOT EXISTS disponible_asesor BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE formulario_ds160
    ADD COLUMN IF NOT EXISTS estado_revision VARCHAR(30) DEFAULT 'en_progreso',
    ADD COLUMN IF NOT EXISTS feedback_revision TEXT,
    ADD COLUMN IF NOT EXISTS id_asesor INT REFERENCES usuario(id_usuario)`);
  await pool.query(`ALTER TABLE question_bank
    ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS uso_count INT DEFAULT 0`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_settings (
    id INT PRIMARY KEY,
    nombre_comercial VARCHAR(160), razon_social VARCHAR(200), sitio_web TEXT,
    idioma VARCHAR(20) DEFAULT 'es', zona_horaria VARCHAR(80) DEFAULT 'America/Guatemala',
    notificaciones_automaticas BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`ALTER TABLE admin_settings
    ADD COLUMN IF NOT EXISTS notificaciones_automaticas BOOLEAN DEFAULT TRUE`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_activity (
    id SERIAL PRIMARY KEY, actor_id INT REFERENCES usuario(id_usuario),
    accion VARCHAR(180) NOT NULL, detalle TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}
 
const userSchemaReady = ensureUserSchema().catch((error) => {
  console.error("ERROR USER SCHEMA:", error);
});
const tramiteSchemaReady = userSchemaReady.then(ensureTramiteSchema).catch((error) => {
  console.error("ERROR TRAMITE SCHEMA:", error);
});
const passwordResetSchemaReady = userSchemaReady.then(ensurePasswordResetSchema).catch((error) => {
  console.error("ERROR PASSWORD RESET SCHEMA:", error);
});
const emailVerificationSchemaReady = userSchemaReady.then(ensureEmailVerificationSchema).catch((error) => {
  console.error("ERROR EMAIL VERIFICATION SCHEMA:", error);
});
const adminSchemaReady = tramiteSchemaReady.then(ensureAdminSchema).catch((error) => {
  console.error("ERROR ADMIN SCHEMA:", error);
});

const testUsers = [
  ["Cliente Desarrollo", "cliente.dev@visaguide.test", "VisaGuide-Dev-2026!", "cliente"],
  ["Asesor Desarrollo", "asesor.dev@visaguide.test", "VisaGuide-Dev-2026!", "asesor"],
  ["Admin Desarrollo", "admin.dev@visaguide.test", "VisaGuide-Dev-2026!", "admin"],
  ["Norman", "norman@prueba.cliente", "123456", "cliente"],
  ["Juanfri", "juanfri@prueba.cliente", "123456", "cliente"],
  ["Yaya", "yaya@prueba.cliente", "123456", "cliente"],
  ["Quan", "quan@prueba.cliente", "123456", "cliente"],
  ["Usuario Prueba", "usuario@prueba.com", "123456", "cliente"],
  ["Admin Norman", "admin.norman@prueba.com", "123456", "admin"],
  ["Admin Juanfri", "admin.juanfri@prueba.com", "123456", "admin"],
  ["Admin Yaya", "admin.yaya@prueba.com", "123456", "admin"],
  ["Admin Quan", "admin.quan@prueba.com", "123456", "admin"],
  ["Admin General", "admin@prueba.com", "123456", "admin"],
];

async function seedTestUsers() {
  await userSchemaReady;

  const hashedTestUsers = await Promise.all(
    testUsers.map(async ([nombre, correo, contrasena, rol]) => [
      nombre,
      correo,
      await bcrypt.hash(contrasena, SALT_ROUNDS),
      rol,
    ])
  );

  await pool.query(
    `
      INSERT INTO usuario(nombre, correo, contrasena, rol)
      SELECT seed.nombre, seed.correo, seed.contrasena, seed.rol
      FROM (VALUES
        ${hashedTestUsers.map((_, index) => {
          const base = index * 4;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
        }).join(",\n        ")}
      ) AS seed(nombre, correo, contrasena, rol)
      WHERE NOT EXISTS (
        SELECT 1 FROM usuario u WHERE u.correo = seed.correo
      )
    `,
    hashedTestUsers.flat()
  );
}

async function seedTestProcesses() {
  await Promise.all([seedTestUsers(), tramiteSchemaReady]);

  const developmentProcesses = [
    ["norman@prueba.cliente", "Turismo B1/B2", "En proceso", "Formulario DS-160", 17, "asesor.dev@visaguide.test"],
    ["juanfri@prueba.cliente", "Estudiante F1", "Pendiente", "Documentos", 34, "asesor.dev@visaguide.test"],
    ["yaya@prueba.cliente", "Turismo Grupo", "Aprobado", "Pago de visa", 51, "asesor.dev@visaguide.test"],
    ["quan@prueba.cliente", "Renovación B1/B2", "En proceso", "Cita consular", 67, null],
    ["usuario@prueba.com", "Trabajo H1B", "Inactivo", "Configuración de perfil", 0, null],
  ];

  for (const [clientEmail, profile, status, stage, progress, advisorEmail] of developmentProcesses) {
    await pool.query("UPDATE usuario SET perfil = COALESCE(perfil, $1) WHERE correo = $2", [profile, clientEmail]);
    await pool.query(
      `INSERT INTO tramite
         (id_usuario, estado, etapa_actual, progreso, siguiente_paso, mensaje, id_asesor)
       SELECT client.id_usuario, $1, $2, $3, $4, $5, advisor.id_usuario
       FROM usuario client
       LEFT JOIN usuario advisor ON advisor.correo = $6 AND advisor.rol = 'asesor'
       WHERE client.correo = $7
         AND NOT EXISTS (SELECT 1 FROM tramite existing WHERE existing.id_usuario = client.id_usuario)`,
      [status, stage, progress, `Continuar con ${stage}`,
        "Expediente de prueba para validar el panel administrativo local.", advisorEmail, clientEmail]
    );
  }
}

const testUsersReady = (process.env.NODE_ENV === "development" ? seedTestProcesses() : Promise.resolve()).catch((error) => {
  console.error("ERROR TEST USERS SEED:", error);
});

const questionBankService = createQuestionBankService(pool);
questionBankService.seedInitialQuestions().catch((error) => {
  console.error("ERROR QUESTION BANK SCHEMA:", error);
});

const interviewSessionService = createInterviewSessionService(pool);
interviewSessionService.ensureSchema().catch((error) => {
  console.error("ERROR INTERVIEW SESSION SCHEMA:", error);
});

const notificacionService = createNotificacionService(pool);
notificacionService.ensureSchema().catch((error) => {
  console.error("ERROR NOTIFICACIONES SCHEMA:", error);
});

const consularPaymentService = createConsularPaymentService(pool, { notificacionService });
const consularAppointmentService = createConsularAppointmentService(pool, {
  notificacionService,
  paymentService: consularPaymentService,
});
const consularSchemaReady = consularPaymentService.ensureSchema()
  .then(() => consularAppointmentService.ensureSchema());
consularSchemaReady.catch((error) => {
  console.error("ERROR CONSULAR MODULE SCHEMA:", error);
});

const activityLogService = createActivityLogService(pool);
activityLogService.ensureSchema().catch((error) => {
  console.error("ERROR ACTIVITY LOG SCHEMA:", error);
});

const emailReminderService = createEmailReminderService(pool);
emailReminderService.ensureSchema().catch((error) => {
  console.error("ERROR EMAIL REMINDER SCHEMA:", error);
});

async function notificarCambioEtapa(userId, etapa, titulo, mensaje) {
  try {
    await notificacionService.notificarCambioEtapa(userId, etapa, titulo, mensaje);
  } catch (err) {
    console.error("ERROR NOTIFICAR ETAPA:", err);
  }
}

function buildStoredDocumentUrl(documentId) {
  return `/documentos/${documentId}/archivo`;
}

function presentLoginUser(user) {
  return {
    id: user.id_usuario,
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    correo: user.correo,
    perfil: user.perfil || null,
    rol: user.rol || "cliente",
  };
}

function inferDocumentContentType(document, storedFile = {}) {
  if (document.tipo?.includes("/")) return document.tipo;
  if (storedFile.contentType && storedFile.contentType !== "application/octet-stream") {
    return storedFile.contentType;
  }

  const candidates = [
    document.nombre,
    document.archivo_url,
    document.storage_key,
  ].filter(Boolean);

  const extension = candidates
    .map((value) => path.extname(String(value)).toLowerCase())
    .find(Boolean);

  const mimeTypes = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };

  return mimeTypes[extension] || storedFile.contentType || "application/octet-stream";
}

function canPreviewInline(contentType) {
  return contentType === "application/pdf" || contentType.startsWith("image/");
}

function getUrlPathname(url) {
  try {
    return new URL(url, "http://visaguide.local").pathname;
  } catch {
    return "";
  }
}

function isSelfDocumentFileUrl(document) {
  return getUrlPathname(document.archivo_url) === buildStoredDocumentUrl(document.id);
}


// Prueba
app.get("/", (req, res) => {
  res.send("Backend funcionando");
});

app.use("/interview-sessions", createInterviewSessionRoutes(pool, { requireAdmin, notificacionService, activityLogService }));
app.use("/questions", createQuestionBankRoutes(pool, { requireAdmin }));
app.use("/", createPerfilRoutes(pool, { userSchemaReady, tramiteSchemaReady, activityLogService, notificacionService }));
app.use("/", createAuthRoutes(pool, { userSchemaReady, tramiteSchemaReady, passwordResetSchemaReady, emailVerificationSchemaReady, testUsersReady, requireSession, activityLogService }));
app.use("/notificaciones", createNotificacionRoutes(pool, { requireSession, requireAdmin }));
app.use("/", createDocumentRoutes(pool, { documentSchemaReady, activityLogService, requireSession }));
app.use("/", createDs160Routes(pool, { activityLogService, notificacionService }));
app.use("/", createConsularRoutes({
  requireSession,
  requireStaff,
  paymentService: consularPaymentService,
  appointmentService: consularAppointmentService,
  schemaReady: consularSchemaReady,
  upload,
  uploadStoredFile,
  deleteStoredFile,
}));
app.use("/admin/metrics", createAdminMetricsRoutes(pool, { requireAdmin }));
app.use("/admin/documents", createAdminDocumentRoutes(pool, { requireAdmin, schemaReady: documentSchemaReady, notificacionService, activityLogService }));
app.use("/admin/processes", createAdminProcessRoutes(pool, { requireAdmin, schemaReady: tramiteSchemaReady, notificacionService, activityLogService }));
app.use("/admin", createAdminManagementRoutes(pool, { requireAdmin, schemaReady: adminSchemaReady, notificacionService, activityLogService, emailReminderService }));


// =====================
// ENDPOINTS DS-160
// =====================

// PUT /tramite — actualizar etapa del trámite y generar notificación automática
const ETAPAS_VALIDAS = {
  "Formulario DS-160": { progreso: 17, siguientePaso: "Completar el formulario DS-160" },
  "Pago de visa":      { progreso: 34, siguientePaso: "Realizar el pago de la tarifa de visa" },
  "Cita consular":     { progreso: 51, siguientePaso: "Programar tu cita consular" },
  "Entrevista":        { progreso: 67, siguientePaso: "Prepararte para la entrevista consular" },
  "Decisión final":    { progreso: 84, siguientePaso: "Esperar la decisión final del consulado" },
};

const MENSAJES_ETAPA = {
  "Formulario DS-160": "Tu perfil fue configurado. El siguiente paso es completar el formulario DS-160.",
  "Pago de visa":      "Formulario DS-160 completado. Ahora debes realizar el pago de la tarifa de visa.",
  "Cita consular":     "Pago de visa confirmado. El siguiente paso es programar tu cita consular.",
  "Entrevista":        "Cita consular agendada. Prepárate para tu entrevista.",
  "Decisión final":    "Entrevista completada. Tu solicitud está en proceso de revisión final.",
};


app.use(upload.handleUploadError);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
