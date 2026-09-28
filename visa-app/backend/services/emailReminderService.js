function normalizeText(value, maxLength) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return maxLength ? normalized.slice(0, maxLength) : normalized;
}

function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function presentReminder(row) {
  return {
    id: row.id,
    userId: row.user_id,
    recipientEmail: row.recipient_email,
    reminderType: row.reminder_type,
    entityType: row.entity_type || "",
    entityId: row.entity_id || "",
    reminderDate: row.reminder_date,
    subject: row.subject,
    body: row.body,
    status: row.status,
    error: row.error || "",
    metadata: row.metadata || {},
    sentAt: row.sent_at || null,
    createdAt: row.created_at,
  };
}

const { createEmailTransporter, getEmailFrom } = require("../config/email");

function createSafeEmailSender(env = process.env) {
  const transporter = createEmailTransporter(env);
  const fromAddress = getEmailFrom(env);

  return async function sendEmail(message) {
    // Modo deshabilitado
    if (env.EMAIL_REMINDERS_MODE === "disabled") {
      return { status: "skipped", reason: "disabled" };
    }

    // Si no hay transporter configurado, usar dry run
    if (!transporter) {
      console.info("EMAIL DRY RUN (no SMTP configured):", {
        to: message.to,
        subject: message.subject,
      });
      return { status: "dry_run", reason: "no-smtp-config" };
    }

    // Enviar email real
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html || undefined,
      });

      console.info("EMAIL SENT:", {
        to: message.to,
        subject: message.subject,
        messageId: info.messageId,
      });

      return { status: "sent", messageId: info.messageId };
    } catch (error) {
      console.error("EMAIL SEND ERROR:", error.message);
      throw error;
    }
  };
}

function buildPendingDocumentTemplate(candidate) {
  const documentName = candidate.document_name || "documento pendiente";
  return {
    subject: "Recordatorio de documento pendiente",
    body: [
      `Hola ${candidate.user_name || "usuario"},`,
      "",
      `Tienes pendiente revisar o completar el documento: ${documentName}.`,
      "Ingresa a VisaGuide para consultar el estado y continuar con tu trámite.",
    ].join("\n"),
  };
}

function buildInterviewTemplate(candidate) {
  return {
    subject: "Recordatorio de preparación para entrevista",
    body: [
      `Hola ${candidate.user_name || "usuario"},`,
      "",
      "Tu trámite se encuentra en etapa de entrevista.",
      "Ingresa a VisaGuide para revisar tu preparación y próximos pasos.",
    ].join("\n"),
  };
}

