const CATEGORIES = new Set([
  "mistreatment",
  "poor_communication",
  "lack_of_follow_up",
  "conflict",
  "other",
]);
const DECISIONS = new Set(["approved", "rejected"]);

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function positiveId(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw httpError(`${label} inválido`, 400);
  return parsed;
}

function normalizeRequest(payload = {}) {
  const category = String(payload.category || "").trim();
  const message = String(payload.message || "").trim().replace(/\s+/g, " ");
  if (!CATEGORIES.has(category)) throw httpError("Selecciona un motivo válido", 400);
  if (message.length < 20 || message.length > 2000) {
    throw httpError("La explicación debe tener entre 20 y 2000 caracteres", 400);
  }
  return { category, message };
}

function normalizeResolution(payload = {}) {
  const decision = String(payload.decision || "").trim();
  const resolution = String(payload.resolution || "").trim().replace(/\s+/g, " ");
  if (!DECISIONS.has(decision)) throw httpError("La decisión debe ser aprobar o rechazar", 400);
  if (resolution.length < 10 || resolution.length > 2000) {
    throw httpError("La resolución debe tener entre 10 y 2000 caracteres", 400);
  }
  const newAdvisorId = decision === "approved"
    ? positiveId(payload.newAdvisorId, "Nuevo asesor")
    : null;
  return { decision, resolution, newAdvisorId };
}

