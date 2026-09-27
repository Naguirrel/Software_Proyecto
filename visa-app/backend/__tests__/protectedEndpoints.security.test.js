const express = require("express");
const request = require("supertest");
const { createRoleMiddleware, createSessionMiddleware, issueSessionToken } = require("../auth");
const createAuthRoutes = require("../routes/authRoutes");
const createDocumentRoutes = require("../routes/documentRoutes");
const createNotificacionRoutes = require("../routes/notificacionRoutes");
const createQuestionBankRoutes = require("../routes/questionBankRoutes");
const createInterviewSessionRoutes = require("../routes/interviewSessionRoutes");
const createAdminDocumentRoutes = require("../routes/adminDocumentRoutes");
const createAdminProcessRoutes = require("../routes/adminProcessRoutes");
const createAdminManagementRoutes = require("../routes/adminManagementRoutes");
const createAdminMetricsRoutes = require("../routes/adminMetricsRoutes");
const createConsularRoutes = require("../routes/consularRoutes");

const CLIENT = {
  id_usuario: 21,
  nombre: "Cliente Seguridad",
  correo: "cliente.endpoints@test.dev",
  perfil: "turismo_negocios",
  rol: "cliente",
  activo: true,
  email_verificado: true,
};

const SESSION_ENDPOINTS = [
  ["get", "/validar-sesion"],
  ["post", "/upload"],
  ["post", "/documentos"],
  ["post", "/documentos/listar"],
  ["get", "/documentos/10/archivo"],
  ["get", "/documentos/21"],
  ["delete", "/documentos"],
  ["delete", "/documentos/10"],
  ["post", "/notificaciones/no-leidas"],
  ["post", "/notificaciones/listar"],
  ["put", "/notificaciones/leer-todas"],
  ["get", "/notificaciones/21/no-leidas"],
  ["get", "/notificaciones/21"],
  ["put", "/notificaciones/10/leer"],
  ["delete", "/notificaciones/10"],
  ["get", "/payments/me"],
  ["post", "/payments/bank-transfer"],
  ["get", "/appointments/me"],
];

const ADMIN_ENDPOINTS = [
  ["post", "/notificaciones"],
  ["get", "/questions/admin"],
  ["post", "/questions"],
  ["put", "/questions/10"],
  ["patch", "/questions/10/status"],
  ["delete", "/questions/10"],
  ["get", "/interview-sessions"],
  ["put", "/interview-sessions/10/feedback"],
  ["get", "/admin/documents"],
  ["put", "/admin/documents/10/status"],
  ["get", "/admin/processes"],
  ["get", "/admin/processes/10/history"],
  ["get", "/admin/processes/10"],
  ["put", "/admin/processes/10"],
  ["get", "/admin/metrics/overview"],
  ["get", "/admin/metrics/processes"],
  ["get", "/admin/metrics/processes.csv"],
  ["get", "/admin/metrics/processes.xlsx"],
  ["get", "/admin/activity-logs"],
  ["post", "/admin/email-reminders/run"],
  ["get", "/admin/dashboard"],
  ["get", "/admin/users"],
  ["get", "/admin/users/10"],
  ["post", "/admin/users"],
  ["patch", "/admin/users/10"],
  ["get", "/admin/advisors"],
  ["post", "/admin/advisors"],
  ["get", "/admin/assignments"],
  ["post", "/admin/assignments"],
  ["get", "/admin/ds160"],
  ["put", "/admin/ds160/10"],
  ["get", "/admin/profile"],
  ["put", "/admin/profile"],
  ["get", "/admin/settings"],
  ["put", "/admin/settings"],
];

const STAFF_ENDPOINTS = [
  ["get", "/staff/consular-cases"],
  ["post", "/staff/consular-payments/10/start"],
  ["post", "/staff/consular-payments/10/review-transfer"],
  ["post", "/staff/consular-payments/10/receipt"],
  ["put", "/staff/consular-cases/21/appointment"],
  ["post", "/staff/consular-cases/21/appointments/10/cancel"],
];