module.exports = function createEmailReminderService(pool, options = {}) {
  const env = options.env || process.env;
  const sendEmail = options.sendEmail || createSafeEmailSender(env);

  async function ensureSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_reminders (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
        recipient_email VARCHAR(200) NOT NULL,
        reminder_type VARCHAR(80) NOT NULL,
        entity_type VARCHAR(80),
        entity_id VARCHAR(120),
        reminder_date DATE NOT NULL DEFAULT CURRENT_DATE,
        subject VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        error TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        sent_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS email_reminders_unique_daily_idx
      ON email_reminders(user_id, reminder_type, entity_type, COALESCE(entity_id, ''), reminder_date)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS email_reminders_created_at_idx
      ON email_reminders(created_at DESC, id DESC)
    `);
  }

  async function findExistingReminder(candidate, reminderDate) {
    const result = await pool.query(
      `SELECT id, user_id, recipient_email, reminder_type, entity_type,
              entity_id, reminder_date, subject, body, status, error,
              metadata, sent_at, created_at
       FROM email_reminders
       WHERE user_id = $1
         AND reminder_type = $2
         AND entity_type = $3
         AND COALESCE(entity_id, '') = COALESCE($4, '')
         AND reminder_date = $5
       LIMIT 1`,
      [
        candidate.user_id,
        candidate.reminder_type,
        candidate.entity_type,
        candidate.entity_id,
        reminderDate,
      ]
    );
    return result.rows[0] ? presentReminder(result.rows[0]) : null;
  }

  async function recordReminder(candidate, { status, error = null, reminderDate }) {
    const result = await pool.query(
      `INSERT INTO email_reminders
        (user_id, recipient_email, reminder_type, entity_type, entity_id,
         reminder_date, subject, body, status, error, metadata, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
               CASE WHEN $9 IN ('sent', 'dry_run') THEN CURRENT_TIMESTAMP ELSE NULL END)
       RETURNING id, user_id, recipient_email, reminder_type, entity_type,
                 entity_id, reminder_date, subject, body, status, error,
                 metadata, sent_at, created_at`,
      [
        candidate.user_id,
        candidate.recipient_email,
        candidate.reminder_type,
        candidate.entity_type,
        candidate.entity_id,
        reminderDate,
        candidate.subject,
        candidate.body,
        status,
        error,
        JSON.stringify(candidate.metadata || {}),
      ]
    );
    return presentReminder(result.rows[0]);
  }

  async function listPendingDocumentCandidates() {
    const result = await pool.query(`
      SELECT d.id AS document_id, d.nombre AS document_name, d.estado,
             u.id_usuario AS user_id, u.nombre AS user_name, u.correo AS recipient_email
      FROM documentos d
      JOIN usuario u ON u.id_usuario = d.usuario_id
      WHERE d.estado IN ('pending', 'review', 'correction', 'rejected')
        AND COALESCE(u.notificaciones_email, TRUE) = TRUE
      ORDER BY d.actualizado_en ASC, d.creado_en ASC, d.id ASC
    `);

    return result.rows
      .filter((row) => row.recipient_email)
      .map((row) => {
        const template = buildPendingDocumentTemplate(row);
        return {
          user_id: row.user_id,
          recipient_email: row.recipient_email,
          reminder_type: "pending_document",
          entity_type: "documento",
          entity_id: String(row.document_id),
          subject: template.subject,
          body: template.body,
          metadata: {
            documentName: row.document_name,
            estado: row.estado === "rejected" ? "correction" : row.estado,
          },
        };
      });
  }

  async function listInterviewCandidates() {
    const result = await pool.query(`
      SELECT t.id_tramite, t.etapa_actual, u.id_usuario AS user_id,
             u.nombre AS user_name, u.correo AS recipient_email
      FROM tramite t
      JOIN usuario u ON u.id_usuario = t.id_usuario
      WHERE t.etapa_actual = 'Entrevista'
        AND t.estado IN ('En proceso', 'Pendiente')
        AND COALESCE(u.notificaciones_email, TRUE) = TRUE
      ORDER BY t.updated_at ASC, t.id_tramite ASC
    `);

    return result.rows
      .filter((row) => row.recipient_email)
      .map((row) => {
        const template = buildInterviewTemplate(row);
        return {
          user_id: row.user_id,
          recipient_email: row.recipient_email,
          reminder_type: "upcoming_interview",
          entity_type: "tramite",
          entity_id: String(row.id_tramite),
          subject: template.subject,
          body: template.body,
          metadata: { etapaActual: row.etapa_actual },
        };
      });
  }

  async function listReminderCandidates() {
    await ensureSchema();
    const [documents, interviews] = await Promise.all([
      listPendingDocumentCandidates(),
      listInterviewCandidates(),
    ]);
    return [...documents, ...interviews];
  }

  async function sendReminder(candidate, optionsForSend = {}) {
    await ensureSchema();
    const reminderDate = optionsForSend.reminderDate || todayIso(optionsForSend.now || new Date());
    const existing = await findExistingReminder(candidate, reminderDate);
    if (existing) {
      return { status: "skipped", reason: "duplicate", reminder: existing };
    }

    try {
      const delivery = await sendEmail({
        to: candidate.recipient_email,
        subject: candidate.subject,
        text: candidate.body,
      });
      const status = delivery?.status === "skipped"
        ? "skipped"
        : delivery?.status === "sent"
          ? "sent"
          : "dry_run";
      const reminder = await recordReminder(candidate, { status, reminderDate });
      return { status, reminder };
    } catch (error) {
      const reminder = await recordReminder(candidate, {
        status: "failed",
        error: normalizeText(error.message || "No fue posible enviar el recordatorio"),
        reminderDate,
      });
      return { status: "failed", error: reminder.error, reminder };
    }
  }

  return {
    ensureSchema,
    listReminderCandidates,
    listPendingDocumentCandidates,
    listInterviewCandidates,
    sendReminder,
    presentReminder,
  };
};

module.exports.createSafeEmailSender = createSafeEmailSender;
