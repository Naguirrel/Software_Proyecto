const express = require("express");
const createProcessChangeHistoryService = require("../services/processChangeHistoryService");
const createAdvisorAssignmentService = require("../services/advisorAssignmentService");

const VALID_STATES = new Set(["En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"]);
const STAGES = {
  "Configuración de perfil": 0,
  "Formulario DS-160": 17,
  "Pago de visa": 34,
  "Cita consular": 51,
  Entrevista: 67,
  "Decisión final": 84,
  Completado: 100,
};

const DS160_TOTAL_SECTIONS = 10;
const DS160_SUMMARY_FIELDS = [
  ["nombres", "Nombres"],
  ["apellidos", "Apellidos"],
  ["fechaNacimiento", "Fecha de nacimiento"],
  ["paisNacimiento", "Pais de nacimiento"],
  ["numeroPasaporte", "Pasaporte"],
  ["fechaExpiracion", "Vencimiento de pasaporte"],
  ["proposito", "Proposito del viaje"],
  ["fechaViaje", "Fecha tentativa de viaje"],
  ["ocupacion", "Ocupacion"],
  ["visaAnterior", "Visa anterior"],
  ["visaRechazada", "Visa rechazada"],
];

function parseJsonValue(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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
    },
    asesor: row.id_asesor
      ? { id: row.id_asesor, nombre: row.asesor_nombre, correo: row.asesor_correo }
      : null,
  };
}

function presentApplicant(row) {
  return {
    id: row.id_usuario,
    nombre: row.solicitante_nombre,
    correo: row.solicitante_correo,
    perfil: row.solicitante_perfil || "Sin definir",
    telefono: row.solicitante_telefono || "",
    ciudad: row.solicitante_ciudad || "",
    pais: row.solicitante_pais || "",
    createdAt: row.solicitante_created_at || null,
  };
}

function presentDs160(row) {
  if (!row) return null;

  const datos = parseJsonValue(row.datos, {});
  const seccionActual = Number(row.seccion_actual) || 1;
  const completado = Boolean(row.completado);
  const progreso = completado
    ? 100
    : Math.min(100, Math.round((seccionActual / DS160_TOTAL_SECTIONS) * 100));

  return {
    id: row.id_formulario,
    seccionActual,
    completado,
    progreso,
    estadoRevision: row.estado_revision || "en_progreso",
    feedbackRevision: row.feedback_revision || "",
    updatedAt: row.updated_at || null,
    resumen: DS160_SUMMARY_FIELDS
      .map(([key, label]) => ({ key, label, value: datos[key] || "" }))
      .filter((item) => String(item.value).trim()),
  };
}

function presentDocument(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    archivo_url: row.storage_key ? `/documentos/${row.id}/archivo` : row.archivo_url,
    documento_key: row.documento_key,
    estado: row.estado,
    feedback: row.feedback || "",
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
  };
}

function buildAudioRoute(sessionId, questionId) {
  return `/interview-sessions/${sessionId}/audio/${encodeURIComponent(questionId)}`;
}

function presentInterviewSession(row) {
  const responses = parseJsonValue(row.responses, []).map((response) => {
    if (!response.audio?.key) return response;

    return {
      ...response,
      audio: {
        ...response.audio,
        url: buildAudioRoute(row.id, response.id),
      },
    };
  });

  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    status: row.status,
    responses,
    feedback: row.feedback || "",
    rating: row.rating,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
  };
}

function presentNotification(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    mensaje: row.mensaje,
    tipo: row.tipo,
    leido: Boolean(row.leido),
    etapaRelacionada: row.etapa_relacionada || "",
    createdAt: row.created_at || null,
  };
}