function createProtectedRoutesApp() {
  const pool = {
    query: jest.fn(async (sql) => {
      if (String(sql).includes("FROM usuario WHERE id_usuario = $1")) {
        return { rows: [CLIENT] };
      }
      return { rows: [] };
    }),
  };
  const app = express();
  const requireSession = createSessionMiddleware(pool);
  const requireAdmin = createRoleMiddleware(pool, ["admin"]);
  const requireStaff = createRoleMiddleware(pool, ["asesor", "admin"]);
  const schemaReady = Promise.resolve();
  const activityLogService = {
    listLogs: jest.fn(),
    logActivity: jest.fn(),
  };
  const notificacionService = {};
  const emailReminderService = {
    listReminderCandidates: jest.fn(),
    sendReminder: jest.fn(),
  };
  const upload = {
    single: () => (_req, _res, next) => next(),
    handleUploadError: (_error, _req, _res, next) => next(),
  };

  app.use(express.json());
  app.use("/", createAuthRoutes(pool, {
    userSchemaReady: schemaReady,
    tramiteSchemaReady: schemaReady,
    passwordResetSchemaReady: schemaReady,
    emailVerificationSchemaReady: schemaReady,
    testUsersReady: schemaReady,
    requireSession,
    activityLogService,
    sendEmail: jest.fn(),
  }));
  app.use("/", createDocumentRoutes(pool, { documentSchemaReady: schemaReady, activityLogService, requireSession }));
  app.use("/notificaciones", createNotificacionRoutes(pool, { requireSession, requireAdmin }));
  app.use("/questions", createQuestionBankRoutes(pool, { requireAdmin }));
  app.use("/interview-sessions", createInterviewSessionRoutes(pool, { requireAdmin, notificacionService, activityLogService }));
  app.use("/admin/documents", createAdminDocumentRoutes(pool, { requireAdmin, schemaReady, notificacionService, activityLogService }));
  app.use("/admin/processes", createAdminProcessRoutes(pool, { requireAdmin, schemaReady, notificacionService, activityLogService }));
  app.use("/admin/metrics", createAdminMetricsRoutes(pool, { requireAdmin }));
  app.use("/admin", createAdminManagementRoutes(pool, {
    requireAdmin,
    schemaReady,
    notificacionService,
    activityLogService,
    emailReminderService,
  }));
  app.use("/", createConsularRoutes({
    requireSession,
    requireStaff,
    paymentService: {},
    appointmentService: {},
    schemaReady,
    upload,
    uploadStoredFile: jest.fn(),
    deleteStoredFile: jest.fn(),
  }));

  return { app, pool };
}

async function callEndpoint(app, method, path, token) {
  const call = request(app)[method](path);
  if (token) call.set("Authorization", `Bearer ${token}`);
  return call;
}

describe("seguridad de endpoints protegidos", () => {
  test.each([...SESSION_ENDPOINTS, ...ADMIN_ENDPOINTS, ...STAFF_ENDPOINTS])(
    "%s %s rechaza solicitudes sin token",
    async (method, path) => {
      const { app, pool } = createProtectedRoutesApp();

      const response = await callEndpoint(app, method, path);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Sesión inválida o expirada" });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test.each(ADMIN_ENDPOINTS)(
    "%s %s rechaza a un cliente autenticado",
    async (method, path) => {
      const { app } = createProtectedRoutesApp();

      const response = await callEndpoint(app, method, path, issueSessionToken(CLIENT));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "Acceso no autorizado" });
    }
  );

  test.each(STAFF_ENDPOINTS)(
    "%s %s rechaza a un cliente sin rol de personal",
    async (method, path) => {
      const { app } = createProtectedRoutesApp();

      const response = await callEndpoint(app, method, path, issueSessionToken(CLIENT));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "Acceso no autorizado" });
    }
  );
});