function present(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    applicantName: row.applicant_name || "",
    applicantEmail: row.applicant_email || "",
    applicantAvatarVersion: row.applicant_avatar_updated_at
      ? new Date(row.applicant_avatar_updated_at).getTime()
      : null,
    category: row.category,
    message: row.message,
    status: row.status,
    resolution: row.resolution || "",
    currentAdvisor: {
      id: Number(row.current_advisor_id),
      name: row.current_advisor_name || "",
      email: row.current_advisor_email || "",
      avatarVersion: row.current_advisor_avatar_updated_at
        ? new Date(row.current_advisor_avatar_updated_at).getTime()
        : null,
    },
    newAdvisor: row.new_advisor_id ? {
      id: Number(row.new_advisor_id),
      name: row.new_advisor_name || "",
      email: row.new_advisor_email || "",
      avatarVersion: row.new_advisor_avatar_updated_at
        ? new Date(row.new_advisor_avatar_updated_at).getTime()
        : null,
    } : null,
    reviewedBy: row.reviewed_by ? {
      id: Number(row.reviewed_by),
      name: row.reviewer_name || "",
    } : null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REQUEST_SELECT = `
  SELECT request.*,
         applicant.nombre AS applicant_name, applicant.correo AS applicant_email,
         applicant.avatar_updated_at AS applicant_avatar_updated_at,
         current_advisor.nombre AS current_advisor_name,
         current_advisor.correo AS current_advisor_email,
         current_advisor.avatar_updated_at AS current_advisor_avatar_updated_at,
         new_advisor.nombre AS new_advisor_name,
         new_advisor.correo AS new_advisor_email,
         new_advisor.avatar_updated_at AS new_advisor_avatar_updated_at,
         reviewer.nombre AS reviewer_name
  FROM advisor_change_requests request
  JOIN usuario applicant ON applicant.id_usuario = request.user_id
  JOIN usuario current_advisor ON current_advisor.id_usuario = request.current_advisor_id
  LEFT JOIN usuario new_advisor ON new_advisor.id_usuario = request.new_advisor_id
  LEFT JOIN usuario reviewer ON reviewer.id_usuario = request.reviewed_by`;

async function withTransaction(pool, callback) {
  const client = typeof pool.connect === "function" ? await pool.connect() : pool;
  try {
    await client.query("BEGIN");
    const value = await callback(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (rollbackError) {
      console.error("ADVISOR CHANGE ROLLBACK ERROR:", rollbackError);
    }
    throw error;
  } finally {
    client.release?.();
  }
}

function createAdvisorChangeRequestService(pool, { schemaReady = Promise.resolve() } = {}) {
  async function getClientContext(userId) {
    await schemaReady;
    const parsedUserId = positiveId(userId, "Usuario");
    const assignmentResult = await pool.query(
      `SELECT advisor.id_usuario AS id, advisor.nombre, advisor.correo,
              advisor.telefono, advisor.ciudad, advisor.pais, advisor.avatar_updated_at
       FROM tramite process
       LEFT JOIN usuario advisor ON advisor.id_usuario = process.id_asesor
       WHERE process.id_usuario = $1 LIMIT 1`,
      [parsedUserId]
    );
    const advisor = assignmentResult.rows[0]?.id ? {
      id: Number(assignmentResult.rows[0].id),
      name: assignmentResult.rows[0].nombre,
      email: assignmentResult.rows[0].correo,
      phone: assignmentResult.rows[0].telefono || "",
      city: assignmentResult.rows[0].ciudad || "",
      country: assignmentResult.rows[0].pais || "",
      avatarVersion: assignmentResult.rows[0].avatar_updated_at
        ? new Date(assignmentResult.rows[0].avatar_updated_at).getTime()
        : null,
    } : null;
    const requestResult = await pool.query(
      `${REQUEST_SELECT}
       WHERE request.user_id = $1
       ORDER BY CASE request.status WHEN 'pending' THEN 0 ELSE 1 END,
                request.created_at DESC, request.id DESC
       LIMIT 1`,
      [parsedUserId]
    );
    return { advisor, request: present(requestResult.rows[0]) };
  }

  async function createRequest(userId, payload) {
    await schemaReady;
    const parsedUserId = positiveId(userId, "Usuario");
    const data = normalizeRequest(payload);
    return withTransaction(pool, async (client) => {
      const assignment = await client.query(
        `SELECT id_tramite, id_asesor FROM tramite
         WHERE id_usuario = $1 LIMIT 1 FOR UPDATE`,
        [parsedUserId]
      );
      const process = assignment.rows[0];
      if (!process?.id_asesor) throw httpError("Necesitas un asesor asignado para solicitar un cambio", 409);
      const pending = await client.query(
        "SELECT id FROM advisor_change_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1",
        [parsedUserId]
      );
      if (pending.rows.length) throw httpError("Ya tienes una solicitud de cambio pendiente", 409);
      const inserted = await client.query(
        `INSERT INTO advisor_change_requests
          (user_id, current_advisor_id, category, message)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [parsedUserId, process.id_asesor, data.category, data.message]
      );
      const result = await client.query(`${REQUEST_SELECT} WHERE request.id = $1`, [inserted.rows[0].id]);
      return present(result.rows[0]);
    });
  }

  async function listRequests({ status = "pending" } = {}) {
    await schemaReady;
    const normalizedStatus = String(status || "pending").trim();
    if (!["pending", "approved", "rejected", "cancelled", "all"].includes(normalizedStatus)) {
      throw httpError("Estado de solicitud inválido", 400);
    }
    const where = normalizedStatus === "all" ? "" : "WHERE request.status = $1";
    const values = normalizedStatus === "all" ? [] : [normalizedStatus];
    const result = await pool.query(
      `${REQUEST_SELECT} ${where}
       ORDER BY CASE request.status WHEN 'pending' THEN 0 ELSE 1 END,
                request.created_at ASC, request.id ASC`,
      values
    );
    return result.rows.map(present);
  }

  async function resolveRequest(requestId, adminId, payload) {
    await schemaReady;
    const parsedRequestId = positiveId(requestId, "Solicitud");
    const parsedAdminId = positiveId(adminId, "Administrador");
    const data = normalizeResolution(payload);
    return withTransaction(pool, async (client) => {
      const locked = await client.query(
        `SELECT * FROM advisor_change_requests
         WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [parsedRequestId]
      );
      const request = locked.rows[0];
      if (!request) throw httpError("Solicitud no encontrada", 404);
      if (request.status !== "pending") throw httpError("La solicitud ya fue resuelta", 409);

      if (data.decision === "approved") {
        const processResult = await client.query(
          `SELECT id_tramite, id_usuario, id_asesor FROM tramite
           WHERE id_usuario = $1 LIMIT 1 FOR UPDATE`,
          [request.user_id]
        );
        const process = processResult.rows[0];
        if (!process || Number(process.id_asesor) !== Number(request.current_advisor_id)) {
          throw httpError("La asignación cambió desde que se creó la solicitud. Recarga la cola", 409);
        }
        if (Number(data.newAdvisorId) === Number(request.current_advisor_id)) {
          throw httpError("Selecciona un asesor diferente al actual", 400);
        }
        const advisorResult = await client.query(
          `SELECT id_usuario, nombre, activo, disponible_asesor,
                  COALESCE(capacidad_asesor, 50)::int AS capacidad
           FROM usuario
           WHERE id_usuario = $1 AND rol = 'asesor' AND activo = TRUE
           FOR UPDATE`,
          [data.newAdvisorId]
        );
        const advisor = advisorResult.rows[0];
        if (!advisor || advisor.disponible_asesor === false) throw httpError("El asesor seleccionado no está disponible", 409);
        const workload = await client.query(
          "SELECT COUNT(*)::int AS total FROM tramite WHERE id_asesor = $1",
          [data.newAdvisorId]
        );
        if (Number(workload.rows[0]?.total) >= Number(advisor.capacidad)) {
          throw httpError("El asesor seleccionado alcanzó su capacidad máxima", 409);
        }
        await client.query(
          `UPDATE tramite SET id_asesor = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id_tramite = $2`,
          [data.newAdvisorId, process.id_tramite]
        );
        await client.query(
          `INSERT INTO process_change_history
            (process_id, field_name, old_value, new_value, changed_by)
           VALUES ($1, 'id_asesor', $2, $3, $4)`,
          [process.id_tramite, String(request.current_advisor_id), String(data.newAdvisorId), parsedAdminId]
        );
      }

      await client.query(
        `UPDATE advisor_change_requests
         SET status = $1, resolution = $2, reviewed_by = $3,
             reviewed_at = CURRENT_TIMESTAMP, new_advisor_id = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [data.decision, data.resolution, parsedAdminId, data.newAdvisorId, parsedRequestId]
      );
      const result = await client.query(`${REQUEST_SELECT} WHERE request.id = $1`, [parsedRequestId]);
      return present(result.rows[0]);
    });
  }

  return { createRequest, getClientContext, listRequests, resolveRequest };
}

module.exports = { CATEGORIES, DECISIONS, createAdvisorChangeRequestService };