async function notifyProcessUpdates(notificacionService, { processId, userId, previous, next }) {
  if (!notificacionService || !userId) return;

  const tasks = [];

  if (previous.estado !== next.estado) {
    tasks.push(notificacionService.crearNotificacion({
      userId,
      titulo: "Estado de tramite actualizado",
      mensaje: `Tu tramite cambio a ${next.estado}.`,
      tipo: "info",
      etapaRelacionada: `tramite-${processId}-estado-${next.estado}`,
    }));
  }

  if (previous.etapa_actual !== next.etapa_actual) {
    tasks.push(notificacionService.notificarCambioEtapa(
      userId,
      next.etapa_actual,
      `Nueva etapa: ${next.etapa_actual}`,
      `Tu tramite avanzo a la etapa: ${next.etapa_actual}.`
    ));
  }

  if (previous.id_asesor !== next.id_asesor && next.id_asesor) {
    tasks.push(notificacionService.crearNotificacion({
      userId,
      titulo: "Asesor asignado",
      mensaje: "Se te asigno un asesor para acompanar tu tramite.",
      tipo: "info",
      etapaRelacionada: `tramite-${processId}-asesor`,
    }));
  }

  await Promise.all(tasks.map((task) => task.catch((error) => {
    console.error("ERROR ADMIN PROCESS NOTIFICATION:", error);
  })));
}

