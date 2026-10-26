const http = require("http");
const request = require("supertest");
const { createAuthIntegrationApp, extractTokenFromMail } = require("../test-utils/authIntegrationHarness");
const { PRIVACY_CONSENT } = require("../test-utils/privacyConsent");

const USER = { nombre: "Ana Pérez", correo: "ana@example.com", contrasena: "clave-original-1", ...PRIVACY_CONSENT };
const HOUR_MS = 60 * 60 * 1000;

async function registerUser(target) {
  const client = typeof target === "function" || typeof target.address === "function"
    ? request(target)
    : target;
  const response = await client.post("/register").send(USER);
  expect(response.status).toBe(200);
  return response.body;
}

async function openTestServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return {
    api: request(server),
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

describe("integración: recuperación de contraseña", () => {
  let context;
  let api;
  let closeServer;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    context = createAuthIntegrationApp();
    ({ api, close: closeServer } = await openTestServer(context.app));
  });

  afterEach(async () => {
    try {
      if (closeServer) await closeServer();
    } finally {
      closeServer = undefined;
      jest.restoreAllMocks();
    }
  });

  test("olvidé mi contraseña → correo con enlace → restablecer → login con la nueva clave", async () => {
    const { mailbox } = context;
    await registerUser(api);
    mailbox.length = 0;

    const forgot = await api.post("/forgot-password").send({ correo: USER.correo });
    expect(forgot.status).toBe(200);
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0].to).toBe(USER.correo);
    const token = extractTokenFromMail(mailbox[0]);
    expect(token).toHaveLength(64);

    const reset = await api.post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });
    expect(reset.status).toBe(200);

    const oldLogin = await api.post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    const newLogin = await api.post("/login").send({ correo: USER.correo, contrasena: "clave-nueva-2" });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  test("restablecer la contraseña invalida todas las sesiones emitidas previamente (SP10-10)", async () => {
    const registered = await registerUser(api);
    const secondSession = await api.post("/login").send({
      correo: USER.correo,
      contrasena: USER.contrasena,
    });
    expect(secondSession.status).toBe(200);

    expect((await api.get("/recurso-protegido")
      .set("Authorization", `Bearer ${registered.token}`)).status).toBe(200);
    expect((await api.get("/recurso-protegido")
      .set("Authorization", `Bearer ${secondSession.body.token}`)).status).toBe(200);

    context.mailbox.length = 0;
    await api.post("/forgot-password").send({ correo: USER.correo });
    const resetToken = extractTokenFromMail(context.mailbox[0]);
    const reset = await api.post("/reset-password").send({
      token: resetToken,
      nuevaContrasena: "clave-nueva-2",
    });
    expect(reset.status).toBe(200);
    expect(context.state.users[0].session_version).toBe(1);

    expect((await api.get("/recurso-protegido")
      .set("Authorization", `Bearer ${registered.token}`)).status).toBe(401);
    expect((await api.get("/recurso-protegido")
      .set("Authorization", `Bearer ${secondSession.body.token}`)).status).toBe(401);

    const freshLogin = await api.post("/login").send({
      correo: USER.correo,
      contrasena: "clave-nueva-2",
    });
    expect(freshLogin.status).toBe(200);
    expect((await api.get("/recurso-protegido")
      .set("Authorization", `Bearer ${freshLogin.body.token}`)).status).toBe(200);
  });

  test("el enlace de recuperación solo se puede usar una vez", async () => {
    const { mailbox } = context;
    await registerUser(api);
    mailbox.length = 0;
    await api.post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    const first = await api.post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });
    const second = await api.post("/reset-password").send({ token, nuevaContrasena: "clave-otra-3" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    const login = await api.post("/login").send({ correo: USER.correo, contrasena: "clave-nueva-2" });
    expect(login.status).toBe(200);
  });

  test("dos restablecimientos simultáneos solo pueden consumir el token una vez", async () => {
    const { mailbox, state } = context;
    await registerUser(api);
    mailbox.length = 0;
    await api.post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);
    const candidates = ["clave-concurrente-2", "clave-concurrente-3"];

    const responses = await Promise.all(candidates.map((nuevaContrasena) => (
      api.post("/reset-password").send({ token, nuevaContrasena })
    )));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    expect(state.users[0].session_version).toBe(1);
    expect(state.passwordResets[0].used_at).toBeInstanceOf(Date);

    const winnerIndex = responses.findIndex((response) => response.status === 200);
    const freshLogin = await api.post("/login").send({
      correo: USER.correo,
      contrasena: candidates[winnerIndex],
    });
    expect(freshLogin.status).toBe(200);
  });

  test("el enlace de recuperación vence a la hora de emitido", async () => {
    const { mailbox, state } = context;
    await registerUser(api);
    mailbox.length = 0;
    const before = Date.now();
    await api.post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    const [record] = state.passwordResets;
    expect(record.expires_at.getTime() - before).toBeGreaterThanOrEqual(HOUR_MS - 1000);
    expect(record.expires_at.getTime() - before).toBeLessThanOrEqual(HOUR_MS + 5000);

    record.expires_at = new Date(Date.now() - 1000);
    const reset = await api.post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });

    expect(reset.status).toBe(400);
    const login = await api.post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    expect(login.status).toBe(200);
  });

  test("rechaza tokens inventados y contraseñas nuevas demasiado cortas", async () => {
    const { mailbox } = context;
    await registerUser(api);
    mailbox.length = 0;
    await api.post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    const fakeToken = await api.post("/reset-password").send({ token: "a".repeat(64), nuevaContrasena: "clave-nueva-2" });
    const shortPassword = await api.post("/reset-password").send({ token, nuevaContrasena: "123" });

    expect(fakeToken.status).toBe(400);
    expect(shortPassword.status).toBe(400);
    const login = await api.post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    expect(login.status).toBe(200);
  });

  test("no revela si un correo está registrado: la respuesta es idéntica y no se envía correo", async () => {
    const { mailbox } = context;
    await registerUser(api);
    mailbox.length = 0;

    const known = await api.post("/forgot-password").send({ correo: USER.correo });
    const unknown = await api.post("/forgot-password").send({ correo: "nadie@example.com" });

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0].to).toBe(USER.correo);
  });

  test("restablecer la contraseña deja el hash en bcrypt y registra la solicitud en la bitácora", async () => {
    const { mailbox, state, activityLogService } = context;
    await registerUser(api);
    mailbox.length = 0;
    await api.post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    await api.post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });

    expect(state.users[0].contrasena).toMatch(/^\$2[aby]\$/);
    const actions = activityLogService.logActivity.mock.calls.map(([entry]) => entry.action);
    expect(actions).toContain("user.password_reset_requested");
  });
  test("una contraseña nueva que no cumple la política se rechaza sin gastar el token ni cambiar la clave (SP10-05)", async () => {
    const { mailbox } = context;
    await registerUser(api);
    mailbox.length = 0;
    await api.post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    for (const nuevaContrasena of ["abcdef1", "12345678", "abcdefgh"]) {
      const weak = await api.post("/reset-password").send({ token, nuevaContrasena });
      expect([nuevaContrasena, weak.status]).toEqual([nuevaContrasena, 400]);
      expect(weak.body.error).toBe("La contraseña debe tener al menos 8 caracteres e incluir letras y números");
    }
    const stillOriginal = await api.post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    expect(stillOriginal.status).toBe(200);

    const valid = await api.post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });
    expect(valid.status).toBe(200);
  });
});

