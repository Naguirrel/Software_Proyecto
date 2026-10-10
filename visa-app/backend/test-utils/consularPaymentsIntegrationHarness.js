const express = require("express");
const createConsularRoutes = require("../routes/consularRoutes");
const createConsularPaymentService = require("../services/consularPaymentService");
const upload = require("../upload");
const fakeStorage = require("./fakeStorage");
const { createRoleMiddleware, createSessionMiddleware, issueSessionToken } = require("../auth");

const normalize = (sql) => String(sql).replace(/\s+/g, " ").trim();
const ACTIVE_STATUSES = ["transfer_pending", "client_paid", "consular_processing", "consular_paid"];

// Base en memoria con las tablas que usa el módulo de pagos: usuario, tramite,
// visa_fee_catalog y consular_payments. Responde a las consultas reales del servicio
// (incluida la migración de ensureSchema) y falla ante cualquier consulta desconocida.
function createInMemoryConsularDb() {
  const state = { users: [], tramites: [], catalog: [], payments: [], nextPaymentId: 1, clock: 0 };
  const tick = () => new Date(Date.UTC(2026, 9, 1) + state.clock++ * 1000);
  const findPayment = (id) => state.payments.find((row) => row.id === id);
  const findTramite = (userId) => state.tramites.find((row) => row.id_usuario === userId);

  async function query(sql, values = []) {
    const text = normalize(sql);

    // DDL de ensureSchema: sin efecto en memoria.
    if (/^(CREATE|ALTER|DROP) /.test(text)) return { rows: [] };

    if (text.startsWith("INSERT INTO visa_fee_catalog")) {
      const [consular, advisory, currency] = values;
      for (const [, profileKey, label] of text.matchAll(/\('([a-z_]+)','([^']+)',\$1,\$2,\$3\)/g)) {
        if (state.catalog.some((row) => row.profile_key === profileKey)) continue;
        state.catalog.push({ profile_key: profileKey, label, consular_fee_cents: consular, advisory_fee_cents: advisory,
          currency, active: true, package_amount_minor: null, package_currency: null, included_consular_fee_usd_cents: null });
      }
      return { rows: [] };
    }

    if (text.startsWith("UPDATE visa_fee_catalog SET package_amount_minor=$1")) {
      const [amount, currency, includedFee] = values;
      for (const row of state.catalog) {
        Object.assign(row, { package_amount_minor: amount, package_currency: currency,
          included_consular_fee_usd_cents: includedFee, advisory_fee_cents: 0 });
      }
      return { rows: [] };
    }

    if (text === "UPDATE consular_payments SET status='client_paid' WHERE status='paid'") {
      state.payments.filter((row) => row.status === "paid").forEach((row) => { row.status = "client_paid"; });
      return { rows: [] };
    }

    if (text.startsWith("UPDATE consular_payments SET amount_cents=$1,currency=$2")) {
      const [amount, currency, includedFee] = values;
      for (const row of state.payments.filter((payment) => payment.status === "transfer_pending")) {
        Object.assign(row, { amount_cents: amount, currency, package_amount_minor: amount, package_currency: currency,
          included_consular_fee_usd_cents: includedFee, consular_fee_cents: includedFee, advisory_fee_cents: 0,
          visa_profile_label: row.visa_profile_label ?? "Trámite de visa", updated_at: tick() });
      }
      return { rows: [] };
    }

    if (text.includes("FROM usuario WHERE id_usuario = $1")) {
      const user = state.users.find((row) => row.id_usuario === values[0]);
      return { rows: user ? [{ ...user }] : [] };
    }

    if (text === "SELECT perfil FROM usuario WHERE id_usuario=$1") {
      const user = state.users.find((row) => row.id_usuario === values[0]);
      return { rows: user ? [{ perfil: user.perfil }] : [] };
    }

    if (text.startsWith("SELECT profile_key,label,package_amount_minor") && text.includes("FROM visa_fee_catalog")) {
      const row = state.catalog.find((entry) => entry.profile_key === values[0] && entry.active);
      return { rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith("SELECT id,provider,amount_cents")) {
      const rows = state.payments
        .filter((row) => row.user_id === values[0])
        .sort((a, b) => b.created_at - a.created_at || b.id - a.id)
        .map(({ transfer_receipt_storage_key, official_receipt_storage_key, ...row }) => ({ ...row }));
      return { rows };
    }

    if (text.startsWith("SELECT id,status FROM consular_payments WHERE user_id=$1")) {
      const row = state.payments
        .filter((payment) => payment.user_id === values[0] && values[1].includes(payment.status))
        .sort((a, b) => b.created_at - a.created_at)[0];
      return { rows: row ? [{ id: row.id, status: row.status }] : [] };
    }

    if (text.startsWith("INSERT INTO consular_payments")) {
      const [userId, amount, includedFee, profileKey, profileLabel, currency, reference, receiptUrl, receiptKey] = values;
      // Mismo efecto que el índice único consular_payments_one_active_user_idx.
      if (state.payments.some((row) => row.user_id === userId && ACTIVE_STATUSES.includes(row.status))) {
        throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
      }
      const now = tick();
      const payment = {
        id: state.nextPaymentId++, user_id: userId, provider: "bank_transfer", amount_cents: amount,
        consular_fee_cents: includedFee, advisory_fee_cents: 0, visa_profile_key: profileKey, visa_profile_label: profileLabel,
        currency, package_amount_minor: amount, package_currency: currency, included_consular_fee_usd_cents: includedFee,
        status: "transfer_pending", transfer_reference: reference, transfer_receipt_url: receiptUrl,
        transfer_receipt_storage_key: receiptKey, transfer_submitted_at: now, transfer_reviewed_at: null,
        transfer_reviewed_by: null, transfer_rejection_reason: null, paid_at: null, official_receipt_number: null,
        official_receipt_url: null, official_receipt_storage_key: null, consular_paid_at: null,
        consular_recorded_by: null, consular_notes: null, created_at: now, updated_at: now,
      };
      state.payments.push(payment);
      return { rows: [{ ...payment }] };
    }

    if (text === "SELECT id_asesor FROM tramite WHERE id_usuario=$1") {
      const tramite = findTramite(values[0]);
      return { rows: tramite ? [{ id_asesor: tramite.id_asesor }] : [] };
    }

    if (text.includes("FROM consular_payments p JOIN usuario client")) {
      const rows = state.payments
        .filter((row) => ACTIVE_STATUSES.includes(row.status))
        .filter((row) => !values.length || findTramite(row.user_id)?.id_asesor === values[0])
        .map((row) => {
          const client = state.users.find((user) => user.id_usuario === row.user_id);
          const advisor = state.users.find((user) => user.id_usuario === findTramite(row.user_id)?.id_asesor);
          return { ...row, payment_id: row.id, nombre: client?.nombre, correo: client?.correo,
            advisor_name: advisor?.nombre ?? null, appointment_id: null };
        });
      return { rows };
    }

    if (text === "SELECT 1 FROM tramite WHERE id_usuario=$1 AND id_asesor=$2") {
      const tramite = findTramite(values[0]);
      return { rows: tramite && tramite.id_asesor === values[1] ? [{ "?column?": 1 }] : [] };
    }

    if (text === "SELECT user_id,status FROM consular_payments WHERE id=$1") {
      const payment = findPayment(values[0]);
      return { rows: payment ? [{ user_id: payment.user_id, status: payment.status }] : [] };
    }

    if (text === "SELECT user_id,status,official_receipt_storage_key FROM consular_payments WHERE id=$1") {
      const payment = findPayment(values[0]);
      return { rows: payment ? [{ user_id: payment.user_id, status: payment.status,
        official_receipt_storage_key: payment.official_receipt_storage_key }] : [] };
    }

    if (text.startsWith("UPDATE consular_payments SET status=$1,transfer_reviewed_at")) {
      const [nextStatus, staffId, reason, approved, id] = values;
      const payment = findPayment(id);
      if (!payment || payment.status !== "transfer_pending") return { rows: [] };
      const now = tick();
      Object.assign(payment, { status: nextStatus, transfer_reviewed_at: now, transfer_reviewed_by: staffId,
        transfer_rejection_reason: reason, paid_at: approved ? now : payment.paid_at, updated_at: now });
      return { rows: [{ ...payment }] };
    }

    if (text.startsWith("UPDATE consular_payments SET status='consular_processing'")) {
      const payment = findPayment(values[0]);
      if (!payment || payment.status !== "client_paid") return { rows: [] };
      Object.assign(payment, { status: "consular_processing", updated_at: tick() });
      return { rows: [{ ...payment }] };
    }

    if (text.startsWith("UPDATE consular_payments SET status='consular_paid'")) {
      const [receiptNumber, receiptUrl, receiptKey, notes, staffId, id] = values;
      const payment = findPayment(id);
      const now = tick();
      Object.assign(payment, { status: "consular_paid", official_receipt_number: receiptNumber,
        official_receipt_url: receiptUrl ?? payment.official_receipt_url,
        official_receipt_storage_key: receiptKey ?? payment.official_receipt_storage_key,
        consular_notes: notes, consular_paid_at: payment.consular_paid_at ?? now, consular_recorded_by: staffId, updated_at: now });
      return { rows: [{ ...payment }] };
    }

    if (text.startsWith("INSERT INTO tramite")) {
      const tramite = findTramite(values[0]);
      const avance = { etapa_actual: "Pago consular", siguiente_paso: "Esperar la gestión de tu asesor" };
      if (!tramite) state.tramites.push({ id_usuario: values[0], id_asesor: null, estado: "En proceso", progreso: 51, ...avance });
      else if (tramite.progreso < 51) Object.assign(tramite, avance, { progreso: 51 });
      return { rows: [] };
    }

    throw new Error(`Consulta no soportada por la base en memoria: ${text}`);
  }

  function addUser({ id, rol = "cliente", nombre, perfil = "turismo_negocios" }) {
    const user = { id_usuario: id, nombre: nombre || `Usuario ${id}`, correo: `usuario${id}@example.com`,
      perfil, rol, activo: true, email_verificado: true, idioma: "es" };
    state.users.push(user);
    return { user, token: issueSessionToken(user) };
  }

  function addTramite({ userId, advisorId = null, progreso = 34, etapa = "Documentos" }) {
    const tramite = { id_usuario: userId, id_asesor: advisorId, estado: "En proceso", progreso, etapa_actual: etapa };
    state.tramites.push(tramite);
    return tramite;
  }

  return { state, addUser, addTramite, findTramite, pool: { query: jest.fn(query) } };
}

// Monta las rutas consulares reales con autenticación y roles reales, el
// almacenamiento falso y la migración real de esquema del servicio de pagos.
function createConsularPaymentsIntegrationApp({ beforeSchema } = {}) {
  const db = createInMemoryConsularDb();
  if (beforeSchema) beforeSchema(db);

  const notificaciones = [];
  const notificacionService = {
    crearNotificacion: jest.fn(async (notificacion) => { notificaciones.push(notificacion); }),
  };
  const paymentService = createConsularPaymentService(db.pool, { notificacionService });
  const schemaReady = paymentService.ensureSchema();

  const app = express();
  app.use(express.json());
  app.use("/", createConsularRoutes({
    requireSession: createSessionMiddleware(db.pool),
    requireStaff: createRoleMiddleware(db.pool, ["asesor", "admin"]),
    paymentService,
    appointmentService: {},
    schemaReady,
    upload,
    uploadStoredFile: fakeStorage.uploadStoredFile,
    deleteStoredFile: fakeStorage.deleteStoredFile,
  }));

  return { app, ...db, schemaReady, paymentService, notificaciones };
}

const PDF_CONTENT = Buffer.from("%PDF-1.4 comprobante de prueba");

module.exports = { createConsularPaymentsIntegrationApp, PDF_CONTENT };
