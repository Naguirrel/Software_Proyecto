const createConsularPaymentService = require("../services/consularPaymentService");
const createConsularAppointmentService = require("../services/consularAppointmentService");

const quoteRow = { profile_key: "turismo_negocios", label: "Turismo y negocios B1/B2",
  package_amount_minor: 230000, package_currency: "gtq", included_consular_fee_usd_cents: 18500 };

describe("servicios consulares", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalNodeEnv; jest.useRealTimers(); });

  function paymentQuery(extra = () => null) {
    return jest.fn((sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT u.perfil,")) return Promise.resolve({ rows: [{ perfil: "turismo_negocios", family_members: 0 }] });
      if (normalized.startsWith("SELECT profile_key")) return Promise.resolve({ rows: [quoteRow] });
      if (normalized.startsWith("SELECT id,status")) return Promise.resolve({ rows: [] });
      if (normalized.startsWith("INSERT INTO consular_payments")) return Promise.resolve({ rows: [{ id: 41, provider: "bank_transfer", status: "transfer_pending", amount_cents: 230000, currency: "gtq", package_amount_minor: 230000, package_currency: "gtq", included_consular_fee_usd_cents: 18500 }] });
      return extra(normalized) || Promise.resolve({ rows: [] });
    });
  }

  test("el cliente registra una transferencia por el paquete de Q2,300 por persona", async () => {
    const query = paymentQuery();
    const service = createConsularPaymentService({ query });
    const payment = await service.submitTransfer({ user: { id_usuario: 7, nombre: "Ana" }, reference: "TRX-123",
      receiptUrl: "http://localhost/transfer.pdf", receiptStorageKey: "local/transfer.pdf" });
    expect(payment).toMatchObject({ id: 41, provider: "bank_transfer", status: "transfer_pending", amount_cents: 230000, package_currency: "gtq", included_consular_fee_usd_cents: 18500 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("'bank_transfer'"), [7, 230000, 18500, "turismo_negocios", "Turismo y negocios B1/B2", "gtq", "TRX-123", "http://localhost/transfer.pdf", "local/transfer.pdf"]);
  });

  test("el asesor asignado confirma la transferencia antes de iniciar la gestión", async () => {
    const query = jest.fn((sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT user_id,status")) return Promise.resolve({ rows: [{ user_id: 7, status: "transfer_pending" }] });
      if (normalized.startsWith("SELECT 1 FROM tramite")) return Promise.resolve({ rows: [{}] });
      if (normalized.startsWith("UPDATE consular_payments")) return Promise.resolve({ rows: [{ id: 41, status: "client_paid", amount_cents: 230000, currency: "gtq" }] });
      return Promise.resolve({ rows: [] });
    });
    const service = createConsularPaymentService({ query });
    const payment = await service.reviewTransfer({ staff: { id_usuario: 2, rol: "asesor" }, paymentId: 41, approved: true });
    expect(payment.status).toBe("client_paid");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("etapa_actual='Pago consular'"), [7]);
  });

  test("un asesor asignado registra el recibo consular oficial", async () => {
    const query = jest.fn((sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT user_id,status")) return Promise.resolve({ rows: [{ user_id: 7, status: "client_paid" }] });
      if (normalized.startsWith("SELECT 1 FROM tramite")) return Promise.resolve({ rows: [{ "?column?": 1 }] });
      if (normalized.startsWith("UPDATE consular_payments")) return Promise.resolve({ rows: [{ id: 41, user_id: 7, amount_cents: 230000, package_amount_minor: 230000, package_currency: "gtq", included_consular_fee_usd_cents: 18500, status: "consular_paid" }] });
      return Promise.resolve({ rows: [] });
    });
    const service = createConsularPaymentService({ query }, { gateway: null });
    const payment = await service.recordConsularPayment({ staff: { id_usuario: 2, rol: "asesor" }, paymentId: 41,
      receiptNumber: "MRV-123", receiptStorageKey: "local/receipt.pdf", receiptUrl: "http://localhost/receipt.pdf" });
    expect(payment.status).toBe("consular_paid");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("official_receipt_number=$1"), expect.arrayContaining(["MRV-123", "http://localhost/receipt.pdf", "local/receipt.pdf", null, 2, 41]));
  });

  test("un asesor asignado inicia la gestión consular", async () => {
    const query = jest.fn((sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT user_id,status")) return Promise.resolve({ rows: [{ user_id: 7, status: "client_paid" }] });
      if (normalized.startsWith("SELECT 1 FROM tramite")) return Promise.resolve({ rows: [{ "?column?": 1 }] });
      if (normalized.startsWith("UPDATE consular_payments")) return Promise.resolve({ rows: [{ id: 41, amount_cents: 230000, currency: "gtq", status: "consular_processing" }] });
      return Promise.resolve({ rows: [] });
    });
    const service = createConsularPaymentService({ query }, { gateway: null });
    const payment = await service.startConsularProcessing({ staff: { id_usuario: 2, rol: "asesor" }, paymentId: 41 });
    expect(payment.status).toBe("consular_processing");
  });

  test("solo registra una cita oficial después del pago consular", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
    const notification = { crearNotificacion: jest.fn().mockResolvedValue({ id: 9 }) };
    const paymentService = { assertStaffCanManage: jest.fn().mockResolvedValue() };
    const query = jest.fn((sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT id FROM consular_payments")) return Promise.resolve({ rows: [{ id: 41 }] });
      if (normalized.startsWith("INSERT INTO consular_appointments")) return Promise.resolve({ rows: [{ id: 12, appointment_at: "2026-09-08T14:00:00.000Z", confirmation_code: "AA012345" }] });
      return Promise.resolve({ rows: [] });
    });
    const service = createConsularAppointmentService({ query }, { notificacionService: notification, paymentService });
    const appointment = await service.saveOfficialAppointment({ staff: { id_usuario: 2, rol: "asesor" }, userId: 7,
      appointmentAt: "2026-09-08T14:00:00.000Z", confirmationCode: "AA012345" });
    expect(appointment.id).toBe(12);
    expect(paymentService.assertStaffCanManage).toHaveBeenCalledWith(expect.anything(), 7);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("etapa_actual='Entrevista'"), [7]);
    expect(notification.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, titulo: "Cita consular registrada" }));
  });

  test("rechaza registrar una cita si el pago consular no está confirmado", async () => {
    const service = createConsularAppointmentService({ query: jest.fn().mockResolvedValue({ rows: [] }) },
      { paymentService: { assertStaffCanManage: jest.fn().mockResolvedValue() } });
    await expect(service.saveOfficialAppointment({ staff: { id_usuario: 2, rol: "asesor" }, userId: 7,
      appointmentAt: "2027-09-08T14:00:00.000Z", confirmationCode: "AA012345" })).rejects.toMatchObject({ statusCode: 409 });
  });

  test("registra como máximo dos acercamientos y únicamente a fechas anteriores", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
    const paymentService = { assertStaffCanManage: jest.fn().mockResolvedValue() };
    let current = { id: 12, appointment_at: "2026-12-10T14:00:00.000Z", reschedule_count: 1 };
    const query = jest.fn((sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT id FROM consular_payments")) return Promise.resolve({ rows: [{ id: 41 }] });
      if (normalized.startsWith("SELECT id,appointment_at,reschedule_count")) return Promise.resolve({ rows: [current] });
      if (normalized.startsWith("UPDATE consular_appointments SET consulate")) {
        current = { ...current, appointment_at: "2026-11-10T14:00:00.000Z", reschedule_count: 2 };
        return Promise.resolve({ rows: [current] });
      }
      return Promise.resolve({ rows: [] });
    });
    const service = createConsularAppointmentService({ query }, { paymentService });
    const result = await service.saveOfficialAppointment({ staff: { id_usuario: 2, rol: "asesor" }, userId: 7,
      appointmentAt: "2026-11-10T14:00:00.000Z", confirmationCode: "AA012345" });
    expect(result.reschedule_count).toBe(2);
    await expect(service.saveOfficialAppointment({ staff: { id_usuario: 2, rol: "asesor" }, userId: 7,
      appointmentAt: "2026-10-10T14:00:00.000Z", confirmationCode: "AA012346" })).rejects.toMatchObject({ statusCode: 409 });
  });

  test("rechaza una reprogramación que aleja la fecha de la cita", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
    const query = jest.fn((sql) => String(sql).includes("SELECT id FROM consular_payments")
      ? Promise.resolve({ rows: [{ id: 41 }] })
      : Promise.resolve({ rows: [{ id: 12, appointment_at: "2026-10-10T14:00:00.000Z", reschedule_count: 0 }] }));
    const service = createConsularAppointmentService({ query },
      { paymentService: { assertStaffCanManage: jest.fn().mockResolvedValue() } });
    await expect(service.saveOfficialAppointment({ staff: { id_usuario: 2, rol: "asesor" }, userId: 7,
      appointmentAt: "2026-11-10T14:00:00.000Z", confirmationCode: "AA012345" })).rejects.toMatchObject({ statusCode: 400 });
  });
});
