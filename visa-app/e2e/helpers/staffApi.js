const { request: playwrightRequest } = require("@playwright/test");
const { API_URL, ADMIN, ADVISOR } = require("../env");

// Acciones del personal (administrador y asesor) que el cliente no puede hacer desde su
// pantalla pero que el flujo exige para avanzar de etapa. Usa la API real del backend.
class StaffApi {
  constructor(context, tokens) {
    this.context = context;
    this.tokens = tokens;
  }

  static async create() {
    const context = await playwrightRequest.newContext({ baseURL: API_URL });
    const login = async (user) => {
      const response = await context.post("/login", { data: { correo: user.correo, contrasena: user.contrasena } });
      if (!response.ok()) throw new Error(`Login de ${user.correo} falló: ${response.status()} ${await response.text()}`);
      const body = await response.json();
      return { token: body.token, id: body.usuario.id_usuario };
    };
    const admin = await login(ADMIN);
    const advisor = await login(ADVISOR);
    return new StaffApi(context, { admin, advisor });
  }

  async dispose() {
    await this.context.dispose();
  }

  headers(role) {
    return { Authorization: `Bearer ${this.tokens[role].token}` };
  }

  async call(method, path, role, options = {}) {
    const response = await this.context[method](path, { headers: this.headers(role), ...options });
    if (!response.ok()) {
      throw new Error(`${method.toUpperCase()} ${path} respondió ${response.status()}: ${await response.text()}`);
    }
    return response.status() === 204 ? null : response.json();
  }
}

// --- Acciones concretas del flujo --------------------------------------------------------

StaffApi.prototype.loginClient = async function loginClient(user) {
  const response = await this.context.post("/login", { data: { correo: user.correo, contrasena: user.contrasena } });
  if (!response.ok()) throw new Error(`Login del cliente falló: ${response.status()}`);
  const body = await response.json();
  return { token: body.token, id: body.usuario.id_usuario };
};

// El administrador asigna el asesor al trámite del cliente (desbloquea DS-160 y chat).
StaffApi.prototype.assignAdvisor = async function assignAdvisor(clientEmail) {
  const { casos } = await this.call("get", "/admin/assignments", "admin");
  const found = casos.find((item) => item.correo === clientEmail);
  if (!found) throw new Error(`No hay un trámite sin asignar para ${clientEmail}`);
  await this.call("post", "/admin/assignments", "admin", {
    data: { tramiteId: found.id, asesorId: this.tokens.advisor.id },
  });
};

// El administrador aprueba todos los documentos cargados por el cliente.
StaffApi.prototype.approveDocuments = async function approveDocuments(clientEmail) {
  const { documentos } = await this.call("get", "/admin/documents", "admin");
  const own = documentos.filter((item) => item.usuario?.correo === clientEmail);
  for (const documento of own) {
    await this.call("put", `/admin/documents/${documento.id}/status`, "admin", { data: { status: "approved" } });
  }
  return own.length;
};

// El asesor confirma la transferencia, inicia la gestión y registra el recibo consular oficial.
StaffApi.prototype.completeConsularPayment = async function completeConsularPayment(clientEmail, receiptFile) {
  const { cases } = await this.call("get", "/staff/consular-cases", "advisor");
  const found = cases.find((item) => item.correo === clientEmail);
  if (!found) throw new Error(`No hay un caso consular para ${clientEmail}`);
  const paymentId = found.payment_id;
  await this.call("post", `/staff/consular-payments/${paymentId}/review-transfer`, "advisor", { data: { approved: true } });
  await this.call("post", `/staff/consular-payments/${paymentId}/start`, "advisor");
  await this.call("post", `/staff/consular-payments/${paymentId}/receipt`, "advisor", {
    multipart: { receiptNumber: `RC-${Date.now()}`, notes: "Pago consular registrado en el E2E", file: receiptFile },
  });
};

// El asesor registra la cita oficial (debe ser futura y posterior al pago consular).
StaffApi.prototype.registerAppointment = async function registerAppointment(clientId, confirmationCode) {
  const appointmentAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
  await this.call("put", `/staff/consular-cases/${clientId}/appointment`, "advisor", {
    data: { appointmentAt, confirmationCode, notes: "Cita registrada en el E2E" },
  });
};

module.exports = { StaffApi };
