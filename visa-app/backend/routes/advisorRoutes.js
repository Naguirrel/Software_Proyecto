const express = require("express");
const createAdminDocumentService = require("../services/adminDocumentService");
const createInterviewSessionService = require("../services/interviewSessionService");
const { createQuestionBankService } = require("../services/questionBankService");
const createAdvisorCommunicationService = require("../services/advisorCommunicationService");
const createProcessChangeHistoryService = require("../services/processChangeHistoryService");

const VALID_PROCESS_STATES = new Set(["En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"]);
const PROCESS_STAGES = {
  "Configuración de perfil": 0,
  "Formulario DS-160": 17,
  "Pago de visa": 34,
  "Pago consular": 51,
  "Cita consular": 51,
  Entrevista: 67,
  "Decisión final": 84,
  Completado: 100,
};
const VALID_DS160_STATES = new Set(["en_progreso", "por_revisar", "correccion", "aprobado"]);

function handleError(res, error, fallback = "No fue posible procesar la solicitud") {
  if (!error.statusCode || error.statusCode >= 500) console.error("ADVISOR MODULE ERROR:", error);
  return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : fallback });
}

function presentProcess(row) {
  return {
    id: row.id_tramite,
    estado: row.estado,
    etapaActual: row.etapa_actual,
    progreso: Number(row.progreso) || 0,
    siguientePaso: row.siguiente_paso || "",
    mensaje: row.mensaje || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    solicitante: {
      id: row.id_usuario,
      nombre: row.solicitante_nombre,
      correo: row.solicitante_correo,
      perfil: row.solicitante_perfil || "Sin definir",
      telefono: row.solicitante_telefono || "",
      ciudad: row.solicitante_ciudad || "",
      pais: row.solicitante_pais || "",
    },
  };
}

function normalizeDs160(row) {
  let datos = row.datos || {};
  if (typeof datos === "string") {
    try { datos = JSON.parse(datos); } catch { datos = {}; }
  }
  return {
    id: row.id,
    userId: row.id_usuario,
    name: row.nombre,
    email: row.correo,
    profile: row.perfil || "Sin definir",
    currentSection: Number(row.seccion_actual) || 1,
    completed: Boolean(row.completado),
    progress: row.completado ? 100 : Math.min(100, Math.round((Number(row.seccion_actual) || 1) / 10 * 100)),
    status: row.estado_revision || "en_progreso",
    feedback: row.feedback_revision || "",
    data: datos,
    updatedAt: row.updated_at,
  };
}

