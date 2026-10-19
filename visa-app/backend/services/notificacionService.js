const { publishNotification } = require("./notificationRealtime");

const VALID_NOTIFICATION_TYPES = new Set([
  "info", "etapa", "documento", "entrevista", "alerta", "chat", "assignment", "ds160", "task",
]);

// Prioridad visual (RF-16): "alta" pide atención o una acción del usuario, "baja" es solo informativa.
const VALID_NOTIFICATION_PRIORITIES = new Set(["baja", "normal", "alta"]);
const DEFAULT_NOTIFICATION_PRIORITY = "normal";

function normalizeOptionalText(value, maxLength) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeActionUrl(value) {
  const normalized = normalizeOptionalText(value, 500);
  if (!normalized) return null;
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    const error = new Error("La ruta de acción debe ser interna");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function createNotificacionService(pool) {
  async function ensureSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id SERIAL PRIMARY KEY,
        id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
        titulo VARCHAR(200) NOT NULL,
        mensaje TEXT NOT NULL,
        tipo VARCHAR(50) NOT NULL DEFAULT 'info',
        leido BOOLEAN NOT NULL DEFAULT FALSE,
        archivado BOOLEAN NOT NULL DEFAULT FALSE,
        etapa_relacionada VARCHAR(200),
        action_url VARCHAR(500),
        entity_type VARCHAR(80),
        entity_id BIGINT,
        dedupe_key VARCHAR(240),
        prioridad VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE notificaciones
        ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS action_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS entity_type VARCHAR(80),
        ADD COLUMN IF NOT EXISTS entity_id BIGINT,
        ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(240),
        ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'normal'
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'notificaciones_prioridad_check' AND conrelid = 'notificaciones'::regclass
        ) THEN
          ALTER TABLE notificaciones
            ADD CONSTRAINT notificaciones_prioridad_check CHECK (prioridad IN ('baja', 'normal', 'alta'));
        END IF;
      END $$
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS notificaciones_usuario_idx
      ON notificaciones(id_usuario)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS notificaciones_leido_idx
      ON notificaciones(id_usuario, leido)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS notificaciones_usuario_feed_idx
      ON notificaciones(id_usuario, archivado, created_at DESC, id DESC)
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_usuario_dedupe_idx
      ON notificaciones(id_usuario, dedupe_key)
      WHERE dedupe_key IS NOT NULL
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS advisor_notification_preferences (
        advisor_id INT PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
        sound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        muted_types TEXT[] NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  function parseUserId(userId) {
    const parsed = Number(userId);
    if (Number.isNaN(parsed) || parsed <= 0) {
      const error = new Error("user_id debe ser un número válido");
      error.statusCode = 400;
      throw error;
    }
    return parsed;
  }

  function parseId(id) {
    const parsed = Number(id);
    if (Number.isNaN(parsed) || parsed <= 0) {
      const error = new Error("ID inválido");
      error.statusCode = 400;
      throw error;
    }
    return parsed;
  }

  async function listarPaginaPorUsuario(userId, { status = "all", type = "all", limit = 50, beforeId } = {}) {
    await ensureSchema();
    const uid = parseUserId(userId);
    const normalizedLimit = Number(limit);
    if (!Number.isInteger(normalizedLimit) || normalizedLimit <= 0 || normalizedLimit > 100) {
      const error = new Error("limit debe ser un entero entre 1 y 100");
      error.statusCode = 400;
      throw error;
    }
    if (!new Set(["all", "read", "unread", "archived"]).has(status)) {
      const error = new Error("Estado de notificación inválido");
      error.statusCode = 400;
      throw error;
    }
    if (type !== "all" && !VALID_NOTIFICATION_TYPES.has(type)) {
      const error = new Error("Tipo de notificación inválido");
      error.statusCode = 400;
      throw error;
    }
    const values = [uid];
    const where = ["id_usuario = $1"];
    if (status === "archived") where.push("archivado = TRUE");
    else {
      where.push("archivado = FALSE");
      if (status === "read") where.push("leido = TRUE");
      if (status === "unread") where.push("leido = FALSE");
    }
    if (type !== "all") {
      values.push(type);
      where.push(`tipo = $${values.length}`);
    }
    if (beforeId !== undefined) {
      values.push(parseId(beforeId));
      where.push(`id < $${values.length}`);
    }
    values.push(normalizedLimit + 1);

    const result = await pool.query(
      `SELECT id, id_usuario, titulo, mensaje, tipo, leido, archivado, etapa_relacionada,
              action_url, entity_type, entity_id, dedupe_key, prioridad,
              created_at, updated_at
       FROM notificaciones
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length}`,
      values
    );

    return {
      notifications: result.rows.slice(0, normalizedLimit),
      hasMore: result.rows.length > normalizedLimit,
    };
  }

  async function listarPorUsuario(userId) {
    return (await listarPaginaPorUsuario(userId, { limit: 100 })).notifications;
  }

  async function contarNoLeidas(userId) {
    await ensureSchema();
    const uid = parseUserId(userId);

    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM notificaciones
       WHERE id_usuario = $1 AND leido = FALSE AND archivado = FALSE`,
      [uid]
    );

    return result.rows[0].total;
  }

  async function marcarLeida(id, userId) {
    await ensureSchema();
    const nid = parseId(id);
    const uid = parseUserId(userId);

    const result = await pool.query(
      `UPDATE notificaciones
       SET leido = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND id_usuario = $2
       RETURNING id, id_usuario, titulo, mensaje, tipo, leido, archivado, etapa_relacionada,
                 action_url, entity_type, entity_id, dedupe_key, prioridad,
                 created_at, updated_at`,
      [nid, uid]
    );

    if (result.rows.length === 0) {
      const error = new Error("Notificación no encontrada");
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  }

  async function archivar(id, userId) {
    await ensureSchema();
    const result = await pool.query(
      `UPDATE notificaciones
       SET archivado = TRUE, leido = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND id_usuario = $2
       RETURNING id, id_usuario, titulo, mensaje, tipo, leido, archivado, etapa_relacionada,
                 action_url, entity_type, entity_id, dedupe_key, prioridad, created_at, updated_at`,
      [parseId(id), parseUserId(userId)]
    );
    if (!result.rows.length) {
      const error = new Error("Notificación no encontrada");
      error.statusCode = 404;
      throw error;
    }
    return result.rows[0];
  }

  async function resolverPorDedupe(userId, dedupeKey) {
    await ensureSchema();
    const result = await pool.query(
      `DELETE FROM notificaciones
       WHERE id_usuario = $1 AND dedupe_key = $2
       RETURNING id`,
      [parseUserId(userId), normalizeOptionalText(dedupeKey, 240)]
    );
    return result.rows.length;
  }

  async function marcarTodasLeidas(userId) {
    await ensureSchema();
    const uid = parseUserId(userId);

    const result = await pool.query(
      `UPDATE notificaciones
       SET leido = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id_usuario = $1 AND leido = FALSE
       RETURNING id`,
      [uid]
    );

    return result.rows.length;
  }

  async function eliminar(id, userId) {
    await ensureSchema();
    const nid = parseId(id);
    const uid = parseUserId(userId);

    const result = await pool.query(
      `DELETE FROM notificaciones
       WHERE id = $1 AND id_usuario = $2
       RETURNING id`,
      [nid, uid]
    );

    if (result.rows.length === 0) {
      const error = new Error("Notificación no encontrada");
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0].id;
  }

  async function notificacionesAutomaticasActivas() {
    try {
      const result = await pool.query("SELECT notificaciones_automaticas FROM admin_settings WHERE id = 1");
      return result.rows[0]?.notificaciones_automaticas !== false;
    } catch {
      return true;
    }
  }

  async function crearNotificacion({
    userId,
    titulo,
    mensaje,
    tipo = "info",
    etapaRelacionada = null,
    actionUrl = null,
    entityType = null,
    entityId = null,
    dedupeKey = null,
    prioridad = DEFAULT_NOTIFICATION_PRIORITY,
  }) {
    await ensureSchema();
    const uid = parseUserId(userId);

    if (!(await notificacionesAutomaticasActivas())) return null;

    if (!titulo || !titulo.trim()) {
      const error = new Error("El título es obligatorio");
      error.statusCode = 400;
      throw error;
    }

    if (!mensaje || !mensaje.trim()) {
      const error = new Error("El mensaje es obligatorio");
      error.statusCode = 400;
      throw error;
    }

    const tipoFinal = VALID_NOTIFICATION_TYPES.has(tipo) ? tipo : "info";
    const prioridadFinal = VALID_NOTIFICATION_PRIORITIES.has(prioridad) ? prioridad : DEFAULT_NOTIFICATION_PRIORITY;
    const normalizedEntityId = entityId === null || entityId === undefined || entityId === ""
      ? null
      : parseId(entityId);

    const normalizedStage = normalizeOptionalText(etapaRelacionada, 200);
    const normalizedActionUrl = normalizeActionUrl(actionUrl);
    const normalizedEntityType = normalizeOptionalText(entityType, 80);
    const normalizedDedupeKey = normalizeOptionalText(dedupeKey, 240);
    const hasRealtimeMetadata = Boolean(normalizedActionUrl || normalizedEntityType || normalizedEntityId || normalizedDedupeKey);
    const result = hasRealtimeMetadata
      ? await pool.query(
        `INSERT INTO notificaciones AS existing
           (id_usuario, titulo, mensaje, tipo, etapa_relacionada, action_url, entity_type, entity_id, dedupe_key, prioridad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id_usuario, dedupe_key) WHERE dedupe_key IS NOT NULL
         DO UPDATE SET titulo = EXCLUDED.titulo, mensaje = EXCLUDED.mensaje, tipo = EXCLUDED.tipo,
           etapa_relacionada = EXCLUDED.etapa_relacionada, action_url = EXCLUDED.action_url,
           entity_type = EXCLUDED.entity_type, entity_id = EXCLUDED.entity_id, prioridad = EXCLUDED.prioridad,
           leido = FALSE, archivado = FALSE, created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE existing.titulo IS DISTINCT FROM EXCLUDED.titulo
            OR existing.mensaje IS DISTINCT FROM EXCLUDED.mensaje
            OR existing.tipo IS DISTINCT FROM EXCLUDED.tipo
            OR existing.etapa_relacionada IS DISTINCT FROM EXCLUDED.etapa_relacionada
            OR existing.action_url IS DISTINCT FROM EXCLUDED.action_url
            OR existing.entity_type IS DISTINCT FROM EXCLUDED.entity_type
            OR existing.entity_id IS DISTINCT FROM EXCLUDED.entity_id
            OR existing.prioridad IS DISTINCT FROM EXCLUDED.prioridad
         RETURNING id, id_usuario, titulo, mensaje, tipo, leido, archivado, etapa_relacionada,
                   action_url, entity_type, entity_id, dedupe_key, prioridad,
                   created_at, updated_at`,
        [
          uid, titulo.trim(), mensaje.trim(), tipoFinal, normalizedStage,
          normalizedActionUrl, normalizedEntityType, normalizedEntityId, normalizedDedupeKey, prioridadFinal,
        ]
      )
      : await pool.query(
        `INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, etapa_relacionada, prioridad)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, id_usuario, titulo, mensaje, tipo, leido, archivado, etapa_relacionada,
                   action_url, entity_type, entity_id, dedupe_key, prioridad, created_at, updated_at`,
        [uid, titulo.trim(), mensaje.trim(), tipoFinal, normalizedStage, prioridadFinal]
      );

    const notification = result.rows[0] || null;
    if (!notification) return null;
    publishNotification(pool, notification);
    return notification;
  }

  async function notificarAsesorDeCliente(clientId, notification) {
    await ensureSchema();
    const result = await pool.query(
      `SELECT t.id_tramite, t.id_asesor, u.nombre AS client_name
       FROM tramite t
       JOIN usuario u ON u.id_usuario = t.id_usuario
       WHERE t.id_usuario = $1 AND t.id_asesor IS NOT NULL
       LIMIT 1`,
      [parseUserId(clientId)]
    );
    const assignment = result.rows[0];
    if (!assignment) return null;
    return crearNotificacion({
      ...notification,
      userId: assignment.id_asesor,
      mensaje: String(notification.mensaje || "").replaceAll("{clientName}", assignment.client_name || "El solicitante"),
      dedupeKey: notification.dedupeKey
        ? `advisor:${assignment.id_asesor}:${notification.dedupeKey}`
        : null,
    });
  }

  async function getAdvisorPreferences(advisorId) {
    await ensureSchema();
    const result = await pool.query(
      `SELECT advisor_id, sound_enabled, muted_types, updated_at
       FROM advisor_notification_preferences WHERE advisor_id = $1`,
      [parseUserId(advisorId)]
    );
    return result.rows[0] || { advisor_id: parseUserId(advisorId), sound_enabled: false, muted_types: [] };
  }

  async function updateAdvisorPreferences(advisorId, payload = {}) {
    await ensureSchema();
    const mutedTypes = Array.isArray(payload.mutedTypes)
      ? [...new Set(payload.mutedTypes.filter((type) => VALID_NOTIFICATION_TYPES.has(type)))]
      : [];
    const result = await pool.query(
      `INSERT INTO advisor_notification_preferences (advisor_id, sound_enabled, muted_types)
       VALUES ($1, $2, $3)
       ON CONFLICT (advisor_id) DO UPDATE SET sound_enabled = EXCLUDED.sound_enabled,
         muted_types = EXCLUDED.muted_types, updated_at = CURRENT_TIMESTAMP
       RETURNING advisor_id, sound_enabled, muted_types, updated_at`,
      [parseUserId(advisorId), payload.soundEnabled === true, mutedTypes]
    );
    return result.rows[0];
  }

  async function ensureAdvisorTaskReminders(advisorId) {
    await ensureSchema();
    const normalizedAdvisorId = parseUserId(advisorId);
    const result = await pool.query(
      `SELECT task.id, task.title, task.due_at, task.priority
       FROM advisor_tasks task
       LEFT JOIN notificaciones reminder
         ON reminder.id_usuario = task.advisor_id
        AND reminder.dedupe_key = CONCAT('advisor:', task.advisor_id::text, ':task:', task.id::text, ':deadline')
       WHERE task.advisor_id = $1 AND task.status = 'pending' AND task.due_at IS NOT NULL
         AND task.due_at <= CURRENT_TIMESTAMP + INTERVAL '24 hours'
         AND (
           reminder.id IS NULL
           OR reminder.titulo IS DISTINCT FROM CASE
             WHEN task.due_at < CURRENT_TIMESTAMP THEN 'Tarea vencida'
             ELSE 'Tarea próxima a vencer'
           END
           OR reminder.mensaje IS DISTINCT FROM task.title
         )
       ORDER BY task.due_at ASC
       LIMIT 25`,
      [normalizedAdvisorId]
    );
    const reminders = [];
    for (const task of result.rows) {
      const overdue = new Date(task.due_at).getTime() < Date.now();
      const reminder = await crearNotificacion({
        userId: normalizedAdvisorId,
        titulo: overdue ? "Tarea vencida" : "Tarea próxima a vencer",
        mensaje: task.title,
        tipo: "task",
        etapaRelacionada: `task-${task.id}`,
        actionUrl: `/advisor/tareas?task=${task.id}`,
        entityType: "advisor_task",
        entityId: task.id,
        dedupeKey: `advisor:${normalizedAdvisorId}:task:${task.id}:deadline`,
        prioridad: overdue ? "alta" : "normal",
      });
      if (reminder) reminders.push(reminder);
    }
    return reminders;
  }

  async function existeNotificacionEtapa(userId, etapaRelacionada) {
    await ensureSchema();
    const uid = parseUserId(userId);

    const result = await pool.query(
      `SELECT id FROM notificaciones
       WHERE id_usuario = $1
         AND tipo = 'etapa'
         AND etapa_relacionada = $2
         AND created_at > NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [uid, etapaRelacionada]
    );

    return result.rows.length > 0;
  }

  async function notificarCambioEtapa(userId, etapaRelacionada, titulo, mensaje, prioridad = DEFAULT_NOTIFICATION_PRIORITY) {
    const yaExiste = await existeNotificacionEtapa(userId, etapaRelacionada);
    if (yaExiste) return null;

    return crearNotificacion({
      userId,
      titulo,
      mensaje,
      tipo: "etapa",
      etapaRelacionada,
      prioridad,
    });
  }

  return {
    ensureSchema,
    listarPorUsuario,
    listarPaginaPorUsuario,
    contarNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
    archivar,
    resolverPorDedupe,
    eliminar,
    crearNotificacion,
    notificarAsesorDeCliente,
    existeNotificacionEtapa,
    notificarCambioEtapa,
    getAdvisorPreferences,
    updateAdvisorPreferences,
    ensureAdvisorTaskReminders,
  };
}

module.exports = createNotificacionService;
module.exports.VALID_NOTIFICATION_TYPES = VALID_NOTIFICATION_TYPES;
module.exports.VALID_NOTIFICATION_PRIORITIES = VALID_NOTIFICATION_PRIORITIES;
