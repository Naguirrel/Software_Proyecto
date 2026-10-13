const request = require("supertest");
const fakeStorage = require("../test-utils/fakeStorage");
const { createConsularPaymentsIntegrationApp, PDF_CONTENT } = require("../test-utils/consularPaymentsIntegrationHarness");

const PACKAGE_GTQ_MINOR = 230000;
const CONSULAR_FEE_USD_CENTS = 18500;
const flushCleanup = () => new Promise((resolve) => setImmediate(resolve));

function auth(req, token) {
  return req.set("Authorization", `Bearer ${token}`);
}

function submitTransfer(app, token, { reference = "TRX-1001", file = true, filename = "comprobante.pdf", contentType = "application/pdf" } = {}) {
  const req = auth(request(app).post("/payments/bank-transfer"), token);
  if (reference !== undefined) req.field("reference", reference);
  if (file) req.attach("file", PDF_CONTENT, { filename, contentType });
  return req;
}

function reviewTransfer(app, token, paymentId, body) {
  return auth(request(app).post(`/staff/consular-payments/${paymentId}/review-transfer`), token).send(body);
}

function uploadOfficialReceipt(app, token, paymentId, { receiptNumber = "MRV-2026-001", file = true, notes } = {}) {
  const req = auth(request(app).post(`/staff/consular-payments/${paymentId}/receipt`), token);
  if (receiptNumber !== undefined) req.field("receiptNumber", receiptNumber);
  if (notes) req.field("notes", notes);
  if (file) req.attach("file", PDF_CONTENT, { filename: "recibo-oficial.pdf", contentType: "application/pdf" });
  return req;
}

