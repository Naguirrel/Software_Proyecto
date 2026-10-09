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

function normalizeDueAt(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error("Fecha límite inválida");
    error.statusCode = 400;
    throw error;
  }
  return date.toISOString();
}

function normalizePriority(value, defaultValue) {
  const priority = value === undefined ? defaultValue : value;
  if (!new Set(["normal", "high"]).has(priority)) {
    const error = new Error("Prioridad inválida");
    error.statusCode = 400;
    throw error;
  }
  return priority;
}

function normalizeMessagePage(query = {}) {
  if (query.afterId !== undefined && query.beforeId !== undefined) {
    const error = new Error("No puedes combinar afterId y beforeId");
    error.statusCode = 400;
    throw error;
  }
  const afterId = query.afterId === undefined ? null : toPositiveInteger(query.afterId, "afterId");
  const beforeId = query.beforeId === undefined ? null : toPositiveInteger(query.beforeId, "beforeId");
  const rawLimit = query.limit === undefined ? 50 : Number(query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit <= 0 || rawLimit > 100) {
    const error = new Error("El límite debe ser un entero entre 1 y 100");
    error.statusCode = 400;
    throw error;
  }
  return { afterId, beforeId, limit: rawLimit };
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
      if (process.env.NODE_ENV === "production") {
        schemaPromise = Promise.all([
          pool.query("SELECT 1 FROM advisor_chat_messages LIMIT 0"),
          pool.query("SELECT 1 FROM advisor_tasks LIMIT 0"),
        ]).then(() => undefined);
        return schemaPromise;
      }
      schemaPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS advisor_chat_messages (
            id SERIAL PRIMARY KEY,
            advisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
            user_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
            sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('advisor', 'client')),
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMPTZ
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS advisor_chat_conversation_idx
          ON advisor_chat_messages(advisor_id, user_id, created_at, id)
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS advisor_chat_cursor_idx
          ON advisor_chat_messages(advisor_id, user_id, id)
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS advisor_chat_unread_idx
          ON advisor_chat_messages(advisor_id, user_id, sender_role, id)
          WHERE read_at IS NULL
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS advisor_tasks (
            id SERIAL PRIMARY KEY,
            advisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
            user_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
            title VARCHAR(240) NOT NULL,
            due_at TIMESTAMPTZ,
            priority VARCHAR(20) NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('normal', 'high')),
            status VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'completed')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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

  async function listMessages(advisorId, userId, viewerRole, query = {}) {
    await ensureSchema();
    const assignment = await getAssignment(advisorId, userId);
    const { afterId, beforeId, limit } = normalizeMessagePage(query);
    const senderToMark = viewerRole === "advisor" ? "client" : "advisor";
    await pool.query(
      `UPDATE advisor_chat_messages SET read_at = CURRENT_TIMESTAMP
       WHERE advisor_id = $1 AND user_id = $2 AND sender_role = $3 AND read_at IS NULL`,
      [assignment.id_asesor, assignment.id_usuario, senderToMark]
    );
    const values = [assignment.id_asesor, assignment.id_usuario];
    let cursorClause = "";
    if (afterId) {
      values.push(afterId);
      cursorClause = ` AND id > $${values.length}`;
    } else if (beforeId) {
      values.push(beforeId);
      cursorClause = ` AND id < $${values.length}`;
    }
    values.push(limit + 1);
    const descending = !afterId;
    const result = await pool.query(
      `SELECT id, advisor_id, user_id, sender_role, message, created_at, read_at
       FROM advisor_chat_messages
       WHERE advisor_id = $1 AND user_id = $2${cursorClause}
       ORDER BY id ${descending ? "DESC" : "ASC"}
       LIMIT $${values.length}`,
      values
    );
    const hasMore = result.rows.length > limit;
    const pageRows = result.rows.slice(0, limit);
    if (descending) pageRows.reverse();
    return {
      assignment,
      messages: pageRows.map(presentMessage),
      hasMoreBefore: descending && hasMore,
      hasMoreAfter: !descending && hasMore,
    };
  }

  async function sendMessage({ advisorId, userId, senderRole, message }) {
    await ensureSchema();
    if (!new Set(["advisor", "client"]).has(senderRole)) {
      const error = new Error("Remitente inválido");
      error.statusCode = 400;
      throw error;
    }
    const normalizedAdvisorId = toPositiveInteger(advisorId, "Asesor");
    const normalizedUserId = toPositiveInteger(userId, "Solicitante");
    const normalizedMessage = normalizeMessage(message);
    const result = await pool.query(
      `INSERT INTO advisor_chat_messages (advisor_id, user_id, sender_role, message)
       SELECT t.id_asesor, t.id_usuario, $3, $4
       FROM tramite t
       WHERE t.id_asesor = $1 AND t.id_usuario = $2
       RETURNING id, advisor_id, user_id, sender_role, message, created_at, read_at`,
      [normalizedAdvisorId, normalizedUserId, senderRole, normalizedMessage]
    );
    if (!result.rows.length) {
      const error = new Error("Solicitud no asignada a este asesor");
      error.statusCode = 404;
      throw error;
    }
    return presentMessage(result.rows[0]);
  }

  async function getClientConversation(userId, query = {}) {
    await ensureSchema();
    const assignment = await getClientAssignment(userId);
    if (!assignment?.id_asesor) return { assignment, messages: [], hasMoreBefore: false, hasMoreAfter: false };
    return listMessages(assignment.id_asesor, assignment.id_usuario, "client", query);
  }

  async function sendClientMessage(userId, message) {
    await ensureSchema();
    const normalizedUserId = toPositiveInteger(userId, "Solicitante");
    const result = await pool.query(
      `INSERT INTO advisor_chat_messages (advisor_id, user_id, sender_role, message)
       SELECT t.id_asesor, t.id_usuario, 'client', $2
       FROM tramite t
       WHERE t.id_usuario = $1 AND t.id_asesor IS NOT NULL
       RETURNING id, advisor_id, user_id, sender_role, message, created_at, read_at`,
      [normalizedUserId, normalizeMessage(message)]
    );
    if (!result.rows.length) {
      const error = new Error("Aún no tienes un asesor asignado");
      error.statusCode = 409;
      throw error;
    }
    return presentMessage(result.rows[0]);
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
    const priority = normalizePriority(payload.priority, "normal");
    const dueAt = normalizeDueAt(payload.dueAt) ?? null;
    const userId = payload.userId === undefined || payload.userId === null || payload.userId === ""
      ? null
      : toPositiveInteger(payload.userId, "Solicitante");
    if (userId) await getAssignment(advisorId, userId);
    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO advisor_tasks (advisor_id, user_id, title, due_at, priority)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *
       )
       SELECT inserted.*, applicant.nombre AS applicant_name
       FROM inserted
       LEFT JOIN usuario applicant ON applicant.id_usuario = inserted.user_id`,
      [toPositiveInteger(advisorId, "Asesor"), userId, title, dueAt, priority]
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
      values.push(normalizeDueAt(payload.dueAt)); updates.push(`due_at = $${values.length}`);
    }
    if (payload.priority !== undefined) {
      values.push(normalizePriority(payload.priority)); updates.push(`priority = $${values.length}`);
    }
    if (payload.userId !== undefined) {
      const userId = payload.userId === null || payload.userId === ""
        ? null
        : toPositiveInteger(payload.userId, "Solicitante");
      if (userId) await getAssignment(advisorId, userId);
      values.push(userId); updates.push(`user_id = $${values.length}`);
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
      `WITH updated AS (
         UPDATE advisor_tasks SET ${updates.join(", ")}
         WHERE id = $${taskParam} AND advisor_id = $${advisorParam}
         RETURNING *
       )
       SELECT updated.*, applicant.nombre AS applicant_name
       FROM updated
       LEFT JOIN usuario applicant ON applicant.id_usuario = updated.user_id`,
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