describe("integración: verificación de correo", () => {
  let context;
  let api;
  let closeServer;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    context = createAuthIntegrationApp();
    ({ api, close: closeServer } = await openTestServer(context.app));
  });

  afterEach(async () => {
    try {
      if (closeServer) await closeServer();
    } finally {
      closeServer = undefined;
      jest.restoreAllMocks();
    }
  });

  test("registro → correo de verificación → verificar → el login refleja el correo verificado", async () => {
    const { mailbox } = context;
    const registered = await registerUser(api);
    expect(registered.data.emailVerificado).toBe(false);
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0].text).toContain("/verificar-email?token=");
    const token = extractTokenFromMail(mailbox[0]);

    const verified = await api.post("/verificar-email").send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.usuario.emailVerificado).toBe(true);

    const login = await api.post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    expect(login.body.usuario.emailVerificado).toBe(true);
    const session = await api.get("/validar-sesion").set("Authorization", `Bearer ${login.body.token}`);
    expect(session.body.user.emailVerificado).toBe(true);
  });

  test("un usuario sin verificar puede iniciar sesión (el aviso no es bloqueante)", async () => {
    await registerUser(api);

    const login = await api.post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });

    expect(login.status).toBe(200);
    expect(login.body.usuario.emailVerificado).toBe(false);
  });

  test("el enlace de verificación solo funciona una vez y rechaza tokens inválidos", async () => {
    const { mailbox } = context;
    await registerUser(api);
    const token = extractTokenFromMail(mailbox[0]);

    const first = await api.post("/verificar-email").send({ token });
    const second = await api.post("/verificar-email").send({ token });
    const fake = await api.post("/verificar-email").send({ token: "b".repeat(64) });
    const missing = await api.post("/verificar-email").send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(fake.status).toBe(400);
    expect(missing.status).toBe(400);
  });

  test("reenviar verificación genera un enlace nuevo funcional mientras el correo esté sin verificar", async () => {
    const { mailbox } = context;
    await registerUser(api);

    const resend = await api.post("/reenviar-verificacion").send({ correo: USER.correo });
    expect(resend.status).toBe(200);
    expect(mailbox).toHaveLength(2);

    const newToken = extractTokenFromMail(mailbox[1]);
    const verified = await api.post("/verificar-email").send({ token: newToken });
    expect(verified.status).toBe(200);
  });

  test("reenviar verificación no envía correo si ya está verificado o el usuario no existe", async () => {
    const { mailbox } = context;
    await registerUser(api);
    await api.post("/verificar-email").send({ token: extractTokenFromMail(mailbox[0]) });
    mailbox.length = 0;

    const alreadyVerified = await api.post("/reenviar-verificacion").send({ correo: USER.correo });
    const unknown = await api.post("/reenviar-verificacion").send({ correo: "nadie@example.com" });

    expect(alreadyVerified.status).toBe(200);
    expect(alreadyVerified.body).toEqual(unknown.body);
    expect(mailbox).toHaveLength(0);
  });

  test("el registro sigue funcionando aunque el servicio de correo falle", async () => {
    const sendEmail = jest.fn(() => Promise.reject(new Error("smtp caído")));
    const { app } = createAuthIntegrationApp({ sendEmail });
    const customServer = await openTestServer(app);

    try {
      const registered = await customServer.api.post("/register").send(USER);
      const login = await customServer.api.post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });

      expect(registered.status).toBe(200);
      expect(registered.body.token).toEqual(expect.any(String));
      expect(sendEmail).toHaveBeenCalled();
      expect(login.status).toBe(200);
    } finally {
      await customServer.close();
    }
  });

});