module.exports = function createAdminProcessRoutes(pool, { requireAdmin, schemaReady, notificacionService, activityLogService }) {
  const router = express.Router();
  const processHistoryService = createProcessChangeHistoryService(pool);
  const advisorAssignmentService = createAdvisorAssignmentService(pool);

  router.use(requireAdmin);

  router.get("/", async (_req, res) => {
    try {
      await schemaReady;
      const [processResult, advisorResult] = await Promise.all([
        pool.query(`
          SELECT t.*, applicant.nombre AS solicitante_nombre,
                 applicant.correo AS solicitante_correo,
                 applicant.perfil AS solicitante_perfil,
                 advisor.nombre AS asesor_nombre,
                 advisor.correo AS asesor_correo
          FROM tramite t
          JOIN usuario applicant ON applicant.id_usuario = t.id_usuario
          LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
          ORDER BY t.id_tramite DESC
        `),
        pool.query(`
          SELECT advisor.id_usuario AS id, advisor.nombre, advisor.correo,
                 advisor.capacidad_asesor AS capacidad,
                 advisor.disponible_asesor AS disponible,
                 (SELECT COUNT(*)::int FROM tramite assigned
                  WHERE assigned.id_asesor = advisor.id_usuario) AS asignados
          FROM usuario advisor
          WHERE advisor.rol = 'asesor' AND advisor.activo = TRUE
          ORDER BY nombre
        `),
      ]);

      res.json({
        tramites: processResult.rows.map(presentProcess),
        asesores: advisorResult.rows,
      });
    } catch (error) {
      console.error("ERROR ADMIN PROCESSES:", error);
      res.status(500).json({ error: "No fue posible cargar los trámites" });
    }
  });

  router.get("/:id/history", async (req, res) => {
    const processId = Number(req.params.id);

    if (!Number.isInteger(processId) || processId <= 0) {
      return res.status(400).json({ error: "Trámite inválido" });
    }

    try {
      await schemaReady;

      const processResult = await pool.query(
        `SELECT id_tramite
         FROM tramite
         WHERE id_tramite = $1
         LIMIT 1`,
        [processId]
      );
      if (!processResult.rows.length) return res.status(404).json({ error: "Trámite no encontrado" });

      const history = await processHistoryService.listByProcess(processId);
      return res.json({ history });
    } catch (error) {
      console.error("ERROR ADMIN PROCESS HISTORY:", error);
      return res.status(500).json({ error: "No fue posible cargar el historial del trámite" });
    }
  });

  router.get("/:id", async (req, res) => {
    const processId = Number(req.params.id);

    if (!Number.isInteger(processId) || processId <= 0) {
      return res.status(400).json({ error: "TrÃ¡mite invÃ¡lido" });
    }

    try {
      await schemaReady;

      const processResult = await pool.query(`
        SELECT t.*, applicant.nombre AS solicitante_nombre,
               applicant.correo AS solicitante_correo,
               applicant.perfil AS solicitante_perfil,
               applicant.telefono AS solicitante_telefono,
               applicant.ciudad AS solicitante_ciudad,
               applicant.pais AS solicitante_pais,
               applicant.created_at AS solicitante_created_at,
               advisor.nombre AS asesor_nombre,
               advisor.correo AS asesor_correo
        FROM tramite t
        JOIN usuario applicant ON applicant.id_usuario = t.id_usuario
        LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
        WHERE t.id_tramite = $1
        LIMIT 1
      `, [processId]);

      const process = processResult.rows[0];
      if (!process) return res.status(404).json({ error: "TrÃ¡mite no encontrado" });

      const userId = process.id_usuario;
      const [ds160Result, documentsResult, interviewsResult, notificationsResult] = await Promise.all([
        pool.query(`
          SELECT id_formulario, id_usuario, datos, seccion_actual, completado,
                 estado_revision, feedback_revision, created_at, updated_at
          FROM formulario_ds160
          WHERE id_usuario = $1
          ORDER BY updated_at DESC, id_formulario DESC
          LIMIT 1
        `, [userId]),
        pool.query(`
          SELECT id, nombre, tipo, archivo_url, documento_key, estado, feedback,
                 storage_key, creado_en, actualizado_en
          FROM documentos
          WHERE usuario_id = $1
          ORDER BY actualizado_en DESC, creado_en DESC
        `, [userId]),
        pool.query(`
          SELECT id, user_id, user_name, user_email, status, responses,
                 feedback, rating, created_at, reviewed_at
          FROM interview_sessions
          WHERE user_id = $1
          ORDER BY created_at DESC, id DESC
        `, [userId]),
        pool.query(`
          SELECT id, titulo, mensaje, tipo, leido, etapa_relacionada, created_at
          FROM notificaciones
          WHERE id_usuario = $1
          ORDER BY created_at DESC, id DESC
          LIMIT 8
        `, [userId]),
      ]);

      return res.json({
        tramite: presentProcess(process),
        solicitante: presentApplicant(process),
        ds160: presentDs160(ds160Result.rows[0]),
        documentos: documentsResult.rows.map(presentDocument),
        entrevistas: interviewsResult.rows.map(presentInterviewSession),
        notificaciones: notificationsResult.rows.map(presentNotification),
      });
    } catch (error) {
      console.error("ERROR ADMIN PROCESS DETAIL:", error);
      return res.status(500).json({ error: "No fue posible cargar el detalle del trÃ¡mite" });
    }
  });

  router.put("/:id", async (req, res) => {
    const processId = Number(req.params.id);
    const { estado, etapaActual, asesorId, expectedUpdatedAt } = req.body || {};

    if (!Number.isInteger(processId) || processId <= 0) {
      return res.status(400).json({ error: "Trámite inválido" });
    }
    if (!VALID_STATES.has(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }
    if (!Object.prototype.hasOwnProperty.call(STAGES, etapaActual)) {
      return res.status(400).json({ error: "Etapa inválida" });
    }

    const normalizedAdvisorId = asesorId === null || asesorId === "" ? null : Number(asesorId);
    if (normalizedAdvisorId !== null && (!Number.isInteger(normalizedAdvisorId) || normalizedAdvisorId <= 0)) {
      return res.status(400).json({ error: "Asesor inválido" });
    }

    try {
      await schemaReady;
      const update = await advisorAssignmentService.updateProcess({
        processId,
        state: estado,
        stage: etapaActual,
        progress: STAGES[etapaActual],
        advisorId: normalizedAdvisorId,
        changedBy: req.auth?.id_usuario || null,
        expectedUpdatedAt,
      });
      const currentProcess = update.previous;
      const refreshedProcess = update.process;

      await notifyProcessUpdates(notificacionService, {
        processId,
        userId: refreshedProcess.id_usuario || currentProcess.id_usuario,
        previous: currentProcess,
        next: {
          estado: refreshedProcess.estado,
          etapa_actual: refreshedProcess.etapa_actual,
          id_asesor: refreshedProcess.id_asesor,
        },
      });
      await activityLogService?.logActivity({
        req,
        actor: req.auth,
        userId: refreshedProcess.id_usuario || currentProcess.id_usuario,
        adminId: req.auth?.id_usuario,
        userEmail: req.auth?.correo,
        role: req.auth?.rol || "admin",
        action: "process.admin_updated",
        entityType: "tramite",
        entityId: processId,
        description: "Trámite actualizado por administrador",
        metadata: {
          estado: refreshedProcess.estado,
          etapaActual: refreshedProcess.etapa_actual,
          asesorId: refreshedProcess.id_asesor,
        },
      });

      res.json({ message: "Trámite actualizado correctamente", tramite: presentProcess(refreshedProcess) });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error("ERROR UPDATE ADMIN PROCESS:", error);
      res.status(500).json({ error: "No fue posible actualizar el trámite" });
    }
  });

  return router;
};
