const nodemailer = require("nodemailer");
const createEmailReminderService = require("../services/emailReminderService");
const { createSafeEmailSender, getReminderMode } = createEmailReminderService;

function createPool(handler) {
  return { query: jest.fn(handler) };
}

const reminderRow = {
  id: 1,
  user_id: 4,
  recipient_email: "cliente@example.com",
  reminder_type: "pending_document",
  entity_type: "documento",
  entity_id: "41",
  reminder_date: "2026-09-02",
  subject: "Recordatorio de documento pendiente",
  body: "Tienes un documento pendiente.",
  status: "dry_run",
  error: null,
  metadata: {},
  sent_at: "2026-09-02T10:00:00.000Z",
  created_at: "2026-09-02T10:00:00.000Z",
};

describe("email reminder service", () => {
  test("detecta documentos pendientes", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM documentos d")) {
        return {
          rows: [{
            document_id: 41,
            document_name: "Pasaporte",
            estado: "correction",
            user_id: 4,
            user_name: "<b>Cliente</b>",
            recipient_email: "cliente@example.com",
          }],
        };
      }
      if (String(sql).includes("FROM tramite t")) return { rows: [] };
      return { rows: [] };
    });

    const service = createEmailReminderService(pool, { env: { FRONTEND_URL: "https://app.test/" } });
    const candidates = await service.listReminderCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      reminder_type: "pending_document",
      entity_type: "documento",
      entity_id: "41",
      recipient_email: "cliente@example.com",
    });
    expect(candidates[0].html).toContain("https://app.test/documents");
    expect(candidates[0].html).toContain("&#60;b&#62;Cliente&#60;/b&#62;");
    expect(candidates[0].html).not.toContain("<b>Cliente</b>");
    expect(candidates[0].body).toContain("https://app.test/documents");
  });

  test("no recuerda documentos que ya esperan revisión del asesor", async () => {
    const pool = createPool(async () => ({ rows: [] }));
    const service = createEmailReminderService(pool);

    await service.listPendingDocumentCandidates();

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain("d.estado IN ('pending', 'correction', 'rejected')");
    expect(sql).not.toContain("'review'");
  });

  test("detecta trámites en etapa de entrevista", async () => {
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM documentos d")) return { rows: [] };
      if (String(sql).includes("FROM tramite t")) {
        return {
          rows: [{
            id_tramite: 21,
            etapa_actual: "Entrevista",
            user_id: 4,
            user_name: "Cliente",
            recipient_email: "cliente@example.com",
          }],
        };
      }
      return { rows: [] };
    });

    const service = createEmailReminderService(pool);
    const candidates = await service.listReminderCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      reminder_type: "upcoming_interview",
      entity_type: "tramite",
      entity_id: "21",
    });
    expect(candidates[0].html).toContain("/entrevista");
  });

  test("omite recordatorios duplicados del mismo día", async () => {
    const sendEmail = jest.fn();
    const pool = createPool(async (sql) => {
      if (String(sql).includes("FROM email_reminders")) return { rows: [reminderRow] };
      return { rows: [] };
    });
    const service = createEmailReminderService(pool, { sendEmail });

    const result = await service.sendReminder({
      user_id: 4,
      recipient_email: "cliente@example.com",
      reminder_type: "pending_document",
      entity_type: "documento",
      entity_id: "41",
      subject: "Recordatorio",
      body: "Contenido",
      metadata: {},
    }, { reminderDate: "2026-09-02" });

    expect(result).toMatchObject({ status: "skipped", reason: "duplicate" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("usa modo dry-run por defecto y no requiere proveedor real en pruebas", async () => {
    const pool = createPool(async (sql, values) => {
      if (String(sql).includes("FROM email_reminders")) return { rows: [] };
      if (String(sql).includes("INSERT INTO email_reminders")) {
        return {
          rows: [{
            ...reminderRow,
            user_id: values[0],
            recipient_email: values[1],
            reminder_type: values[2],
            entity_type: values[3],
            entity_id: values[4],
            reminder_date: values[5],
            subject: values[6],
            body: values[7],
            status: values[8],
            error: values[9],
            metadata: JSON.parse(values[10]),
          }],
        };
      }
      return { rows: [] };
    });
    const service = createEmailReminderService(pool, { env: { EMAIL_REMINDERS_MODE: "dry_run" } });

    const result = await service.sendReminder({
      user_id: 4,
      recipient_email: "cliente@example.com",
      reminder_type: "pending_document",
      entity_type: "documento",
      entity_id: "41",
      subject: "Recordatorio",
      body: "Contenido",
      metadata: { documentName: "Pasaporte" },
    }, { reminderDate: "2026-09-02" });

    expect(result.status).toBe("dry_run");
    expect(result.reminder).toMatchObject({
      recipientEmail: "cliente@example.com",
      status: "dry_run",
    });
  });

  test("desactivado no envía ni registra, para no bloquear el envío del mismo día", async () => {
    const pool = createPool(async () => ({ rows: [] }));
    const service = createEmailReminderService(pool, { env: { EMAIL_REMINDERS_MODE: "disabled" } });

    const result = await service.sendReminder({
      user_id: 4,
      recipient_email: "cliente@example.com",
      reminder_type: "pending_document",
      entity_type: "documento",
      entity_id: "41",
      subject: "Recordatorio",
      body: "Contenido",
      metadata: {},
    }, { reminderDate: "2026-09-02" });

    expect(result).toEqual({ status: "skipped", reason: "disabled" });
    const statements = pool.query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("INSERT INTO email_reminders"))).toBe(false);
  });

  describe("con proveedor configurado", () => {
    const smtpEnv = { SMTP_HOST: "smtp.test", SMTP_USER: "user", SMTP_PASS: "pass" };
    const message = { to: "cliente@example.com", subject: "Asunto", text: "Texto", html: "<p>Hola</p>" };
    let sendMail;
    let createTransport;

    beforeEach(() => {
      sendMail = jest.fn(async () => ({ messageId: "id-1" }));
      createTransport = jest.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail });
    });

    afterEach(() => {
      createTransport.mockRestore();
    });

    test("dry_run simula sin enviar", async () => {
      const send = createSafeEmailSender({ ...smtpEnv, EMAIL_REMINDERS_MODE: "dry_run" });

      await expect(send(message)).resolves.toEqual({ status: "dry_run", reason: "simulation" });
      expect(sendMail).not.toHaveBeenCalled();
    });

    test("send entrega el texto y el HTML", async () => {
      const send = createSafeEmailSender({ ...smtpEnv, EMAIL_REMINDERS_MODE: "send" });

      await expect(send(message)).resolves.toMatchObject({ status: "sent" });
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ text: "Texto", html: "<p>Hola</p>" }));
    });

    test.each(["disabled", "dry_run"])("los correos de cuenta se envían aunque el modo sea %s", async (mode) => {
      const send = createSafeEmailSender({ ...smtpEnv, EMAIL_REMINDERS_MODE: mode }, { ignoreReminderMode: true });

      await expect(send(message)).resolves.toMatchObject({ status: "sent" });
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    test.each([
      ["disabled", "disabled"],
      ["dry_run", "dry_run"],
      ["send", "send"],
      [undefined, "send"],
    ])("EMAIL_REMINDERS_MODE=%s se informa como %s", (mode, expected) => {
      expect(getReminderMode({ ...smtpEnv, EMAIL_REMINDERS_MODE: mode })).toBe(expected);
    });
  });

  test("sin proveedor configurado el modo es simulación", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(getReminderMode({ EMAIL_REMINDERS_MODE: "send" })).toBe("dry_run");

    warn.mockRestore();
  });
});
