const DEFAULT_CONSULAR_FEE_CENTS = 18500;
const PACKAGE_AMOUNT_MINOR = 230000;
const PACKAGE_CURRENCY = "gtq";
const CUSTOMER_PAID_STATUSES = new Set(["client_paid", "consular_processing", "consular_paid"]);
const ACTIVE_STATUSES = ["transfer_pending", "client_paid", "consular_processing", "consular_paid"];

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createConsularPaymentService(pool, { notificacionService } = {}) {
  async function ensureSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS visa_fee_catalog (
      id SERIAL PRIMARY KEY, profile_key VARCHAR(80) NOT NULL UNIQUE, label VARCHAR(160) NOT NULL,
      consular_fee_cents INT NOT NULL CHECK (consular_fee_cents >= 0),
      advisory_fee_cents INT NOT NULL CHECK (advisory_fee_cents >= 0),
      currency VARCHAR(3) NOT NULL DEFAULT 'usd', active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`ALTER TABLE visa_fee_catalog
      ADD COLUMN IF NOT EXISTS package_amount_minor INT,
      ADD COLUMN IF NOT EXISTS package_currency VARCHAR(3),
      ADD COLUMN IF NOT EXISTS included_consular_fee_usd_cents INT`);
    await pool.query(`INSERT INTO visa_fee_catalog
      (profile_key,label,consular_fee_cents,advisory_fee_cents,currency) VALUES
      ('turismo_negocios','Turismo y negocios B1/B2',$1,$2,$3),
      ('renovacion','Renovación B1/B2',$1,$2,$3),
      ('estudiante','Estudiante F/M',$1,$2,$3),
      ('grupo_familiar','Grupo familiar',$1,$2,$3),
      ('adulto_mayor','Adulto mayor',$1,$2,$3) ON CONFLICT (profile_key) DO NOTHING`, [
      DEFAULT_CONSULAR_FEE_CENTS, 0, PACKAGE_CURRENCY,
    ]);
    await pool.query(`UPDATE visa_fee_catalog SET package_amount_minor=$1,package_currency=$2,
      included_consular_fee_usd_cents=$3,advisory_fee_cents=0,updated_at=CURRENT_TIMESTAMP
      WHERE package_amount_minor IS DISTINCT FROM $1 OR package_currency IS DISTINCT FROM $2
        OR included_consular_fee_usd_cents IS DISTINCT FROM $3 OR advisory_fee_cents<>0`,
    [PACKAGE_AMOUNT_MINOR, PACKAGE_CURRENCY, DEFAULT_CONSULAR_FEE_CENTS]);
    await pool.query(`CREATE TABLE IF NOT EXISTS consular_payments (
      id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      provider VARCHAR(30) NOT NULL, amount_cents INT NOT NULL CHECK (amount_cents > 0),
      currency VARCHAR(3) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'transfer_pending',
      paid_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`ALTER TABLE consular_payments
      ADD COLUMN IF NOT EXISTS visa_profile_key VARCHAR(80),
      ADD COLUMN IF NOT EXISTS visa_profile_label VARCHAR(160),
      ADD COLUMN IF NOT EXISTS consular_fee_cents INT,
      ADD COLUMN IF NOT EXISTS advisory_fee_cents INT,
      ADD COLUMN IF NOT EXISTS package_amount_minor INT,
      ADD COLUMN IF NOT EXISTS package_currency VARCHAR(3),
      ADD COLUMN IF NOT EXISTS included_consular_fee_usd_cents INT,
      ADD COLUMN IF NOT EXISTS transfer_reference VARCHAR(160),
      ADD COLUMN IF NOT EXISTS transfer_receipt_url TEXT,
      ADD COLUMN IF NOT EXISTS transfer_receipt_storage_key TEXT,
      ADD COLUMN IF NOT EXISTS transfer_submitted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS transfer_reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS transfer_reviewed_by INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS transfer_rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS official_receipt_number VARCHAR(120),
      ADD COLUMN IF NOT EXISTS official_receipt_url TEXT,
      ADD COLUMN IF NOT EXISTS official_receipt_storage_key TEXT,
      ADD COLUMN IF NOT EXISTS consular_paid_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS consular_recorded_by INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS consular_notes TEXT`);
    await pool.query("UPDATE consular_payments SET status='client_paid' WHERE status='paid'");
    await pool.query(`UPDATE consular_payments SET amount_cents=$1,currency=$2,package_amount_minor=$1,
      package_currency=$2,included_consular_fee_usd_cents=$3,consular_fee_cents=$3,advisory_fee_cents=0,
      visa_profile_label=COALESCE(visa_profile_label,'Trámite de visa'),updated_at=CURRENT_TIMESTAMP
      WHERE status='transfer_pending'`, [PACKAGE_AMOUNT_MINOR, PACKAGE_CURRENCY, DEFAULT_CONSULAR_FEE_CENTS]);
    await pool.query("CREATE INDEX IF NOT EXISTS consular_payments_user_idx ON consular_payments(user_id,created_at DESC)");
    await pool.query("DROP INDEX IF EXISTS consular_payments_one_active_user_idx");
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS consular_payments_one_active_user_idx
      ON consular_payments(user_id) WHERE status IN ('transfer_pending','client_paid','consular_processing','consular_paid')`);
  }

  function normalizeProfile(profile) {
    const value = String(profile || "").trim().toLowerCase();
    if (value.includes("estudiante") || value.includes("f/m") || value.includes("f1")) return "estudiante";
    if (value.includes("renov")) return "renovacion";
    if (value.includes("familiar") || value.includes("grupo")) return "grupo_familiar";
    if (value.includes("mayor")) return "adulto_mayor";
    return "turismo_negocios";
  }

  async function getQuote(userId) {
    const user = await pool.query("SELECT perfil FROM usuario WHERE id_usuario=$1", [userId]);
    if (!user.rows.length) throw httpError("Usuario no encontrado", 404);
    const profileKey = normalizeProfile(user.rows[0].perfil);
    const result = await pool.query(`SELECT profile_key,label,package_amount_minor,package_currency,
      included_consular_fee_usd_cents
      FROM visa_fee_catalog WHERE profile_key=$1 AND active=TRUE`, [profileKey]);
    const row = result.rows[0];
    if (!row) throw httpError("No hay una tarifa configurada para este trámite", 409);
    return { profileKey: row.profile_key, profileLabel: row.label,
      packageAmountMinor: Number(row.package_amount_minor), packageCurrency: row.package_currency,
      includedConsularFeeUsdCents: Number(row.included_consular_fee_usd_cents), personCount: 1 };
  }

  function presentPayment(row) {
    return row ? { ...row, amount_cents: Number(row.amount_cents), consular_fee_cents: Number(row.consular_fee_cents || 0),
      advisory_fee_cents: Number(row.advisory_fee_cents || 0),
      package_amount_minor: Number(row.package_amount_minor || row.amount_cents),
      included_consular_fee_usd_cents: Number(row.included_consular_fee_usd_cents || row.consular_fee_cents || 0) } : null;
  }

  function bankDetails() {
    return {
      configured: Boolean(process.env.PAYMENT_BANK_NAME && process.env.PAYMENT_ACCOUNT_NAME && process.env.PAYMENT_ACCOUNT_NUMBER),
      bankName: process.env.PAYMENT_BANK_NAME || "",
      accountName: process.env.PAYMENT_ACCOUNT_NAME || "",
      accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "",
      accountType: process.env.PAYMENT_ACCOUNT_TYPE || "",
      instructions: process.env.PAYMENT_BANK_INSTRUCTIONS || "Solicita los datos bancarios a tu asesor antes de realizar la transferencia.",
    };
  }

  async function getSummary(userId) {
    const [quote, result] = await Promise.all([getQuote(userId), pool.query(`SELECT id,provider,amount_cents,
      consular_fee_cents,advisory_fee_cents,package_amount_minor,package_currency,
      included_consular_fee_usd_cents,visa_profile_key,visa_profile_label,currency,status,
      transfer_reference,transfer_receipt_url,transfer_submitted_at,transfer_reviewed_at,transfer_rejection_reason,
      paid_at,official_receipt_number,official_receipt_url,consular_paid_at,consular_notes,created_at,updated_at
      FROM consular_payments WHERE user_id=$1 ORDER BY created_at DESC,id DESC`, [userId])]);
    const payments = result.rows.map(presentPayment);
    const latest = payments[0] || null;
    return { provider: "bank_transfer", bank: bankDetails(), ...quote,
      transferPending: latest?.status === "transfer_pending", customerPaid: latest ? CUSTOMER_PAID_STATUSES.has(latest.status) : false,
      consularPaid: latest?.status === "consular_paid", paid: latest ? CUSTOMER_PAID_STATUSES.has(latest.status) : false,
      latest, payments };
  }

  async function submitTransfer({ user, reference, receiptUrl, receiptStorageKey }) {
    const normalizedReference = String(reference || "").trim();
    if (!normalizedReference) throw httpError("La referencia de la transferencia es obligatoria", 400);
    if (!receiptStorageKey) throw httpError("El comprobante de depósito o transferencia es obligatorio", 400);
    const quote = await getQuote(user.id_usuario);
    const existing = await pool.query(`SELECT id,status FROM consular_payments WHERE user_id=$1
      AND status=ANY($2::varchar[]) ORDER BY created_at DESC LIMIT 1`, [user.id_usuario, ACTIVE_STATUSES]);
    if (existing.rows[0]) throw httpError(existing.rows[0].status === "transfer_pending"
      ? "Tu comprobante ya está pendiente de validación" : "El pago del cliente ya fue confirmado", 409);
    let result;
    try {
      result = await pool.query(`INSERT INTO consular_payments
        (user_id,provider,amount_cents,consular_fee_cents,advisory_fee_cents,visa_profile_key,visa_profile_label,
         currency,package_amount_minor,package_currency,included_consular_fee_usd_cents,status,
         transfer_reference,transfer_receipt_url,transfer_receipt_storage_key,transfer_submitted_at)
        VALUES ($1,'bank_transfer',$2,$3,0,$4,$5,$6,$2,$6,$3,'transfer_pending',$7,$8,$9,CURRENT_TIMESTAMP)
        RETURNING *`, [user.id_usuario, quote.packageAmountMinor, quote.includedConsularFeeUsdCents,
        quote.profileKey, quote.profileLabel, quote.packageCurrency, normalizedReference, receiptUrl, receiptStorageKey]);
    } catch (error) {
      if (error.code === "23505") throw httpError("Ya existe un pago activo para este cliente", 409);
      throw error;
    }
    await notifyAssignedAdvisor(user.id_usuario, "Transferencia pendiente de validación", `${user.nombre} registró un comprobante bancario.`, "alta");
    return presentPayment(result.rows[0]);
  }

  async function listCases(staff) {
    const values = staff.rol === "admin" ? [] : [staff.id_usuario];
    const advisorFilter = staff.rol === "admin" ? "" : "AND t.id_asesor=$1";
    const result = await pool.query(`SELECT p.id AS payment_id,p.user_id,p.status,p.amount_cents,
      p.consular_fee_cents,p.advisory_fee_cents,p.package_amount_minor,p.package_currency,
      p.included_consular_fee_usd_cents,p.currency,p.visa_profile_label,p.paid_at,
      p.transfer_reference,p.transfer_receipt_url,p.transfer_submitted_at,p.transfer_reviewed_at,p.transfer_rejection_reason,
      p.official_receipt_number,p.official_receipt_url,p.consular_paid_at,p.consular_notes,
      client.nombre,client.correo,advisor.nombre AS advisor_name,a.id AS appointment_id,
      a.appointment_at,a.confirmation_code,a.consulate,a.notes AS appointment_notes,a.status AS appointment_status,
      a.reschedule_count,a.original_appointment_at
      FROM consular_payments p JOIN usuario client ON client.id_usuario=p.user_id
      LEFT JOIN tramite t ON t.id_usuario=p.user_id LEFT JOIN usuario advisor ON advisor.id_usuario=t.id_asesor
      LEFT JOIN consular_appointments a ON a.user_id=p.user_id AND a.status='scheduled'
      WHERE p.status IN ('transfer_pending','client_paid','consular_processing','consular_paid') ${advisorFilter}
      ORDER BY p.transfer_submitted_at DESC NULLS LAST,p.paid_at DESC NULLS LAST,p.id DESC`, values);
    return result.rows.map(presentPayment);
  }

  async function assertStaffCanManage(staff, userId) {
    if (staff.rol === "admin") return;
    const result = await pool.query("SELECT 1 FROM tramite WHERE id_usuario=$1 AND id_asesor=$2", [userId, staff.id_usuario]);
    if (!result.rows.length) throw httpError("No tienes asignado este expediente", 403);
  }

  async function reviewTransfer({ staff, paymentId, approved, reason }) {
    const parsedId = Number(paymentId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) throw httpError("Pago inválido", 400);
    const current = await pool.query("SELECT user_id,status FROM consular_payments WHERE id=$1", [parsedId]);
    if (!current.rows.length) throw httpError("Pago no encontrado", 404);
    await assertStaffCanManage(staff, current.rows[0].user_id);
    if (current.rows[0].status !== "transfer_pending") throw httpError("La transferencia ya fue revisada", 409);
    const rejectionReason = String(reason || "").trim();
    if (!approved && !rejectionReason) throw httpError("Indica el motivo del rechazo", 400);
    const nextStatus = approved ? "client_paid" : "transfer_rejected";
    const result = await pool.query(`UPDATE consular_payments SET status=$1,transfer_reviewed_at=CURRENT_TIMESTAMP,
      transfer_reviewed_by=$2,transfer_rejection_reason=$3,paid_at=CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE paid_at END,
      updated_at=CURRENT_TIMESTAMP WHERE id=$5 AND status='transfer_pending' RETURNING *`, [nextStatus, staff.id_usuario,
      approved ? null : rejectionReason, approved, parsedId]);
    if (!result.rows.length) throw httpError("La transferencia ya fue revisada", 409);
    if (approved) {
      await advanceProcessAfterCustomerPayment(current.rows[0].user_id);
      await notify(current.rows[0].user_id, "Transferencia confirmada", "Tu asesor confirmó la recepción del pago. Iniciaremos la gestión consular.");
    } else {
      await notify(current.rows[0].user_id, "Comprobante rechazado", `Debes registrar un nuevo comprobante. Motivo: ${rejectionReason}`, "alta");
    }
    return presentPayment(result.rows[0]);
  }

  async function startConsularProcessing({ staff, paymentId }) {
    const parsedId = Number(paymentId);
    const current = await pool.query("SELECT user_id,status FROM consular_payments WHERE id=$1", [parsedId]);
    if (!current.rows.length) throw httpError("Pago no encontrado", 404);
    await assertStaffCanManage(staff, current.rows[0].user_id);
    if (current.rows[0].status !== "client_paid") throw httpError("El pago bancario aún no está confirmado", 409);
    const result = await pool.query("UPDATE consular_payments SET status='consular_processing',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='client_paid' RETURNING *", [parsedId]);
    if (!result.rows.length) throw httpError("La gestión consular ya fue iniciada", 409);
    await notify(current.rows[0].user_id, "Gestión consular iniciada", "Tu asesor comenzó la gestión del pago ante el consulado.", "baja");
    return presentPayment(result.rows[0]);
  }

  async function recordConsularPayment({ staff, paymentId, receiptNumber, receiptUrl, receiptStorageKey, notes }) {
    const parsedId = Number(paymentId);
    if (!String(receiptNumber || "").trim()) throw httpError("El número de recibo oficial es obligatorio", 400);
    const current = await pool.query("SELECT user_id,status,official_receipt_storage_key FROM consular_payments WHERE id=$1", [parsedId]);
    if (!current.rows.length) throw httpError("Pago no encontrado", 404);
    await assertStaffCanManage(staff, current.rows[0].user_id);
    if (!["client_paid", "consular_processing", "consular_paid"].includes(current.rows[0].status)) throw httpError("El pago bancario aún no está confirmado", 409);
    if (!receiptStorageKey && !current.rows[0].official_receipt_storage_key) throw httpError("El comprobante oficial es obligatorio", 400);
    const result = await pool.query(`UPDATE consular_payments SET status='consular_paid',official_receipt_number=$1,
      official_receipt_url=COALESCE($2,official_receipt_url),official_receipt_storage_key=COALESCE($3,official_receipt_storage_key),
      consular_notes=$4,consular_paid_at=COALESCE(consular_paid_at,CURRENT_TIMESTAMP),consular_recorded_by=$5,
      updated_at=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *`, [String(receiptNumber).trim(), receiptUrl || null,
      receiptStorageKey || null, String(notes || "").trim() || null, staff.id_usuario, parsedId]);
    await notify(current.rows[0].user_id, "Pago consular realizado", "Tu asesor registró el pago ante el consulado y el comprobante oficial ya está disponible.");
    return presentPayment(result.rows[0]);
  }

  async function advanceProcessAfterCustomerPayment(userId) {
    await pool.query(`INSERT INTO tramite (id_usuario,estado,etapa_actual,progreso,siguiente_paso,mensaje,updated_at)
      VALUES ($1,'En proceso','Pago consular',51,'Esperar la gestión de tu asesor','Confirmamos tu transferencia. Tu asesor realizará el pago consular.',CURRENT_TIMESTAMP)
      ON CONFLICT (id_usuario) DO UPDATE SET etapa_actual='Pago consular',progreso=GREATEST(tramite.progreso,51),
      siguiente_paso='Esperar la gestión de tu asesor',mensaje='Confirmamos tu transferencia. Tu asesor realizará el pago consular.',updated_at=CURRENT_TIMESTAMP
      WHERE tramite.progreso<51`, [userId]);
  }

  async function notifyAssignedAdvisor(userId, title, message, prioridad) {
    const result = await pool.query("SELECT id_asesor FROM tramite WHERE id_usuario=$1", [userId]);
    if (result.rows[0]?.id_asesor) await notify(result.rows[0].id_asesor, title, message, prioridad);
  }

  async function notify(userId, title, message, prioridad = "normal") {
    try { await notificacionService?.crearNotificacion({ userId, titulo: title, mensaje: message, tipo: "info", prioridad }); }
    catch (error) { console.error("CONSULAR PAYMENT NOTIFICATION ERROR:", error); }
  }

  return { ensureSchema, getSummary, submitTransfer, listCases, reviewTransfer,
    startConsularProcessing, recordConsularPayment, assertStaffCanManage };
}

module.exports = createConsularPaymentService;
