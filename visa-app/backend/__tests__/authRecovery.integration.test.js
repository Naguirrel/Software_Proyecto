const request = require("supertest");
const { createAuthIntegrationApp, extractTokenFromMail } = require("../test-utils/authIntegrationHarness");

const USER = { nombre: "Ana Pérez", correo: "ana@example.com", contrasena: "clave-original-1" };
const HOUR_MS = 60 * 60 * 1000;

async function registerUser(app) {
  const response = await request(app).post("/register").send(USER);
  expect(response.status).toBe(200);
  return response.body;
}

describe("integración: recuperación de contraseña", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("olvidé mi contraseña → correo con enlace → restablecer → login con la nueva clave", async () => {
    const { app, mailbox } = createAuthIntegrationApp();
    await registerUser(app);
    mailbox.length = 0;

    const forgot = await request(app).post("/forgot-password").send({ correo: USER.correo });
    expect(forgot.status).toBe(200);
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0].to).toBe(USER.correo);
    const token = extractTokenFromMail(mailbox[0]);
    expect(token).toHaveLength(64);

    const reset = await request(app).post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app).post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    const newLogin = await request(app).post("/login").send({ correo: USER.correo, contrasena: "clave-nueva-2" });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  test("el enlace de recuperación solo se puede usar una vez", async () => {
    const { app, mailbox } = createAuthIntegrationApp();
    await registerUser(app);
    mailbox.length = 0;
    await request(app).post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    const first = await request(app).post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });
    const second = await request(app).post("/reset-password").send({ token, nuevaContrasena: "clave-otra-3" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    const login = await request(app).post("/login").send({ correo: USER.correo, contrasena: "clave-nueva-2" });
    expect(login.status).toBe(200);
  });

  test("el enlace de recuperación vence a la hora de emitido", async () => {
    const { app, mailbox, state } = createAuthIntegrationApp();
    await registerUser(app);
    mailbox.length = 0;
    const before = Date.now();
    await request(app).post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    const [record] = state.passwordResets;
    expect(record.expires_at.getTime() - before).toBeGreaterThanOrEqual(HOUR_MS - 1000);
    expect(record.expires_at.getTime() - before).toBeLessThanOrEqual(HOUR_MS + 5000);

    record.expires_at = new Date(Date.now() - 1000);
    const reset = await request(app).post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });

    expect(reset.status).toBe(400);
    const login = await request(app).post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    expect(login.status).toBe(200);
  });

  test("rechaza tokens inventados y contraseñas nuevas demasiado cortas", async () => {
    const { app, mailbox } = createAuthIntegrationApp();
    await registerUser(app);
    mailbox.length = 0;
    await request(app).post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    const fakeToken = await request(app).post("/reset-password").send({ token: "a".repeat(64), nuevaContrasena: "clave-nueva-2" });
    const shortPassword = await request(app).post("/reset-password").send({ token, nuevaContrasena: "123" });

    expect(fakeToken.status).toBe(400);
    expect(shortPassword.status).toBe(400);
    const login = await request(app).post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    expect(login.status).toBe(200);
  });

  test("no revela si un correo está registrado: la respuesta es idéntica y no se envía correo", async () => {
    const { app, mailbox } = createAuthIntegrationApp();
    await registerUser(app);
    mailbox.length = 0;

    const known = await request(app).post("/forgot-password").send({ correo: USER.correo });
    const unknown = await request(app).post("/forgot-password").send({ correo: "nadie@example.com" });

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0].to).toBe(USER.correo);
  });

  test("restablecer la contraseña deja el hash en bcrypt y registra la solicitud en la bitácora", async () => {
    const { app, mailbox, state, activityLogService } = createAuthIntegrationApp();
    await registerUser(app);
    mailbox.length = 0;
    await request(app).post("/forgot-password").send({ correo: USER.correo });
    const token = extractTokenFromMail(mailbox[0]);

    await request(app).post("/reset-password").send({ token, nuevaContrasena: "clave-nueva-2" });

    expect(state.users[0].contrasena).toMatch(/^\$2[aby]\$/);
    const actions = activityLogService.logActivity.mock.calls.map(([entry]) => entry.action);
    expect(actions).toContain("user.password_reset_requested");
  });
});

describe("integración: verificación de correo", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("registro → correo de verificación → verificar → el login refleja el correo verificado", async () => {
    const { app, mailbox } = createAuthIntegrationApp();
    const registered = await registerUser(app);
    expect(registered.data.emailVerificado).toBe(false);
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0].text).toContain("/verificar-email?token=");
    const token = extractTokenFromMail(mailbox[0]);

    const verified = await request(app).post("/verificar-email").send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.usuario.emailVerificado).toBe(true);

    const login = await request(app).post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });
    expect(login.body.usuario.emailVerificado).toBe(true);
    const session = await request(app).get("/validar-sesion").set("Authorization", `Bearer ${login.body.token}`);
    expect(session.body.user.emailVerificado).toBe(true);
  });

  test("un usuario sin verificar puede iniciar sesión (el aviso no es bloqueante)", async () => {
    const { app } = createAuthIntegrationApp();
    await registerUser(app);

    const login = await request(app).post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });

    expect(login.status).toBe(200);
    expect(login.body.usuario.emailVerificado).toBe(false);
  });

  test("el enlace de verificación solo funciona una vez y rechaza tokens inválidos", async () => {
    const { app, mailbox } = createAuthIntegrationApp();
    await registerUser(app);
    const token = extractTokenFromMail(mailbox[0]);

    const first = await request(app).post("/verificar-email").send({ token });
    const second = await request(app).post("/verificar-email").send({ token });
    const fake = await request(app).post("/verificar-email").send({ token: "b".repeat(64) });
    const missing = await request(app).post("/verificar-email").send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(fake.status).toBe(400);
    expect(missing.status).toBe(400);
  });

  test("reenviar verificación genera un enlace nuevo funcional mientras el correo esté sin verificar", async () => {
    const { app, mailbox } = createAuthIntegrationApp();
    await registerUser(app);

    const resend = await request(app).post("/reenviar-verificacion").send({ correo: USER.correo });
    expect(resend.status).toBe(200);
    expect(mailbox).toHaveLength(2);

    const newToken = extractTokenFromMail(mailbox[1]);
    const verified = await request(app).post("/verificar-email").send({ token: newToken });
    expect(verified.status).toBe(200);
  });

  test("reenviar verificación no envía correo si ya está verificado o el usuario no existe", async () => {
    const { app, mailbox } = createAuthIntegrationApp();
    await registerUser(app);
    await request(app).post("/verificar-email").send({ token: extractTokenFromMail(mailbox[0]) });
    mailbox.length = 0;

    const alreadyVerified = await request(app).post("/reenviar-verificacion").send({ correo: USER.correo });
    const unknown = await request(app).post("/reenviar-verificacion").send({ correo: "nadie@example.com" });

    expect(alreadyVerified.status).toBe(200);
    expect(alreadyVerified.body).toEqual(unknown.body);
    expect(mailbox).toHaveLength(0);
  });

  test("el registro sigue funcionando aunque el servicio de correo falle", async () => {
    const sendEmail = jest.fn(() => Promise.reject(new Error("smtp caído")));
    const { app } = createAuthIntegrationApp({ sendEmail });

    const registered = await request(app).post("/register").send(USER);
    const login = await request(app).post("/login").send({ correo: USER.correo, contrasena: USER.contrasena });

    expect(registered.status).toBe(200);
    expect(registered.body.token).toEqual(expect.any(String));
    expect(sendEmail).toHaveBeenCalled();
    expect(login.status).toBe(200);
  });
});
