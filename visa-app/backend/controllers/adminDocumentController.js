const { sendErrorResponse } = require("../middleware/errorResponse");

function createAdminDocumentController(adminDocumentService, { notificacionService, activityLogService } = {}) {
  function hasOwn(body, key) {
    return Object.prototype.hasOwnProperty.call(body || {}, key);
  }

  function getRequestedStatus(body) {
    if (hasOwn(body, "estado")) return body.estado;
    if (hasOwn(body, "status")) return body.status;
    return undefined;
  }

  function getDocumentNotification(documento, { statusChanged, feedbackChanged }) {
    const documentName = documento.nombre || "documento";
    const normalizedStatus = documento.estado === "rejected" ? "correction" : documento.estado;

    if (statusChanged && normalizedStatus === "approved") {
      return {
        titulo: "Documento aprobado",
        mensaje: `Tu ${documentName} fue aprobado.`,
        prioridad: "normal",
      };
    }

    if (statusChanged && normalizedStatus === "correction") {
      return {
        titulo: "Documento requiere correcciones",
        mensaje: feedbackChanged
          ? `Tu ${documentName} requiere correcciones. Revisa las observaciones del administrador.`
          : `Tu ${documentName} requiere correcciones.`,
        prioridad: "alta",
      };
    }

    if (feedbackChanged) {
      return {
        titulo: "Nuevas observaciones en documento",
        mensaje: "El administrador agrego observaciones a uno de tus documentos.",
        prioridad: "alta",
      };
    }

    return null;
  }

  async function notifyDocumentUpdate(documento, context) {
    if (!notificacionService || !documento?.usuario_id) return;

    const notification = getDocumentNotification(documento, context);
    if (!notification) return;

    try {
      await notificacionService.crearNotificacion({
        userId: documento.usuario_id,
        titulo: notification.titulo,
        mensaje: notification.mensaje,
        prioridad: notification.prioridad,
        tipo: "documento",
        etapaRelacionada: documento.documento_key || `documento-${documento.id}`,
      });
    } catch (error) {
      console.error("ERROR ADMIN DOCUMENT NOTIFICATION:", error);
    }
  }

  async function listDocuments(_req, res) {
    try {
      const documentos = await adminDocumentService.listDocuments();
      return res.json({ documentos });
    } catch (error) {
      console.error("ERROR ADMIN DOCUMENTS LIST:", error);
      return res.status(500).json({ error: "No fue posible cargar los documentos" });
    }
  }

  async function updateDocumentStatus(req, res) {
    const documentId = Number(req.params.id);

    if (Number.isNaN(documentId)) {
      return res.status(400).json({ error: "documento_id debe ser numerico" });
    }

    try {
      const payload = {};
      const requestedStatus = getRequestedStatus(req.body);
      const statusChanged = requestedStatus !== undefined;
      const feedbackChanged = hasOwn(req.body, "feedback");

      if (statusChanged) {
        payload.status = requestedStatus;
      }

      if (feedbackChanged) {
        payload.feedback = req.body.feedback;
      }

      const documento = await adminDocumentService.updateDocumentStatus(documentId, payload);
      await notifyDocumentUpdate(documento, { statusChanged, feedbackChanged });
      await activityLogService?.logActivity({
        req,
        actor: req.auth,
        userId: documento.usuario_id,
        adminId: req.auth?.id_usuario,
        userEmail: req.auth?.correo,
        role: req.auth?.rol || "admin",
        action: statusChanged ? "document.status_updated" : "document.feedback_updated",
        entityType: "documento",
        entityId: documento.id,
        description: statusChanged
          ? "Estado de documento actualizado por administrador"
          : "Observaciones de documento actualizadas por administrador",
        metadata: {
          estado: documento.estado,
          documentoKey: documento.documento_key,
          solicitante: documento.usuario?.correo,
        },
      });

      return res.json({
        message: statusChanged
          ? "Estado del documento actualizado correctamente"
          : "Observaciones del documento actualizadas correctamente",
        documento,
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible actualizar el documento",
        context: "admin_documents.update",
      });
    }
  }

  return { listDocuments, updateDocumentStatus };
}

module.exports = createAdminDocumentController;
