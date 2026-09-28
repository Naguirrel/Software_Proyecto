function toPositiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} inválido`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function normalizeMessage(value) {
  const message = String(value || "").trim();
  if (!message) {
    const error = new Error("El mensaje es obligatorio");
    error.statusCode = 400;
    throw error;
  }
  if (message.length > 4000) {
    const error = new Error("El mensaje no puede superar 4000 caracteres");
    error.statusCode = 400;
    throw error;
  }
  return message;
}

function presentMessage(row) {
  return {
    id: row.id,
    advisorId: row.advisor_id,
    userId: row.user_id,
    sender: row.sender_role,
    message: row.message,
    createdAt: row.created_at,
    readAt: row.read_at || null,
  };
}

function presentTask(row) {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    priority: row.priority,
    status: row.status,
    userId: row.user_id || null,
    applicantName: row.applicant_name || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = function createAdvisorCommunicationService(pool) {
  let schemaPromise;

  function ensureSchema() {
    if (!schemaPromise) {
      schemaPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS advisor_chat_messages (
            id SERIAL PRIMARY KEY,
            advisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
            user_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
            sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('advisor', 'client')),
            message TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMP
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS advisor_chat_conversation_idx
          ON advisor_chat_messages(advisor_id, user_id, created_at, id)
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS advisor_tasks (
            id SERIAL PRIMARY KEY,
            advisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
            user_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
            title VARCHAR(240) NOT NULL,
            due_at TIMESTAMP,
            priority VARCHAR(20) NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('normal', 'high')),
            status VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'completed')),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS advisor_tasks_owner_idx
          ON advisor_tasks(advisor_id, status, due_at, id)
        `);
      })();
    }
    return schemaPromise;
  }

  async function getAssignment(advisorId, userId) {
    const normalizedAdvisorId = toPositiveInteger(advisorId, "Asesor");
    const normalizedUserId = toPositiveInteger(userId, "Solicitante");
    const result = await pool.query(
      `SELECT t.id_tramite, t.id_usuario, t.id_asesor, t.etapa_actual, t.estado,
              u.nombre AS user_name, u.correo AS user_email, u.perfil,
              advisor.nombre AS advisor_name, advisor.correo AS advisor_email
       FROM tramite t
       JOIN usuario u ON u.id_usuario = t.id_usuario
       JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
       WHERE t.id_asesor = $1 AND t.id_usuario = $2
       LIMIT 1`,
      [normalizedAdvisorId, normalizedUserId]
    );
    if (!result.rows.length) {
      const error = new Error("Solicitud no asignada a este asesor");
      error.statusCode = 404;
      throw error;
    }
    return result.rows[0];
  }

  async function getClientAssignment(userId) {
    const normalizedUserId = toPositiveInteger(userId, "Solicitante");
    const result = await pool.query(
      `SELECT t.id_tramite, t.id_usuario, t.id_asesor, t.etapa_actual, t.estado,
              u.nombre AS user_name, u.correo AS user_email, u.perfil,
              advisor.nombre AS advisor_name, advisor.correo AS advisor_email
       FROM tramite t
       JOIN usuario u ON u.id_usuario = t.id_usuario
       LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
       WHERE t.id_usuario = $1
       LIMIT 1`,
      [normalizedUserId]
    );
    return result.rows[0] || null;
  }

  async function listConversations(advisorId) {
    await ensureSchema();
    const normalizedAdvisorId = toPositiveInteger(advisorId, "Asesor");
    const result = await pool.query(
      `SELECT u.id_usuario AS user_id, u.nombre, u.correo, u.perfil,
              t.etapa_actual, t.estado,
              latest.message AS last_message, latest.created_at AS last_message_at,
              COALESCE(unread.total, 0)::int AS unread_count
       FROM tramite t
       JOIN usuario u ON u.id_usuario = t.id_usuario
       LEFT JOIN LATERAL (
         SELECT message, created_at
         FROM advisor_chat_messages
         WHERE advisor_id = t.id_asesor AND user_id = t.id_usuario
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       ) latest ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total
         FROM advisor_chat_messages
         WHERE advisor_id = t.id_asesor AND user_id = t.id_usuario
           AND sender_role = 'client' AND read_at IS NULL
       ) unread ON TRUE
       WHERE t.id_asesor = $1
       ORDER BY latest.created_at DESC NULLS LAST, u.nombre`,
      [normalizedAdvisorId]
    );
    return result.rows.map((row) => ({
      userId: row.user_id,
      name: row.nombre,
      email: row.correo,
      profile: row.perfil || "Sin definir",
      stage: row.etapa_actual,
      status: row.estado,
      lastMessage: row.last_message || "Sin mensajes todavía",
      lastMessageAt: row.last_message_at || null,
      unreadCount: Number(row.unread_count) || 0,
    }));
  }

  async function listMessages(advisorId, userId, viewerRole) {
    await ensureSchema();
    const assignment = await getAssignment(advisorId, userId);
    const senderToMark = viewerRole === "advisor" ? "client" : "advisor";
    await pool.query(
      `UPDATE advisor_chat_messages SET read_at = CURRENT_TIMESTAMP
       WHERE advisor_id = $1 AND user_id = $2 AND sender_role = $3 AND read_at IS NULL`,
      [assignment.id_asesor, assignment.id_usuario, senderToMark]
    );
    const result = await pool.query(
      `SELECT id, advisor_id, user_id, sender_role, message, created_at, read_at
       FROM advisor_chat_messages
       WHERE advisor_id = $1 AND user_id = $2
       ORDER BY created_at, id`,
      [assignment.id_asesor, assignment.id_usuario]
    );
    return { assignment, messages: result.rows.map(presentMessage) };
  }

  async function sendMessage({ advisorId, userId, senderRole, message }) {
    await ensureSchema();
    if (!new Set(["advisor", "client"]).has(senderRole)) {
      const error = new Error("Remitente inválido");
      error.statusCode = 400;
      throw error;
    }
    const assignment = await getAssignment(advisorId, userId);
    const result = await pool.query(
      `INSERT INTO advisor_chat_messages (advisor_id, user_id, sender_role, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, advisor_id, user_id, sender_role, message, created_at, read_at`,
      [assignment.id_asesor, assignment.id_usuario, senderRole, normalizeMessage(message)]
    );
    return presentMessage(result.rows[0]);
  }

  async function getClientConversation(userId) {
    await ensureSchema();
    const assignment = await getClientAssignment(userId);
    if (!assignment?.id_asesor) return { assignment, messages: [] };
    return listMessages(assignment.id_asesor, assignment.id_usuario, "client");
  }

  async function sendClientMessage(userId, message) {
    const assignment = await getClientAssignment(userId);
    if (!assignment?.id_asesor) {
      const error = new Error("Aún no tienes un asesor asignado");
      error.statusCode = 409;
      throw error;
    }
    return sendMessage({ advisorId: assignment.id_asesor, userId, senderRole: "client", message });
  }

  async function listTasks(advisorId) {
    await ensureSchema();
    const result = await pool.query(
      `SELECT task.*, applicant.nombre AS applicant_name
       FROM advisor_tasks task
       LEFT JOIN usuario applicant ON applicant.id_usuario = task.user_id
       WHERE task.advisor_id = $1
       ORDER BY task.status, task.due_at NULLS LAST, task.created_at DESC`,
      [toPositiveInteger(advisorId, "Asesor")]
    );
    return result.rows.map(presentTask);
  }

  async function createTask(advisorId, payload = {}) {
    await ensureSchema();
    const title = String(payload.title || "").trim();
    if (!title || title.length > 240) {
      const error = new Error("El título es obligatorio y no puede superar 240 caracteres");
      error.statusCode = 400;
      throw error;
    }
    const priority = payload.priority === "high" ? "high" : "normal";
    const userId = payload.userId ? toPositiveInteger(payload.userId, "Solicitante") : null;
    if (userId) await getAssignment(advisorId, userId);
    const result = await pool.query(
      `INSERT INTO advisor_tasks (advisor_id, user_id, title, due_at, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [toPositiveInteger(advisorId, "Asesor"), userId, title, payload.dueAt || null, priority]
    );
    return presentTask(result.rows[0]);
  }

  async function updateTask(advisorId, taskId, payload = {}) {
    await ensureSchema();
    const updates = [];
    const values = [];
    if (payload.title !== undefined) {
      const title = String(payload.title || "").trim();
      if (!title || title.length > 240) {
        const error = new Error("El título es obligatorio y no puede superar 240 caracteres");
        error.statusCode = 400;
        throw error;
      }
      values.push(title); updates.push(`title = $${values.length}`);
    }
    if (payload.dueAt !== undefined) {
      values.push(payload.dueAt || null); updates.push(`due_at = $${values.length}`);
    }
    if (payload.priority !== undefined) {
      if (!new Set(["normal", "high"]).has(payload.priority)) {
        const error = new Error("Prioridad inválida"); error.statusCode = 400; throw error;
      }
      values.push(payload.priority); updates.push(`priority = $${values.length}`);
    }
    if (payload.status !== undefined) {
      if (!new Set(["pending", "completed"]).has(payload.status)) {
        const error = new Error("Estado inválido"); error.statusCode = 400; throw error;
      }
      values.push(payload.status); updates.push(`status = $${values.length}`);
    }
    if (!updates.length) {
      const error = new Error("No hay cambios para guardar"); error.statusCode = 400; throw error;
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(toPositiveInteger(taskId, "Tarea"));
    const taskParam = values.length;
    values.push(toPositiveInteger(advisorId, "Asesor"));
    const advisorParam = values.length;
    const result = await pool.query(
      `UPDATE advisor_tasks SET ${updates.join(", ")}
       WHERE id = $${taskParam} AND advisor_id = $${advisorParam}
       RETURNING *`,
      values
    );
    if (!result.rows.length) {
      const error = new Error("Tarea no encontrada"); error.statusCode = 404; throw error;
    }
    return presentTask(result.rows[0]);
  }

  async function deleteTask(advisorId, taskId) {
    await ensureSchema();
    const result = await pool.query(
      "DELETE FROM advisor_tasks WHERE id = $1 AND advisor_id = $2 RETURNING id",
      [toPositiveInteger(taskId, "Tarea"), toPositiveInteger(advisorId, "Asesor")]
    );
    if (!result.rows.length) {
      const error = new Error("Tarea no encontrada"); error.statusCode = 404; throw error;
    }
  }

  return {
    ensureSchema,
    getAssignment,
    listConversations,
    listMessages,
    sendMessage,
    getClientConversation,
    sendClientMessage,
    listTasks,
    createTask,
    updateTask,
    deleteTask,
  };
};
