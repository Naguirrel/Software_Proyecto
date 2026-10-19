const DEFAULT_CONSULATE = "Embajada de Estados Unidos, Ciudad de Guatemala";
const MAX_RESCHEDULES = 2;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseAppointmentDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw httpError("Fecha de cita inválida", 400);
  if (date.getTime() <= Date.now()) throw httpError("La cita debe ser una fecha futura", 400);
  return date;
}

function createConsularAppointmentService(pool, { notificacionService, paymentService } = {}) {
  async function ensureSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS consular_appointments (
      id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      consulate VARCHAR(200) NOT NULL, appointment_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'scheduled', confirmation_code VARCHAR(120) NOT NULL UNIQUE,
      notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at TIMESTAMP)`);
    await pool.query("ALTER TABLE consular_appointments ADD COLUMN IF NOT EXISTS recorded_by INT REFERENCES usuario(id_usuario) ON DELETE SET NULL");
    await pool.query(`ALTER TABLE consular_appointments
      ADD COLUMN IF NOT EXISTS original_appointment_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reschedule_count INT NOT NULL DEFAULT 0 CHECK (reschedule_count BETWEEN 0 AND 2),
      ADD COLUMN IF NOT EXISTS last_rescheduled_at TIMESTAMP`);
    await pool.query("UPDATE consular_appointments SET original_appointment_at=appointment_at WHERE original_appointment_at IS NULL");
    await pool.query("ALTER TABLE consular_appointments ALTER COLUMN confirmation_code TYPE VARCHAR(120)");
    await pool.query("CREATE INDEX IF NOT EXISTS consular_appointments_user_idx ON consular_appointments(user_id,appointment_at DESC)");
    await pool.query("DROP INDEX IF EXISTS consular_appointments_slot_idx");
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS consular_appointments_one_active_user_idx
      ON consular_appointments(user_id) WHERE status='scheduled'`);
  }

  async function listForUser(userId) {
    const result = await pool.query(`SELECT id,consulate,appointment_at,original_appointment_at,reschedule_count,
      GREATEST(0,$2-reschedule_count) AS remaining_reschedules,status,confirmation_code,notes,
      created_at,updated_at,cancelled_at FROM consular_appointments WHERE user_id=$1
      ORDER BY appointment_at DESC,id DESC`, [userId, MAX_RESCHEDULES]);
    return result.rows;
  }

  async function assertConsularPaid(userId) {
    const result = await pool.query("SELECT id FROM consular_payments WHERE user_id=$1 AND status='consular_paid' LIMIT 1", [userId]);
    if (!result.rows.length) throw httpError("Primero debes registrar el pago realizado ante el consulado", 409);
  }

  async function saveOfficialAppointment({ staff, userId, appointmentAt, confirmationCode, consulate, notes }) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) throw httpError("Cliente inválido", 400);
    const code = String(confirmationCode || "").trim();
    if (!code) throw httpError("El número de confirmación oficial es obligatorio", 400);
    await paymentService.assertStaffCanManage(staff, parsedUserId);
    await assertConsularPaid(parsedUserId);
    const date = parseAppointmentDate(appointmentAt);
    const normalizedConsulate = String(consulate || "").trim() || DEFAULT_CONSULATE;
    const normalizedNotes = String(notes || "").trim() || null;
    try {
      const currentResult = await pool.query(`SELECT id,appointment_at,reschedule_count FROM consular_appointments
        WHERE user_id=$1 AND status='scheduled' LIMIT 1`, [parsedUserId]);
      const current = currentResult.rows[0];
      let result;
      if (!current) {
        result = await pool.query(`INSERT INTO consular_appointments
          (user_id,consulate,appointment_at,original_appointment_at,status,confirmation_code,notes,recorded_by)
          VALUES ($1,$2,$3,$3,'scheduled',$4,$5,$6)
          RETURNING id,consulate,appointment_at,original_appointment_at,reschedule_count,
            ($7-reschedule_count) AS remaining_reschedules,status,confirmation_code,notes,created_at,updated_at,cancelled_at`,
        [parsedUserId, normalizedConsulate, date.toISOString(), code, normalizedNotes, staff.id_usuario, MAX_RESCHEDULES]);
      } else {
        const currentDate = new Date(current.appointment_at);
        const dateChanged = currentDate.getTime() !== date.getTime();
        if (dateChanged && date >= currentDate) throw httpError("Un acercamiento debe mover la cita a una fecha anterior", 400);
        if (dateChanged && Number(current.reschedule_count) >= MAX_RESCHEDULES) {
          throw httpError("Ya se utilizaron los 2 acercamientos incluidos", 409);
        }
        const concurrencyGuard = dateChanged ? "AND reschedule_count<$7 AND appointment_at>$2" : "";
        result = await pool.query(`UPDATE consular_appointments SET consulate=$1,appointment_at=$2,
          confirmation_code=$3,notes=$4,recorded_by=$5,
          reschedule_count=reschedule_count+CASE WHEN appointment_at<>$2 THEN 1 ELSE 0 END,
          last_rescheduled_at=CASE WHEN appointment_at<>$2 THEN CURRENT_TIMESTAMP ELSE last_rescheduled_at END,
          updated_at=CURRENT_TIMESTAMP WHERE id=$6 ${concurrencyGuard}
          RETURNING id,consulate,appointment_at,original_appointment_at,reschedule_count,
            ($7-reschedule_count) AS remaining_reschedules,status,confirmation_code,notes,created_at,updated_at,cancelled_at`,
        [normalizedConsulate, date.toISOString(), code, normalizedNotes, staff.id_usuario, current.id, MAX_RESCHEDULES]);
        if (!result.rows.length) throw httpError("La cita cambió o ya se utilizaron los 2 acercamientos incluidos", 409);
      }
      await advanceProcess(parsedUserId);
      const wasRescheduled = Boolean(current && new Date(current.appointment_at).getTime() !== date.getTime());
      await notify(parsedUserId, wasRescheduled ? "Cita consular acercada" : "Cita consular registrada",
        `Tu asesor registró tu cita para ${date.toLocaleString("es-GT", { timeZone: "America/Guatemala" })}.`,
        wasRescheduled ? "alta" : "normal");
      return result.rows[0];
    } catch (error) {
      if (error.code === "23505") throw httpError("Ese número de confirmación ya está registrado", 409);
      throw error;
    }
  }

  async function cancelByStaff({ staff, userId, appointmentId }) {
    const parsedUserId = Number(userId);
    const parsedId = Number(appointmentId);
    if (![parsedUserId, parsedId].every((id) => Number.isInteger(id) && id > 0)) throw httpError("Datos de cita inválidos", 400);
    await paymentService.assertStaffCanManage(staff, parsedUserId);
    const result = await pool.query(`UPDATE consular_appointments SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2 AND status='scheduled'
      RETURNING id,consulate,appointment_at,status,confirmation_code,notes,created_at,updated_at,cancelled_at`, [parsedId, parsedUserId]);
    if (!result.rows.length) throw httpError("Cita activa no encontrada", 404);
    await notify(parsedUserId, "Cita consular cancelada", "Tu asesor registró la cancelación de la cita consular.", "alta");
    return result.rows[0];
  }

  async function advanceProcess(userId) {
    await pool.query(`INSERT INTO tramite (id_usuario,estado,etapa_actual,progreso,siguiente_paso,mensaje,updated_at)
      VALUES ($1,'En proceso','Entrevista',67,'Prepararte para la entrevista consular','Tu cita oficial fue registrada. Prepárate para la entrevista.',CURRENT_TIMESTAMP)
      ON CONFLICT (id_usuario) DO UPDATE SET etapa_actual='Entrevista',progreso=GREATEST(tramite.progreso,67),
      siguiente_paso='Prepararte para la entrevista consular',mensaje='Tu cita oficial fue registrada. Prepárate para la entrevista.',updated_at=CURRENT_TIMESTAMP
      WHERE tramite.progreso<67`, [userId]);
  }

  async function notify(userId, title, message, prioridad = "normal") {
    try { await notificacionService?.crearNotificacion({ userId, titulo: title, mensaje: message, tipo: "entrevista", prioridad }); }
    catch (error) { console.error("CONSULAR APPOINTMENT NOTIFICATION ERROR:", error); }
  }

  return { ensureSchema, listForUser, saveOfficialAppointment, cancelByStaff };
}

module.exports = createConsularAppointmentService;
