const express = require("express");
const createConsularRoutes = require("../routes/consularRoutes");
const createConsularPaymentService = require("../services/consularPaymentService");
const createConsularAppointmentService = require("../services/consularAppointmentService");
const upload = require("../upload");
const fakeStorage = require("./fakeStorage");
const { createRoleMiddleware, createSessionMiddleware, issueSessionToken } = require("../auth");

const normalize = (sql) => String(sql).replace(/\s+/g, " ").trim();
const APPOINTMENT_FIELDS = ["id", "consulate", "appointment_at", "original_appointment_at", "reschedule_count",
  "status", "confirmation_code", "notes", "created_at", "updated_at", "cancelled_at"];

// Base en memoria con las tablas que usa el módulo de citas: usuario, tramite,
// consular_payments (solo el estado de pago) y consular_appointments. Replica las
// restricciones del esquema real (código único, una cita activa por cliente) y falla
// ante cualquier consulta desconocida.
function createInMemoryAppointmentsDb() {
  const state = { users: [], tramites: [], payments: [], appointments: [], nextAppointmentId: 1, clock: 0 };
  const tick = () => new Date(Date.UTC(2026, 9, 1) + state.clock++ * 1000);
  const findTramite = (userId) => state.tramites.find((row) => row.id_usuario === userId);
  const uniqueViolation = () => Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
  const present = (row) => ({ ...row, remaining_reschedules: Math.max(0, 2 - row.reschedule_count) });

  async function query(sql, values = []) {
    const text = normalize(sql);

    if (/^(CREATE|ALTER|DROP) /.test(text) || text.startsWith("UPDATE consular_appointments SET original_appointment_at=appointment_at")) {
      return { rows: [] };
    }

    if (text.includes("FROM usuario WHERE id_usuario = $1")) {
      const user = state.users.find((row) => row.id_usuario === values[0]);
      return { rows: user ? [{ ...user }] : [] };
    }

    if (text === "SELECT 1 FROM tramite WHERE id_usuario=$1 AND id_asesor=$2") {
      const tramite = findTramite(values[0]);
      return { rows: tramite && tramite.id_asesor === values[1] ? [{ "?column?": 1 }] : [] };
    }

    if (text.startsWith("SELECT id FROM consular_payments WHERE user_id=$1 AND status='consular_paid'")) {
      const payment = state.payments.find((row) => row.user_id === values[0] && row.status === "consular_paid");
      return { rows: payment ? [{ id: payment.id }] : [] };
    }

    if (text.startsWith("SELECT id,consulate,appointment_at,original_appointment_at,reschedule_count, GREATEST")) {
      const rows = state.appointments
        .filter((row) => row.user_id === values[0])
        .sort((a, b) => new Date(b.appointment_at) - new Date(a.appointment_at) || b.id - a.id)
        .map(present);
      return { rows };
    }

    if (text.startsWith("SELECT id,appointment_at,reschedule_count FROM consular_appointments")) {
      const row = state.appointments.find((item) => item.user_id === values[0] && item.status === "scheduled");
      return { rows: row ? [{ id: row.id, appointment_at: row.appointment_at, reschedule_count: row.reschedule_count }] : [] };
    }

    if (text.startsWith("INSERT INTO consular_appointments")) {
      const [userId, consulate, appointmentAt, code, notes, recordedBy] = values;
      if (state.appointments.some((row) => row.confirmation_code === code)) throw uniqueViolation();
      if (state.appointments.some((row) => row.user_id === userId && row.status === "scheduled")) throw uniqueViolation();
      const now = tick();
      const row = { id: state.nextAppointmentId++, user_id: userId, consulate, appointment_at: appointmentAt,
        original_appointment_at: appointmentAt, reschedule_count: 0, last_rescheduled_at: null, status: "scheduled",
        confirmation_code: code, notes, recorded_by: recordedBy, created_at: now, updated_at: now, cancelled_at: null };
      state.appointments.push(row);
      return { rows: [present(row)] };
    }

    if (text.startsWith("UPDATE consular_appointments SET consulate=$1,appointment_at=$2")) {
      const [consulate, appointmentAt, code, notes, recordedBy, id] = values;
      const row = state.appointments.find((item) => item.id === id);
      const dateChanged = new Date(row.appointment_at).getTime() !== new Date(appointmentAt).getTime();
      const guarded = text.includes("AND reschedule_count<$7 AND appointment_at>$2");
      if (guarded && (row.reschedule_count >= 2 || new Date(row.appointment_at) <= new Date(appointmentAt))) return { rows: [] };
      if (state.appointments.some((item) => item.id !== id && item.confirmation_code === code)) throw uniqueViolation();
      Object.assign(row, { consulate, appointment_at: appointmentAt, confirmation_code: code, notes, recorded_by: recordedBy,
        reschedule_count: row.reschedule_count + (dateChanged ? 1 : 0), updated_at: tick() });
      return { rows: [present(row)] };
    }

    if (text.startsWith("INSERT INTO tramite")) {
      const tramite = findTramite(values[0]);
      const avance = { etapa_actual: "Entrevista", siguiente_paso: "Prepararte para la entrevista consular" };
      if (!tramite) state.tramites.push({ id_usuario: values[0], id_asesor: null, progreso: 67, ...avance });
      else if (tramite.progreso < 67) Object.assign(tramite, avance, { progreso: 67 });
      return { rows: [] };
    }

    if (text.startsWith("UPDATE consular_appointments SET status='cancelled'")) {
      const [id, userId] = values;
      const row = state.appointments.find((item) => item.id === id && item.user_id === userId && item.status === "scheduled");
      if (!row) return { rows: [] };
      Object.assign(row, { status: "cancelled", cancelled_at: tick(), updated_at: tick() });
      return { rows: [Object.fromEntries(APPOINTMENT_FIELDS.map((field) => [field, row[field]]))] };
    }

    throw new Error(`Consulta no soportada por la base en memoria: ${text}`);
  }

  function addUser({ id, rol = "cliente", nombre }) {
    const user = { id_usuario: id, nombre: nombre || `Usuario ${id}`, correo: `usuario${id}@example.com`,
      perfil: "turismo_negocios", rol, activo: true, email_verificado: true, idioma: "es" };
    state.users.push(user);
    return { user, token: issueSessionToken(user) };
  }

  function addTramite({ userId, advisorId = null, progreso = 51 }) {
    const tramite = { id_usuario: userId, id_asesor: advisorId, progreso, etapa_actual: "Pago consular" };
    state.tramites.push(tramite);
    return tramite;
  }

  function addConsularPayment(userId, status = "consular_paid") {
    const payment = { id: state.payments.length + 1, user_id: userId, status };
    state.payments.push(payment);
    return payment;
  }

  return { state, addUser, addTramite, addConsularPayment, findTramite, pool: { query: jest.fn(query) } };
}

// Monta las rutas consulares reales con autenticación y roles reales, el servicio real de
// pagos (para validar la asignación del asesor) y el servicio real de citas.
function createConsularAppointmentsIntegrationApp() {
  const db = createInMemoryAppointmentsDb();
  const notificaciones = [];
  const notificacionService = {
    crearNotificacion: jest.fn(async (notificacion) => { notificaciones.push(notificacion); }),
  };
  const paymentService = createConsularPaymentService(db.pool, { notificacionService });
  const appointmentService = createConsularAppointmentService(db.pool, { notificacionService, paymentService });
  const schemaReady = appointmentService.ensureSchema();

  const app = express();
  app.use(express.json());
  app.use("/", createConsularRoutes({
    requireSession: createSessionMiddleware(db.pool),
    requireStaff: createRoleMiddleware(db.pool, ["asesor", "admin"]),
    paymentService,
    appointmentService,
    schemaReady,
    upload,
    uploadStoredFile: fakeStorage.uploadStoredFile,
    deleteStoredFile: fakeStorage.deleteStoredFile,
  }));

  return { app, ...db, schemaReady, notificaciones, notificacionService };
}

module.exports = { createConsularAppointmentsIntegrationApp };
