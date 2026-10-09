const request = require("supertest");
const {
  createAuthIntegrationApp,
  extractTokenFromMail,
  extractUnlockTokenFromMail,
} = require("../test-utils/authIntegrationHarness");

const USER = { nombre: "Ana Pérez", correo: "ana@example.com", contrasena: "clave-correcta-1" };
const MINUTE_MS = 60 * 1000;

async function setupUser() {
  const ctx = createAuthIntegrationApp();
  const registered = await request(ctx.app).post("/register").send(USER);
  expect(registered.status).toBe(200);
  ctx.mailbox.length = 0;
  ctx.activityLogService.logActivity.mockClear();
  return ctx;
}

function login(app, contrasena = USER.contrasena, correo = USER.correo) {
  return request(app).post("/login").send({ correo, contrasena });
}

async function failLogins(app, times, correo = USER.correo) {
  const responses = [];
  for (let i = 0; i < times; i += 1) {
    responses.push(await login(app, "clave-incorrecta", correo));
  }
  return responses;
}

describe("integración: bloqueo de cuenta tras intentos fallidos (RNF-13)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("el 5.º intento fallido bloquea la cuenta 15 minutos y envía un correo", async () => {
    const { app, state, mailbox, activityLogService } = await setupUser();

    const responses = await failLogins(app, 5);

    expect(responses.slice(0, 4).map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(responses[4].status).toBe(423);
    expect(responses[4].body.minutosRestantes).toBe(15);
    expect(responses[4].body.error).toContain("bloqueada temporalmente");

    const lockedFor = new Date(state.users[0].bloqueado_hasta).getTime() - Date.now();
    expect(lockedFor).toBeGreaterThan(14 * MINUTE_MS);
    expect(lockedFor).toBeLessThanOrEqual(15 * MINUTE_MS);
    expect(state.loginAttempts).toHaveLength(5);

    expect(mailbox).toHaveLength(1);
    expect(mailbox[0]).toMatchObject({ to: USER.correo, subject: expect.stringContaining("bloqueada") });
    expect(mailbox[0].html).toContain("Desbloquear mi cuenta");
    expect(extractUnlockTokenFromMail(mailbox[0])).toEqual(expect.any(String));

    const actions = activityLogService.logActivity.mock.calls.map(([entry]) => entry.action);
    expect(actions).toContain("user.account_locked");
  });

  test("durante el bloqueo rechaza incluso la contraseña correcta y no suma intentos", async () => {
    const { app, state, mailbox } = await setupUser();
    await failLogins(app, 5);

    const correct = await login(app);

    expect(correct.status).toBe(423);
    expect(correct.body.token).toBeUndefined();
    expect(state.loginAttempts).toHaveLength(5);
    expect(mailbox).toHaveLength(1);
  });

  test("al vencer el bloqueo se puede entrar y el contador vuelve a empezar", async () => {
    const { app, state } = await setupUser();
    await failLogins(app, 5);

    // Simula que pasaron los 15 minutos
    const pastLock = new Date(Date.now() - 16 * MINUTE_MS);
    state.users[0].bloqueado_hasta = new Date(Date.now() - MINUTE_MS);
    state.users[0].intentos_reset_en = pastLock;
    state.loginAttempts.forEach((attempt) => { attempt.created_at = pastLock; });

    const afterLock = await failLogins(app, 1);
    expect(afterLock[0].status).toBe(401);

    const correct = await login(app);
    expect(correct.status).toBe(200);
    expect(state.users[0].bloqueado_hasta).toBeNull();
  });

  test("un login exitoso reinicia el contador de intentos", async () => {
    const { app } = await setupUser();

    const before = await failLogins(app, 4);
    const success = await login(app);
    const after = await failLogins(app, 4);

    expect(success.status).toBe(200);
    expect([...before, ...after].map((r) => r.status)).toEqual(Array(8).fill(401));
  });

  test("los intentos de hace más de 15 minutos no cuentan para el bloqueo", async () => {
    const { app, state } = await setupUser();
    const old = new Date(Date.now() - 20 * MINUTE_MS);
    for (let i = 0; i < 4; i += 1) {
      state.loginAttempts.push({ id: 1000 + i, id_usuario: state.users[0].id_usuario, correo: USER.correo, ip: null, created_at: old });
    }

    const [response] = await failLogins(app, 1);

    expect(response.status).toBe(401);
    expect(state.users[0].bloqueado_hasta).toBeUndefined();
  });

  test("el enlace del correo desbloquea la cuenta una sola vez", async () => {
    const { app, mailbox, activityLogService } = await setupUser();
    await failLogins(app, 5);
    const token = extractUnlockTokenFromMail(mailbox[0]);

    const unlocked = await request(app).post("/desbloquear-cuenta").send({ token });
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.message).toContain("desbloqueada");
    expect((await login(app)).status).toBe(200);

    const reused = await request(app).post("/desbloquear-cuenta").send({ token });
    expect(reused.status).toBe(400);

    const actions = activityLogService.logActivity.mock.calls.map(([entry]) => entry.action);
    expect(actions).toContain("user.account_unlocked");
  });

  test("rechaza tokens de desbloqueo vacíos, inventados o vencidos", async () => {
    const { app, state, mailbox } = await setupUser();
    await failLogins(app, 5);
    const token = extractUnlockTokenFromMail(mailbox[0]);
    state.unlockTokens[0].expires_at = new Date(Date.now() - MINUTE_MS);

    expect((await request(app).post("/desbloquear-cuenta").send({})).status).toBe(400);
    expect((await request(app).post("/desbloquear-cuenta").send({ token: "a".repeat(64) })).status).toBe(400);
    expect((await request(app).post("/desbloquear-cuenta").send({ token })).status).toBe(400);
    expect((await login(app)).status).toBe(423);
  });

  test("restablecer la contraseña también levanta el bloqueo", async () => {
    const { app, mailbox } = await setupUser();
    await failLogins(app, 5);
    mailbox.length = 0;

    await request(app).post("/forgot-password").send({ correo: USER.correo });
    const resetToken = extractTokenFromMail(mailbox[0]);
    const reset = await request(app).post("/reset-password").send({ token: resetToken, nuevaContrasena: "clave-nueva-2" });

    expect(reset.status).toBe(200);
    expect((await login(app, "clave-nueva-2")).status).toBe(200);
  });

  test("los intentos con correos inexistentes se registran pero nunca bloquean ni envían correo", async () => {
    const { app, state, mailbox } = await setupUser();

    const responses = await failLogins(app, 7, "nadie@example.com");

    expect(responses.map((r) => r.status)).toEqual(Array(7).fill(401));
    expect(state.loginAttempts).toHaveLength(7);
    expect(state.loginAttempts.every((attempt) => attempt.id_usuario === null)).toBe(true);
    expect(mailbox).toHaveLength(0);
  });

  test("si el correo de aviso falla, la cuenta se bloquea igual", async () => {
    const sendEmail = jest.fn().mockRejectedValue(new Error("SMTP caído"));
    const { app, state } = createAuthIntegrationApp({ sendEmail });
    await request(app).post("/register").send(USER);

    const responses = await failLogins(app, 5);

    expect(responses[4].status).toBe(423);
    expect(state.users[0].bloqueado_hasta).toBeInstanceOf(Date);
  });
});
