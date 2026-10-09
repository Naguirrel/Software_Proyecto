const createProcessChangeHistoryService = require("./processChangeHistoryService");

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function withTransaction(pool, callback) {
  const client = typeof pool.connect === "function" ? await pool.connect() : pool;
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ASSIGNMENT ROLLBACK ERROR:", rollbackError);
    }
    throw error;
  } finally {
    client.release?.();
  }
}

function createAdvisorAssignmentService(pool) {
  async function getAvailableAdvisor(client, advisorId) {
    const advisorResult = await client.query(
      `SELECT id_usuario, nombre, activo, disponible_asesor,
              COALESCE(capacidad_asesor, 50)::int AS capacidad
       FROM usuario
       WHERE id_usuario = $1 AND rol = 'asesor' AND activo = TRUE
       FOR UPDATE`,
      [advisorId]
    );
    const advisor = advisorResult.rows[0];
    if (!advisor || advisor.activo === false) throw httpError("Asesor no disponible", 400);
    if (advisor.disponible_asesor === false) throw httpError("El asesor no está disponible para nuevas asignaciones", 409);
    const assignedResult = await client.query(
      "SELECT COUNT(*)::int AS asignados FROM tramite WHERE id_asesor = $1",
      [advisorId]
    );
    advisor.asignados = Number(assignedResult.rows[0]?.asignados) || 0;
    if (Number(advisor.asignados) >= Number(advisor.capacidad)) {
      throw httpError("El asesor alcanzó su capacidad máxima", 409);
    }
    return advisor;
  }

  async function assignUnassigned({ processId, advisorId, changedBy }) {
    return withTransaction(pool, async (client) => {
      const currentResult = await client.query(
        `SELECT id_tramite, id_usuario, id_asesor FROM tramite
         WHERE id_tramite = $1 LIMIT 1 FOR UPDATE`,
        [processId]
      );
      const current = currentResult.rows[0];
      if (!current || current.id_asesor !== null) {
        throw httpError("El trámite ya fue asignado o no existe", 409);
      }
      // Toda mutación toma primero el bloqueo del trámite y luego el del asesor.
      // Este orden común evita interbloqueos con la edición administrativa.
      const advisor = await getAvailableAdvisor(client, advisorId);

      const result = await client.query(
        `UPDATE tramite SET id_asesor = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id_tramite = $2 AND id_asesor IS NULL
         RETURNING id_tramite, id_usuario, id_asesor, updated_at`,
        [advisorId, processId]
      );
      if (!result.rows.length) throw httpError("El trámite ya fue asignado o no existe", 409);

      const historyService = createProcessChangeHistoryService(client);
      await historyService.recordChanges({
        processId,
        changedBy,
        changes: [historyService.buildChange("id_asesor", current.id_asesor, advisorId)],
      });

      return { advisor, process: result.rows[0] };
    });
  }

  async function updateProcess({ processId, state, stage, progress, advisorId, changedBy, expectedUpdatedAt }) {
    return withTransaction(pool, async (client) => {
      const currentResult = await client.query(
        `SELECT id_tramite, id_usuario, estado, etapa_actual, id_asesor, updated_at
         FROM tramite
         WHERE id_tramite = $1
         LIMIT 1
         FOR UPDATE`,
        [processId]
      );
      const current = currentResult.rows[0];
      if (!current) throw httpError("Trámite no encontrado", 404);

      if (expectedUpdatedAt && current.updated_at
          && new Date(expectedUpdatedAt).getTime() !== new Date(current.updated_at).getTime()) {
        throw httpError("El trámite cambió mientras lo editabas. Recarga los datos e inténtalo de nuevo", 409);
      }

      if (advisorId !== null && Number(current.id_asesor) !== Number(advisorId)) {
        await getAvailableAdvisor(client, advisorId);
      }

      const result = await client.query(
        `UPDATE tramite
         SET estado = $1, etapa_actual = $2, progreso = $3, id_asesor = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_tramite = $5
         RETURNING id_tramite`,
        [state, stage, progress, advisorId, processId]
      );
      if (!result.rows.length) throw httpError("Trámite no encontrado", 404);

      const refreshed = await client.query(
        `SELECT t.*, applicant.nombre AS solicitante_nombre,
                applicant.correo AS solicitante_correo,
                applicant.perfil AS solicitante_perfil,
                advisor.nombre AS asesor_nombre,
                advisor.correo AS asesor_correo
         FROM tramite t
         JOIN usuario applicant ON applicant.id_usuario = t.id_usuario
         LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
         WHERE t.id_tramite = $1`,
        [processId]
      );
      const next = refreshed.rows[0];

      const historyService = createProcessChangeHistoryService(client);
      await historyService.recordChanges({
        processId,
        changedBy,
        changes: [
          historyService.buildChange("estado", current.estado, next.estado),
          historyService.buildChange("etapa_actual", current.etapa_actual, next.etapa_actual),
          historyService.buildChange("id_asesor", current.id_asesor, next.id_asesor),
        ],
      });

      return { previous: current, process: next };
    });
  }

  return { assignUnassigned, updateProcess };
}

module.exports = createAdvisorAssignmentService;