describe("integración: módulo de pagos consulares", () => {
  let ctx;
  let ana;
  let luis;
  let asesora;
  let otroAsesor;
  let admin;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    fakeStorage.reset();
    ctx = createConsularPaymentsIntegrationApp();
    ana = ctx.addUser({ id: 1, nombre: "Ana", perfil: "turismo_negocios" });
    luis = ctx.addUser({ id: 2, nombre: "Luis", perfil: "estudiante" });
    asesora = ctx.addUser({ id: 10, nombre: "Marta Asesora", rol: "asesor" });
    otroAsesor = ctx.addUser({ id: 11, nombre: "Pedro Asesor", rol: "asesor" });
    admin = ctx.addUser({ id: 20, nombre: "Admin", rol: "admin" });
    ctx.addTramite({ userId: 1, advisorId: 10 });
    ctx.addTramite({ userId: 2, advisorId: 11 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const name of ["PAYMENT_BANK_NAME", "PAYMENT_ACCOUNT_NAME", "PAYMENT_ACCOUNT_NUMBER", "PAYMENT_ACCOUNT_TYPE"]) {
      delete process.env[name];
    }
  });

  describe("catálogo de tarifas (visa_fee_catalog)", () => {
    test("la migración siembra los cinco perfiles con el paquete de Q2,300 y el arancel de $185 incluido", async () => {
      await ctx.schemaReady;

      expect(ctx.state.catalog.map((row) => row.profile_key).sort()).toEqual(
        ["adulto_mayor", "estudiante", "grupo_familiar", "renovacion", "turismo_negocios"]
      );
      for (const row of ctx.state.catalog) {
        expect(row).toMatchObject({ package_amount_minor: PACKAGE_GTQ_MINOR, package_currency: "gtq",
          included_consular_fee_usd_cents: CONSULAR_FEE_USD_CENTS, advisory_fee_cents: 0, active: true });
      }
    });

    test("la migración convierte pagos legados 'paid' y actualiza el monto de transferencias pendientes", async () => {
      ctx = createConsularPaymentsIntegrationApp({
        beforeSchema: (db) => {
          db.state.payments.push(
            { id: 90, user_id: 1, status: "paid", amount_cents: 18500, currency: "usd", created_at: new Date(0) },
            { id: 91, user_id: 2, status: "transfer_pending", amount_cents: 100, currency: "usd", visa_profile_label: null, created_at: new Date(0) },
          );
        },
      });
      await ctx.schemaReady;

      expect(ctx.state.payments[0].status).toBe("client_paid");
      expect(ctx.state.payments[1]).toMatchObject({ amount_cents: PACKAGE_GTQ_MINOR, currency: "gtq",
        included_consular_fee_usd_cents: CONSULAR_FEE_USD_CENTS, visa_profile_label: "Trámite de visa" });
    });

    test("cotiza según el perfil del cliente y normaliza variantes del nombre del perfil", async () => {
      ctx.state.users.find((user) => user.id_usuario === 1).perfil = "Renovación de visa";

      const renovacion = await auth(request(ctx.app).get("/payments/me"), ana.token);
      const estudiante = await auth(request(ctx.app).get("/payments/me"), luis.token);

      expect(renovacion.status).toBe(200);
      expect(renovacion.body).toMatchObject({ profileKey: "renovacion", profileLabel: "Renovación B1/B2",
        packageAmountMinor: PACKAGE_GTQ_MINOR, packageCurrency: "gtq", includedConsularFeeUsdCents: CONSULAR_FEE_USD_CENTS,
        personCount: 1, latest: null, payments: [], paid: false, transferPending: false });
      expect(estudiante.body).toMatchObject({ profileKey: "estudiante", profileLabel: "Estudiante F/M" });
    });

    test("responde 409 si la tarifa del perfil está desactivada", async () => {
      await ctx.schemaReady;
      ctx.state.catalog.find((row) => row.profile_key === "estudiante").active = false;

      const summary = await auth(request(ctx.app).get("/payments/me"), luis.token);
      const transfer = await submitTransfer(ctx.app, luis.token);
      await flushCleanup();

      expect(summary.status).toBe(409);
      expect(summary.body.error).toBe("No hay una tarifa configurada para este trámite");
      expect(transfer.status).toBe(409);
      expect(fakeStorage.files.size).toBe(0);
    });

    test("muestra los datos bancarios solo cuando están configurados", async () => {
      const sinConfigurar = await auth(request(ctx.app).get("/payments/me"), ana.token);
      expect(sinConfigurar.body.bank).toMatchObject({ configured: false, accountNumber: "" });

      Object.assign(process.env, { PAYMENT_BANK_NAME: "Banco Industrial", PAYMENT_ACCOUNT_NAME: "VisaGuide S.A.",
        PAYMENT_ACCOUNT_NUMBER: "123-456789-0", PAYMENT_ACCOUNT_TYPE: "Monetaria" });
      const configurado = await auth(request(ctx.app).get("/payments/me"), ana.token);
      expect(configurado.body.bank).toMatchObject({ configured: true, bankName: "Banco Industrial",
        accountNumber: "123-456789-0", accountType: "Monetaria" });
    });
  });

  describe("registro de la transferencia por el cliente", () => {
    test("exige sesión válida para consultar o pagar", async () => {
      const summary = await request(ctx.app).get("/payments/me");
      const transfer = await request(ctx.app).post("/payments/bank-transfer").field("reference", "TRX-1");
      const invalid = await auth(request(ctx.app).get("/payments/me"), "token-falso");

      expect([summary.status, transfer.status, invalid.status]).toEqual([401, 401, 401]);
    });

    test("registra la transferencia con el monto del catálogo, guarda el comprobante y avisa al asesor asignado", async () => {
      const response = await submitTransfer(ctx.app, ana.token, { reference: "  TRX-1001  " });

      expect(response.status).toBe(201);
      expect(response.body.payment).toMatchObject({ user_id: 1, provider: "bank_transfer", status: "transfer_pending",
        amount_cents: PACKAGE_GTQ_MINOR, currency: "gtq", included_consular_fee_usd_cents: CONSULAR_FEE_USD_CENTS,
        visa_profile_key: "turismo_negocios", visa_profile_label: "Turismo y negocios B1/B2", transfer_reference: "TRX-1001" });
      expect(fakeStorage.files.size).toBe(1);
      expect(ctx.notificaciones).toEqual([expect.objectContaining({ userId: 10, titulo: "Transferencia pendiente de validación" })]);

      const summary = await auth(request(ctx.app).get("/payments/me"), ana.token);
      expect(summary.body).toMatchObject({ transferPending: true, paid: false, customerPaid: false, consularPaid: false });
      expect(summary.body.payments).toHaveLength(1);
    });

    test("rechaza la transferencia sin referencia o sin comprobante y no deja archivos huérfanos", async () => {
      const sinReferencia = await submitTransfer(ctx.app, ana.token, { reference: "   " });
      const sinComprobante = await submitTransfer(ctx.app, ana.token, { file: false });
      await flushCleanup();

      expect(sinReferencia.status).toBe(400);
      expect(sinReferencia.body.error).toBe("La referencia de la transferencia es obligatoria");
      expect(sinComprobante.status).toBe(400);
      expect(sinComprobante.body.error).toBe("El comprobante de depósito o transferencia es obligatorio");
      expect(fakeStorage.files.size).toBe(0);
      expect(ctx.state.payments).toHaveLength(0);
    });

    test("rechaza comprobantes con tipo de archivo no permitido", async () => {
      const exe = await submitTransfer(ctx.app, ana.token, { filename: "comprobante.exe", contentType: "application/octet-stream" });
      const mimeFalso = await submitTransfer(ctx.app, ana.token, { filename: "comprobante.pdf", contentType: "text/html" });

      expect(exe.status).toBe(400);
      expect(exe.body.error).toBe("Tipo de archivo no permitido");
      expect(mimeFalso.status).toBe(400);
      expect(mimeFalso.body.error).toBe("El tipo MIME no coincide con la extensión permitida");
      expect(ctx.state.payments).toHaveLength(0);
    });

    test("no permite un segundo comprobante mientras hay un pago activo", async () => {
      await submitTransfer(ctx.app, ana.token);
      const duplicado = await submitTransfer(ctx.app, ana.token, { reference: "TRX-1002" });
      await flushCleanup();

      expect(duplicado.status).toBe(409);
      expect(duplicado.body.error).toBe("Tu comprobante ya está pendiente de validación");
      expect(ctx.state.payments).toHaveLength(1);
      expect(fakeStorage.files.size).toBe(1);
    });
  });

  describe("validación por el asesor y gestión consular", () => {
    test("solo el asesor asignado o un admin pueden revisar; el cliente no tiene acceso a staff", async () => {
      const { body } = await submitTransfer(ctx.app, ana.token);
      const paymentId = body.payment.id;

      const cliente = await reviewTransfer(ctx.app, ana.token, paymentId, { approved: true });
      const noAsignado = await reviewTransfer(ctx.app, otroAsesor.token, paymentId, { approved: true });
      const casos = await auth(request(ctx.app).get("/staff/consular-cases"), ana.token);

      expect(cliente.status).toBe(403);
      expect(noAsignado.status).toBe(403);
      expect(noAsignado.body.error).toBe("No tienes asignado este expediente");
      expect(casos.status).toBe(403);
      expect(ctx.state.payments[0].status).toBe("transfer_pending");
    });

    test("el rechazo exige motivo, notifica al cliente y le permite registrar un nuevo comprobante", async () => {
      const { body } = await submitTransfer(ctx.app, ana.token);
      const paymentId = body.payment.id;

      const sinMotivo = await reviewTransfer(ctx.app, asesora.token, paymentId, { approved: false, reason: " " });
      expect(sinMotivo.status).toBe(400);
      expect(sinMotivo.body.error).toBe("Indica el motivo del rechazo");

      const rechazo = await reviewTransfer(ctx.app, asesora.token, paymentId, { approved: false, reason: "Comprobante ilegible" });
      expect(rechazo.status).toBe(200);
      expect(rechazo.body.payment).toMatchObject({ status: "transfer_rejected", transfer_rejection_reason: "Comprobante ilegible",
        transfer_reviewed_by: 10, paid_at: null });
      expect(ctx.notificaciones).toContainEqual(expect.objectContaining({ userId: 1, titulo: "Comprobante rechazado",
        mensaje: expect.stringContaining("Comprobante ilegible") }));
      expect(ctx.findTramite(1)).toMatchObject({ etapa_actual: "Documentos", progreso: 34 });

      const reintento = await submitTransfer(ctx.app, ana.token, { reference: "TRX-1003" });
      expect(reintento.status).toBe(201);
      expect(reintento.body.payment.status).toBe("transfer_pending");
    });

    test("la aprobación confirma el pago, avanza el trámite a 'Pago consular' y no se puede revisar dos veces", async () => {
      const { body } = await submitTransfer(ctx.app, ana.token);
      const paymentId = body.payment.id;

      const aprobado = await reviewTransfer(ctx.app, asesora.token, paymentId, { approved: true });
      expect(aprobado.status).toBe(200);
      expect(aprobado.body.payment).toMatchObject({ status: "client_paid", transfer_rejection_reason: null });
      expect(aprobado.body.payment.paid_at).toBeTruthy();
      expect(ctx.findTramite(1)).toMatchObject({ etapa_actual: "Pago consular", progreso: 51 });
      expect(ctx.notificaciones).toContainEqual(expect.objectContaining({ userId: 1, titulo: "Transferencia confirmada" }));

      const repetido = await reviewTransfer(ctx.app, admin.token, paymentId, { approved: false, reason: "Error" });
      expect(repetido.status).toBe(409);
      expect(repetido.body.error).toBe("La transferencia ya fue revisada");

      const summary = await auth(request(ctx.app).get("/payments/me"), ana.token);
      expect(summary.body).toMatchObject({ paid: true, customerPaid: true, transferPending: false, consularPaid: false });
    });

    test("valida el identificador del pago antes de revisarlo", async () => {
      const invalido = await reviewTransfer(ctx.app, admin.token, "abc", { approved: true });
      const inexistente = await reviewTransfer(ctx.app, admin.token, 999, { approved: true });

      expect(invalido.status).toBe(400);
      expect(invalido.body.error).toBe("Pago inválido");
      expect(inexistente.status).toBe(404);
    });

    test("flujo completo: transferencia → confirmación → gestión consular → recibo oficial", async () => {
      const { body } = await submitTransfer(ctx.app, ana.token);
      const paymentId = body.payment.id;

      const antesDeConfirmar = await auth(request(ctx.app).post(`/staff/consular-payments/${paymentId}/start`), asesora.token);
      expect(antesDeConfirmar.status).toBe(409);
      expect(antesDeConfirmar.body.error).toBe("El pago bancario aún no está confirmado");

      await reviewTransfer(ctx.app, asesora.token, paymentId, { approved: true });
      const gestion = await auth(request(ctx.app).post(`/staff/consular-payments/${paymentId}/start`), asesora.token);
      expect(gestion.status).toBe(200);
      expect(gestion.body.payment.status).toBe("consular_processing");

      const sinNumero = await uploadOfficialReceipt(ctx.app, asesora.token, paymentId, { receiptNumber: "" });
      const sinArchivo = await uploadOfficialReceipt(ctx.app, asesora.token, paymentId, { file: false });
      expect(sinNumero.status).toBe(400);
      expect(sinNumero.body.error).toBe("El número de recibo oficial es obligatorio");
      expect(sinArchivo.status).toBe(400);
      expect(sinArchivo.body.error).toBe("El comprobante oficial es obligatorio");

      const recibo = await uploadOfficialReceipt(ctx.app, asesora.token, paymentId, { notes: "Pagado en Banrural" });
      expect(recibo.status).toBe(200);
      expect(recibo.body.payment).toMatchObject({ status: "consular_paid", official_receipt_number: "MRV-2026-001",
        consular_notes: "Pagado en Banrural", consular_recorded_by: 10 });
      expect(recibo.body.payment.official_receipt_url).toMatch(/^http:\/\/fake-storage\.test\//);
      expect(ctx.notificaciones).toContainEqual(expect.objectContaining({ userId: 1, titulo: "Pago consular realizado" }));

      const summary = await auth(request(ctx.app).get("/payments/me"), ana.token);
      expect(summary.body).toMatchObject({ paid: true, customerPaid: true, consularPaid: true });
      expect(summary.body.latest).toMatchObject({ id: paymentId, official_receipt_number: "MRV-2026-001" });
    });

    test("el asesor solo ve los expedientes de sus clientes y el admin ve todos", async () => {
      await submitTransfer(ctx.app, ana.token);
      await submitTransfer(ctx.app, luis.token);

      const deMarta = await auth(request(ctx.app).get("/staff/consular-cases"), asesora.token);
      const dePedro = await auth(request(ctx.app).get("/staff/consular-cases"), otroAsesor.token);
      const delAdmin = await auth(request(ctx.app).get("/staff/consular-cases"), admin.token);

      expect(deMarta.status).toBe(200);
      expect(deMarta.body.cases.map((row) => row.nombre)).toEqual(["Ana"]);
      expect(deMarta.body.cases[0]).toMatchObject({ advisor_name: "Marta Asesora", amount_cents: PACKAGE_GTQ_MINOR });
      expect(dePedro.body.cases.map((row) => row.nombre)).toEqual(["Luis"]);
      expect(delAdmin.body.cases.map((row) => row.nombre).sort()).toEqual(["Ana", "Luis"]);
    });
  });
});
