const request = require("supertest");
const bcrypt = require("bcrypt");
const { createAuthIntegrationApp } = require("../test-utils/authIntegrationHarness");

const NEW_USER = { nombre: "Ana Pérez", correo: "ana@example.com", contrasena: "clave-segura-123" };

describe("integración: registro, login y sesión", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("registro → login → validar sesión → recurso protegido", async () => {
    const { app, state } = createAuthIntegrationApp();

    const registered = await request(app).post("/register").send(NEW_USER);
    expect(registered.status).toBe(200);
    expect(registered.body.token).toEqual(expect.any(String));
    expect(registered.body.data).toMatchObject({ correo: "ana@example.com", rol: "cliente", emailVerificado: false });
    expect(state.tramites).toHaveLength(1);

    const login = await request(app).post("/login").send({ correo: NEW_USER.correo, contrasena: NEW_USER.contrasena });
    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
    expect(login.body.usuario.id_usuario).toBe(registered.body.data.id_usuario);

    const session = await request(app).get("/validar-sesion").set("Authorization", `Bearer ${login.body.token}`);
    expect(session.status).toBe(200);
    expect(session.body).toMatchObject({ valid: true, user: { correo: "ana@example.com" } });

    const protectedResource = await request(app).get("/recurso-protegido").set("Authorization", `Bearer ${login.body.token}`);
    expect(protectedResource.status).toBe(200);
    expect(protectedResource.body.correo).toBe("ana@example.com");
  });

  test("el token entregado al registrarse ya permite acceder sin hacer login", async () => {
    const { app } = createAuthIntegrationApp();

    const registered = await request(app).post("/register").send(NEW_USER);
    const session = await request(app).get("/validar-sesion").set("Authorization", `Bearer ${registered.body.token}`);

    expect(session.status).toBe(200);
    expect(session.body.valid).toBe(true);
  });

  test("la contraseña se guarda con bcrypt y nunca se devuelve en las respuestas", async () => {
    const { app, state } = createAuthIntegrationApp();

    const registered = await request(app).post("/register").send(NEW_USER);
    const login = await request(app).post("/login").send({ correo: NEW_USER.correo, contrasena: NEW_USER.contrasena });

    expect(state.users[0].contrasena).not.toBe(NEW_USER.contrasena);
    expect(await bcrypt.compare(NEW_USER.contrasena, state.users[0].contrasena)).toBe(true);
    expect(JSON.stringify(registered.body)).not.toContain("contrasena");
    expect(JSON.stringify(login.body)).not.toContain(state.users[0].contrasena);
  });

  test("normaliza el correo al registrar: el login funciona con el correo en minúsculas", async () => {
    const { app } = createAuthIntegrationApp();

    await request(app).post("/register").send({ ...NEW_USER, correo: "  ANA@Example.com " });
    const login = await request(app).post("/login").send({ correo: "ana@example.com", contrasena: NEW_USER.contrasena });

    expect(login.status).toBe(200);
  });

  test("rechaza registros incompletos o con correo inválido sin crear usuarios", async () => {
    const { app, state } = createAuthIntegrationApp();

    const missing = await request(app).post("/register").send({ correo: "ana@example.com" });
    const invalidEmail = await request(app).post("/register").send({ ...NEW_USER, correo: "no-es-correo" });

    expect(missing.status).toBe(400);
    expect(invalidEmail.status).toBe(400);
    expect(state.users).toHaveLength(0);
  });

  test("no permite registrar dos veces el mismo correo", async () => {
    const { app, state } = createAuthIntegrationApp();

    await request(app).post("/register").send(NEW_USER);
    const duplicate = await request(app).post("/register").send(NEW_USER);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("El correo ya está registrado");
    expect(duplicate.body.token).toBeUndefined();
    expect(state.users).toHaveLength(1);
  });

  test("login rechaza contraseña incorrecta y correo inexistente con el mismo mensaje", async () => {
    const { app } = createAuthIntegrationApp();
    await request(app).post("/register").send(NEW_USER);

    const wrongPassword = await request(app).post("/login").send({ correo: NEW_USER.correo, contrasena: "otra-clave" });
    const unknownUser = await request(app).post("/login").send({ correo: "nadie@example.com", contrasena: "otra-clave" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownUser.body.error);
    expect(wrongPassword.body.token).toBeUndefined();
  });

  test("login bloquea las cuentas desactivadas y su token deja de ser válido", async () => {
    const { app, state } = createAuthIntegrationApp();
    const registered = await request(app).post("/register").send(NEW_USER);

    state.users[0].activo = false;

    const login = await request(app).post("/login").send({ correo: NEW_USER.correo, contrasena: NEW_USER.contrasena });
    const session = await request(app).get("/validar-sesion").set("Authorization", `Bearer ${registered.body.token}`);

    expect(login.status).toBe(403);
    expect(session.status).toBe(401);
  });

  test("migra a bcrypt una contraseña legacy en texto plano al iniciar sesión", async () => {
    const { app, state } = createAuthIntegrationApp();
    await request(app).post("/register").send(NEW_USER);
    state.users[0].contrasena = "clave-legacy";

    const login = await request(app).post("/login").send({ correo: NEW_USER.correo, contrasena: "clave-legacy" });

    expect(login.status).toBe(200);
    expect(state.users[0].contrasena).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare("clave-legacy", state.users[0].contrasena)).toBe(true);
  });

  test("registra actividad de registro y login", async () => {
    const { app, activityLogService } = createAuthIntegrationApp();

    await request(app).post("/register").send(NEW_USER);
    await request(app).post("/login").send({ correo: NEW_USER.correo, contrasena: NEW_USER.contrasena });

    const actions = activityLogService.logActivity.mock.calls.map(([entry]) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(["user.registered", "user.login"]));
  });

  test("las rutas protegidas rechazan peticiones sin token, con token manipulado o de otro esquema", async () => {
    const { app } = createAuthIntegrationApp();
    const registered = await request(app).post("/register").send(NEW_USER);
    const [payload] = registered.body.token.split(".");

    const withoutToken = await request(app).get("/validar-sesion");
    const tampered = await request(app).get("/validar-sesion").set("Authorization", `Bearer ${payload}.firma-falsa`);
    const wrongScheme = await request(app).get("/validar-sesion").set("Authorization", `Basic ${registered.body.token}`);

    expect(withoutToken.status).toBe(401);
    expect(tampered.status).toBe(401);
    expect(wrongScheme.status).toBe(401);
  });

  test("un token expirado deja de dar acceso", async () => {
    const { app } = createAuthIntegrationApp();
    const registered = await request(app).post("/register").send(NEW_USER);

    const realNow = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(realNow + 9 * 60 * 60 * 1000);
    const session = await request(app).get("/validar-sesion").set("Authorization", `Bearer ${registered.body.token}`);

    expect(session.status).toBe(401);
  });
});
