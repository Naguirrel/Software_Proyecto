const express = require("express");
const { createAdvisorChangeRequestService } = require("../services/advisorChangeRequestService");
const { sendErrorResponse } = require("../middleware/errorResponse");

module.exports = function createAdvisorChangeRequestRoutes(pool, {
  requireSession,
  requireAdmin,
  schemaReady,
  notificacionService,
  activityLogService,
}) {
  const router = express.Router();
  const adminRouter = express.Router();
  const service = createAdvisorChangeRequestService(pool, { schemaReady });

  router.use(requireSession);
  router.use((req, res, next) => req.auth?.rol === "cliente"
    ? next()
    : res.status(403).json({ error: "Acceso permitido únicamente a clientes" }));

  router.get("/context", async (req, res) => {
    try { return res.json(await service.getClientContext(req.auth.id_usuario)); }
    catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar la información del asesor",
        context: "advisorChange.context",
      });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const request = await service.createRequest(req.auth.id_usuario, req.body);
      const admins = await pool.query("SELECT id_usuario FROM usuario WHERE rol = 'admin' AND activo = TRUE");
      await Promise.allSettled(admins.rows.map((admin) => notificacionService?.crearNotificacion({
        userId: admin.id_usuario,
        titulo: "Solicitud de cambio de asesor",
        mensaje: `${request.applicantName} solicita revisión de su asignación.`,
        tipo: "alerta",
        etapaRelacionada: `advisor-change-${request.id}`,
        prioridad: "alta",
        actionUrl: "/admin/assignments?tab=changes",
        entityType: "advisor_change_request",
        entityId: request.id,
        dedupeKey: `advisor-change:${request.id}`,
      })));
      await activityLogService?.logActivity({
        req,
        actor: req.auth,
        userId: req.auth.id_usuario,
        role: "cliente",
        action: "advisor_change.requested",
        entityType: "advisor_change_request",
        entityId: request.id,
        description: "Solicitud de cambio de asesor creada",
        metadata: { category: request.category, currentAdvisorId: request.currentAdvisor.id },
      });
      return res.status(201).json({ request });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible enviar la solicitud",
        context: "advisorChange.create",
      });
    }
  });

  adminRouter.use(requireAdmin);
  adminRouter.get("/", async (req, res) => {
    try { return res.json({ requests: await service.listRequests({ status: req.query.status }) }); }
    catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar las solicitudes",
        context: "advisorChange.admin.list",
      });
    }
  });

  adminRouter.put("/:id/resolve", async (req, res) => {
    try {
      const request = await service.resolveRequest(req.params.id, req.auth.id_usuario, req.body);
      const approved = request.status === "approved";
      const notifications = [notificacionService?.crearNotificacion({
        userId: request.userId,
        titulo: approved ? "Cambio de asesor aprobado" : "Solicitud de cambio revisada",
        mensaje: approved
          ? `Tu nuevo asesor es ${request.newAdvisor.name}. Revisa tu perfil o chat para continuar.`
          : `Administración revisó tu solicitud: ${request.resolution}`,
        tipo: approved ? "assignment" : "info",
        etapaRelacionada: `advisor-change-${request.id}`,
        prioridad: approved ? "alta" : "normal",
      })];
      if (approved) {
        notifications.push(
          notificacionService?.crearNotificacion({
            userId: request.currentAdvisor.id,
            titulo: "Expediente reasignado",
            mensaje: `El expediente de ${request.applicantName} fue reasignado por administración.`,
            tipo: "assignment",
            etapaRelacionada: `advisor-change-${request.id}`,
          }),
          notificacionService?.crearNotificacion({
            userId: request.newAdvisor.id,
            titulo: "Nuevo expediente asignado",
            mensaje: `Se te asignó el expediente de ${request.applicantName}.`,
            tipo: "assignment",
            etapaRelacionada: `advisor-change-${request.id}`,
            prioridad: "alta",
            actionUrl: "/advisor/solicitudes",
          })
        );
      }
      await Promise.allSettled(notifications.filter(Boolean));
      await activityLogService?.logActivity({
        req,
        actor: req.auth,
        userId: request.userId,
        adminId: req.auth.id_usuario,
        role: "admin",
        action: approved ? "advisor_change.approved" : "advisor_change.rejected",
        entityType: "advisor_change_request",
        entityId: request.id,
        description: approved ? "Cambio de asesor aprobado" : "Cambio de asesor rechazado",
        metadata: { previousAdvisorId: request.currentAdvisor.id, newAdvisorId: request.newAdvisor?.id || null },
      });
      return res.json({ request });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible resolver la solicitud",
        context: "advisorChange.admin.resolve",
      });
    }
  });

  return { adminRouter, clientRouter: router };
};