module.exports = function createAdvisorRoutes(pool, {
  requireAdvisor,
  schemaReady = Promise.resolve(),
  documentSchemaReady = Promise.resolve(),
  notificacionService,
  activityLogService,
} = {}) {
  const router = express.Router();
  const documentService = createAdminDocumentService(pool, { schemaReady: documentSchemaReady });
  const interviewService = createInterviewSessionService(pool);
  const questionService = createQuestionBankService(pool);
  const communicationService = createAdvisorCommunicationService(pool);
  const historyService = createProcessChangeHistoryService(pool);
  const advisorSchemaReady = Promise.all([
    schemaReady,
    communicationService.ensureSchema(),
    activityLogService?.ensureSchema?.() || Promise.resolve(),
  ]);

  router.use(requireAdvisor);
  router.use(async (_req, res, next) => {
    try { await advisorSchemaReady; return next(); }
    catch (error) { return handleError(res, error, "No fue posible preparar el módulo de asesor"); }
  });

  async function logAdvisorAction(req, input) {
    await activityLogService?.logActivity({
      req,
      actor: req.auth,
      userId: input.userId || null,
      adminId: req.auth.id_usuario,
      role: "asesor",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
      metadata: input.metadata,
    });
  }

  router.get("/dashboard", async (req, res) => {
    const advisorId = req.auth.id_usuario;
    try {
      const [statsResult, attentionResult, activityResult] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(DISTINCT t.id_tramite) FILTER (WHERE t.estado NOT IN ('Inactivo', 'Completado'))::int AS active_processes,
            COUNT(DISTINCT d.id) FILTER (WHERE COALESCE(d.estado, 'review') IN ('review', 'pending'))::int AS pending_documents,
            COUNT(DISTINCT f.id_formulario) FILTER (WHERE COALESCE(f.estado_revision, 'en_progreso') = 'por_revisar')::int AS pending_ds160,
            COUNT(DISTINCT s.id) FILTER (WHERE s.status <> 'reviewed')::int AS pending_interviews
          FROM tramite t
          LEFT JOIN documentos d ON d.usuario_id = t.id_usuario
          LEFT JOIN formulario_ds160 f ON f.id_usuario = t.id_usuario
          LEFT JOIN interview_sessions s ON s.user_id = t.id_usuario
          WHERE t.id_asesor = $1
        `, [advisorId]),
        pool.query(`
          SELECT t.*, u.nombre AS solicitante_nombre, u.correo AS solicitante_correo,
                 u.perfil AS solicitante_perfil
          FROM tramite t
          JOIN usuario u ON u.id_usuario = t.id_usuario
          WHERE t.id_asesor = $1 AND t.estado NOT IN ('Inactivo', 'Completado')
          ORDER BY CASE WHEN t.estado = 'Pendiente' THEN 0 ELSE 1 END,
                   t.updated_at DESC NULLS LAST, t.id_tramite DESC
          LIMIT 5
        `, [advisorId]),
        pool.query(`
          SELECT id, action, description, created_at
          FROM activity_logs
          WHERE admin_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT 6
        `, [advisorId]),
      ]);
      return res.json({
        stats: {
          activeProcesses: statsResult.rows[0]?.active_processes || 0,
          pendingDocuments: statsResult.rows[0]?.pending_documents || 0,
          pendingDs160: statsResult.rows[0]?.pending_ds160 || 0,
          pendingInterviews: statsResult.rows[0]?.pending_interviews || 0,
        },
        attention: attentionResult.rows.map(presentProcess),
        activity: activityResult.rows.map((row) => ({
          id: row.id, action: row.action, description: row.description || "", createdAt: row.created_at,
        })),
      });
    } catch (error) { return handleError(res, error, "No fue posible cargar el inicio del asesor"); }
  });

  router.get("/processes", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.*, u.nombre AS solicitante_nombre, u.correo AS solicitante_correo,
               u.perfil AS solicitante_perfil, u.telefono AS solicitante_telefono,
               u.ciudad AS solicitante_ciudad, u.pais AS solicitante_pais
        FROM tramite t JOIN usuario u ON u.id_usuario = t.id_usuario
        WHERE t.id_asesor = $1
        ORDER BY t.updated_at DESC NULLS LAST, t.id_tramite DESC
      `, [req.auth.id_usuario]);
      return res.json({ processes: result.rows.map(presentProcess) });
    } catch (error) { return handleError(res, error, "No fue posible cargar las solicitudes"); }
  });

  router.get("/processes/:id", async (req, res) => {
    const processId = Number(req.params.id);
    if (!Number.isInteger(processId) || processId <= 0) return res.status(400).json({ error: "Solicitud inválida" });
    try {
      const result = await pool.query(`
        SELECT t.*, u.nombre AS solicitante_nombre, u.correo AS solicitante_correo,
               u.perfil AS solicitante_perfil, u.telefono AS solicitante_telefono,
               u.ciudad AS solicitante_ciudad, u.pais AS solicitante_pais
        FROM tramite t JOIN usuario u ON u.id_usuario = t.id_usuario
        WHERE t.id_tramite = $1 AND t.id_asesor = $2 LIMIT 1
      `, [processId, req.auth.id_usuario]);
      if (!result.rows.length) return res.status(404).json({ error: "Solicitud no encontrada" });
      const process = presentProcess(result.rows[0]);
      const [documents, ds160, interviews, history] = await Promise.all([
        documentService.listDocuments({ advisorId: req.auth.id_usuario }),
        pool.query(`SELECT f.id_formulario AS id, f.id_usuario, f.datos, f.seccion_actual,
          f.completado, f.estado_revision, f.feedback_revision, f.updated_at,
          u.nombre, u.correo, u.perfil FROM formulario_ds160 f
          JOIN usuario u ON u.id_usuario = f.id_usuario WHERE f.id_usuario = $1
          ORDER BY f.updated_at DESC LIMIT 1`, [process.solicitante.id]),
        interviewService.listUserSessions(process.solicitante.id),
        historyService.listByProcess(processId),
      ]);
      return res.json({
        process,
        documents: documents.filter((item) => item.usuario_id === process.solicitante.id),
        ds160: ds160.rows[0] ? normalizeDs160(ds160.rows[0]) : null,
        interviews,
        history,
      });
    } catch (error) { return handleError(res, error, "No fue posible cargar el detalle de la solicitud"); }
  });

  router.put("/processes/:id", async (req, res) => {
    const processId = Number(req.params.id);
    const { estado, etapaActual } = req.body || {};
    if (!Number.isInteger(processId) || processId <= 0) return res.status(400).json({ error: "Solicitud inválida" });
    if (!VALID_PROCESS_STATES.has(estado) || !Object.hasOwn(PROCESS_STAGES, etapaActual)) {
      return res.status(400).json({ error: "Estado o etapa inválidos" });
    }
    try {
      const currentResult = await pool.query(
        "SELECT * FROM tramite WHERE id_tramite = $1 AND id_asesor = $2 LIMIT 1",
        [processId, req.auth.id_usuario]
      );
      const current = currentResult.rows[0];
      if (!current) return res.status(404).json({ error: "Solicitud no encontrada" });
      const result = await pool.query(`
        UPDATE tramite SET estado = $1, etapa_actual = $2, progreso = $3,
          siguiente_paso = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id_tramite = $5 AND id_asesor = $6 RETURNING *
      `, [estado, etapaActual, PROCESS_STAGES[etapaActual], etapaActual === "Completado" ? "Proceso completado" : `Continuar con ${etapaActual}`, processId, req.auth.id_usuario]);
      const updated = result.rows[0];
      await historyService.recordChanges({
        processId,
        changedBy: req.auth.id_usuario,
        changes: [
          historyService.buildChange("estado", current.estado, updated.estado),
          historyService.buildChange("etapa_actual", current.etapa_actual, updated.etapa_actual),
          historyService.buildChange("progreso", current.progreso, updated.progreso),
        ],
      });
      if (current.estado !== updated.estado) {
        await notificacionService?.crearNotificacion({
          userId: updated.id_usuario,
          titulo: "Estado de trámite actualizado",
          mensaje: `Tu trámite cambió a ${updated.estado}.`,
          tipo: "info",
          etapaRelacionada: `tramite-${processId}-estado`,
        });
      }
      if (current.etapa_actual !== updated.etapa_actual) {
        await notificacionService?.notificarCambioEtapa(
          updated.id_usuario, updated.etapa_actual, `Nueva etapa: ${updated.etapa_actual}`,
          `Tu trámite avanzó a la etapa: ${updated.etapa_actual}.`
        );
      }
      await logAdvisorAction(req, { userId: updated.id_usuario, action: "advisor.process_updated", entityType: "tramite", entityId: processId, description: `Solicitud actualizada: ${estado} · ${etapaActual}` });
      const owner = await pool.query("SELECT nombre, correo, perfil FROM usuario WHERE id_usuario = $1", [updated.id_usuario]);
      return res.json({ process: presentProcess({ ...updated, solicitante_nombre: owner.rows[0].nombre, solicitante_correo: owner.rows[0].correo, solicitante_perfil: owner.rows[0].perfil }) });
    } catch (error) { return handleError(res, error, "No fue posible actualizar la solicitud"); }
  });

  router.get("/documents", async (req, res) => {
    try { return res.json({ documents: await documentService.listDocuments({ advisorId: req.auth.id_usuario }) }); }
    catch (error) { return handleError(res, error, "No fue posible cargar los documentos"); }
  });

  router.put("/documents/:id", async (req, res) => {
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) return res.status(400).json({ error: "Documento inválido" });
    try {
      const document = await documentService.updateDocumentStatus(documentId, {
        status: req.body?.status,
        feedback: req.body?.feedback,
      }, { advisorId: req.auth.id_usuario });
      const approved = document.estado === "approved";
      await notificacionService?.crearNotificacion({
        userId: document.usuario_id,
        titulo: approved ? "Documento aprobado" : "Documento requiere correcciones",
        mensaje: approved ? `Tu ${document.nombre} fue aprobado.` : `Tu ${document.nombre} requiere correcciones. Revisa las observaciones de tu asesor.`,
        tipo: "documento",
        etapaRelacionada: document.documento_key || `documento-${document.id}`,
      });
      await logAdvisorAction(req, { userId: document.usuario_id, action: "advisor.document_reviewed", entityType: "documento", entityId: document.id, description: `${document.nombre}: ${document.estado}` });
      return res.json({ document });
    } catch (error) { return handleError(res, error, "No fue posible revisar el documento"); }
  });

  router.get("/ds160", async (req, res) => {
    try {
      const result = await pool.query(`SELECT f.id_formulario AS id, f.id_usuario, f.datos,
        f.seccion_actual, f.completado, f.estado_revision, f.feedback_revision, f.updated_at,
        u.nombre, u.correo, u.perfil FROM formulario_ds160 f
        JOIN usuario u ON u.id_usuario = f.id_usuario
        JOIN tramite t ON t.id_usuario = f.id_usuario
        WHERE t.id_asesor = $1 ORDER BY f.updated_at DESC, f.id_formulario DESC`, [req.auth.id_usuario]);
      return res.json({ forms: result.rows.map(normalizeDs160) });
    } catch (error) { return handleError(res, error, "No fue posible cargar los formularios DS-160"); }
  });

  router.put("/ds160/:id", async (req, res) => {
    const formId = Number(req.params.id);
    const { status, feedback = "" } = req.body || {};
    if (!Number.isInteger(formId) || formId <= 0 || !VALID_DS160_STATES.has(status)) return res.status(400).json({ error: "Formulario o estado inválido" });
    try {
      const result = await pool.query(`UPDATE formulario_ds160 f SET estado_revision = $1,
        feedback_revision = $2, updated_at = CURRENT_TIMESTAMP
        WHERE f.id_formulario = $3 AND EXISTS (SELECT 1 FROM tramite t
          WHERE t.id_usuario = f.id_usuario AND t.id_asesor = $4)
        RETURNING f.id_usuario`, [status, String(feedback).trim() || null, formId, req.auth.id_usuario]);
      if (!result.rows.length) return res.status(404).json({ error: "Formulario no encontrado" });
      await notificacionService?.crearNotificacion({
        userId: result.rows[0].id_usuario,
        titulo: status === "aprobado" ? "Formulario DS-160 aprobado" : "Revisión de formulario DS-160",
        mensaje: status === "aprobado" ? "Tu formulario DS-160 fue aprobado por tu asesor." : "Tu asesor actualizó la revisión de tu formulario DS-160.",
        tipo: "info", etapaRelacionada: `ds160-${formId}`,
      });
      await logAdvisorAction(req, { userId: result.rows[0].id_usuario, action: "advisor.ds160_reviewed", entityType: "formulario_ds160", entityId: formId, description: `DS-160 actualizado: ${status}` });
      return res.json({ message: "Formulario actualizado correctamente" });
    } catch (error) { return handleError(res, error, "No fue posible revisar el formulario"); }
  });

  router.get("/interviews", async (req, res) => {
    try { return res.json({ sessions: await interviewService.listSessions({ advisorId: req.auth.id_usuario }) }); }
    catch (error) { return handleError(res, error, "No fue posible cargar las entrevistas"); }
  });

  router.put("/interviews/:id/feedback", async (req, res) => {
    try {
      const session = await interviewService.updateFeedback(req.params.id, req.body, { advisorId: req.auth.id_usuario });
      await notificacionService?.crearNotificacion({
        userId: session.user_id, titulo: "Retroalimentación de entrevista disponible",
        mensaje: "Tu asesor revisó tu simulación de entrevista.", tipo: "info", etapaRelacionada: `entrevista-${session.id}`,
      });
      await logAdvisorAction(req, { userId: session.user_id, action: "advisor.interview_reviewed", entityType: "interview_session", entityId: session.id, description: "Entrevista revisada" });
      return res.json({ session });
    } catch (error) { return handleError(res, error, "No fue posible guardar la retroalimentación"); }
  });

  router.get("/conversations", async (req, res) => {
    try { return res.json({ conversations: await communicationService.listConversations(req.auth.id_usuario) }); }
    catch (error) { return handleError(res, error, "No fue posible cargar las conversaciones"); }
  });
  router.get("/conversations/:userId/messages", async (req, res) => {
    try { return res.json(await communicationService.listMessages(req.auth.id_usuario, req.params.userId, "advisor", req.query)); }
    catch (error) { return handleError(res, error, "No fue posible cargar los mensajes"); }
  });
  router.post("/conversations/:userId/messages", async (req, res) => {
    try {
      const message = await communicationService.sendMessage({ advisorId: req.auth.id_usuario, userId: req.params.userId, senderRole: "advisor", message: req.body?.message });
      return res.status(201).json({ message });
    } catch (error) { return handleError(res, error, "No fue posible enviar el mensaje"); }
  });

  router.get("/tasks", async (req, res) => {
    try { return res.json({ tasks: await communicationService.listTasks(req.auth.id_usuario) }); }
    catch (error) { return handleError(res, error, "No fue posible cargar las tareas"); }
  });
  router.post("/tasks", async (req, res) => {
    try { return res.status(201).json({ task: await communicationService.createTask(req.auth.id_usuario, req.body) }); }
    catch (error) { return handleError(res, error, "No fue posible crear la tarea"); }
  });
  router.put("/tasks/:id", async (req, res) => {
    try { return res.json({ task: await communicationService.updateTask(req.auth.id_usuario, req.params.id, req.body) }); }
    catch (error) { return handleError(res, error, "No fue posible actualizar la tarea"); }
  });
  router.delete("/tasks/:id", async (req, res) => {
    try { await communicationService.deleteTask(req.auth.id_usuario, req.params.id); return res.json({ message: "Tarea eliminada" }); }
    catch (error) { return handleError(res, error, "No fue posible eliminar la tarea"); }
  });

  router.get("/questions", async (_req, res) => {
    try { return res.json({ questions: await questionService.listQuestions({ includeInactive: true }) }); }
    catch (error) { return handleError(res, error, "No fue posible cargar las preguntas"); }
  });
  router.post("/questions", async (req, res) => {
    try { return res.status(201).json({ question: await questionService.createQuestion(req.body) }); }
    catch (error) { return handleError(res, error, "No fue posible crear la pregunta"); }
  });
  router.put("/questions/:id", async (req, res) => {
    try { return res.json({ question: await questionService.updateQuestion(req.params.id, req.body) }); }
    catch (error) { return handleError(res, error, "No fue posible actualizar la pregunta"); }
  });
  router.patch("/questions/:id/status", async (req, res) => {
    try { return res.json({ question: await questionService.setQuestionActive(req.params.id, req.body?.activo) }); }
    catch (error) { return handleError(res, error, "No fue posible cambiar el estado de la pregunta"); }
  });

  router.get("/profile", async (req, res) => {
    try {
      const result = await pool.query("SELECT id_usuario, nombre, correo, telefono, ciudad, pais, rol FROM usuario WHERE id_usuario = $1", [req.auth.id_usuario]);
      return res.json({ user: result.rows[0] || null });
    } catch (error) { return handleError(res, error, "No fue posible cargar el perfil"); }
  });
  router.put("/profile", async (req, res) => {
    const { nombre, telefono = "", ciudad = "", pais = "" } = req.body || {};
    if (!String(nombre || "").trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
    try {
      const result = await pool.query(`UPDATE usuario SET nombre = $1, telefono = $2, ciudad = $3,
        pais = $4, updated_at = CURRENT_TIMESTAMP WHERE id_usuario = $5
        RETURNING id_usuario, nombre, correo, telefono, ciudad, pais, rol`,
      [String(nombre).trim(), String(telefono).trim(), String(ciudad).trim(), String(pais).trim(), req.auth.id_usuario]);
      return res.json({ user: result.rows[0] });
    } catch (error) { return handleError(res, error, "No fue posible actualizar el perfil"); }
  });

  return router;
};
