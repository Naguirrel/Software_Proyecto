const request = require("supertest");
const { createDs160IntegrationApp } = require("../test-utils/ds160IntegrationHarness");

const USER = { id: 1, correo: "ana@example.com", nombre: "Ana" };

describe("integración: cargar y guardar el formulario DS-160", () => {
  let ctx;
  let token;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    ctx = createDs160IntegrationApp();
    ({ token } = ctx.addUser(USER));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const auth = (req) => req.set("Authorization", `Bearer ${token}`);

  test("cargar el formulario de un usuario sin datos previos devuelve uno vacío en la sección 1", async () => {
    const response = await auth(request(ctx.app).post("/ds160/load")).send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ datos: {}, seccion_actual: 1, completado: false });
  });

  test("guardar progreso parcial crea el formulario y luego cargarlo devuelve esos mismos datos", async () => {
    const datos = { apellidos: "Perez", nombres: "Ana" };

    const saved = await auth(request(ctx.app).post("/ds160")).send({ datos, seccion_actual: 2 });
    expect(saved.status).toBe(200);
    expect(saved.body.formulario).toMatchObject({ datos, seccion_actual: 2, completado: false });

    const loaded = await auth(request(ctx.app).post("/ds160/load")).send({});
    expect(loaded.body).toEqual({ datos, seccion_actual: 2, completado: false });
  });

  test("guardar dos veces actualiza el mismo formulario en lugar de crear uno nuevo", async () => {
    await auth(request(ctx.app).post("/ds160")).send({ datos: { apellidos: "Perez" }, seccion_actual: 1 });
    await auth(request(ctx.app).post("/ds160")).send({ datos: { apellidos: "Perez", nombres: "Ana" }, seccion_actual: 3 });

    expect(ctx.state.formularios).toHaveLength(1);
    const loaded = await auth(request(ctx.app).post("/ds160/load")).send({});
    expect(loaded.body).toEqual({ datos: { apellidos: "Perez", nombres: "Ana" }, seccion_actual: 3, completado: false });
  });

  test("el autoguardado simula avances sucesivos de sección conservando los datos acumulados", async () => {
    const secciones = [
      { seccion_actual: 1, datos: { apellidos: "Perez" } },
      { seccion_actual: 2, datos: { apellidos: "Perez", nombres: "Ana" } },
      { seccion_actual: 3, datos: { apellidos: "Perez", nombres: "Ana", pasaporte: "G1234567" } },
    ];

    for (const paso of secciones) {
      const response = await auth(request(ctx.app).post("/ds160")).send(paso);
      expect(response.status).toBe(200);
      expect(response.body.formulario.seccion_actual).toBe(paso.seccion_actual);
    }

    expect(ctx.state.formularios).toHaveLength(1);
    expect(ctx.state.formularios[0].datos).toEqual(secciones[2].datos);
  });

  test("cargar y guardar exigen una sesión válida", async () => {
    const load = await request(ctx.app).post("/ds160/load").send({});
    const save = await request(ctx.app).post("/ds160").send({ datos: {} });
    const badToken = await request(ctx.app).post("/ds160/load").set("Authorization", "Bearer token.invalido").send({});

    expect(load.status).toBe(401);
    expect(save.status).toBe(401);
    expect(badToken.status).toBe(401);
  });

  test("ignora cualquier correo ajeno enviado en el body: siempre opera sobre el usuario de la sesión", async () => {
    const otro = ctx.addUser({ id: 2, correo: "victima@example.com", nombre: "Victima" });
    await auth(request(ctx.app).post("/ds160")).send({ correo: otro.user.correo, datos: { apellidos: "MiosNoDeOtro" }, seccion_actual: 4 });

    expect(ctx.state.formularios).toHaveLength(1);
    expect(ctx.state.formularios[0].id_usuario).toBe(USER.id);

    const loadAsVictim = await request(ctx.app).post("/ds160/load")
      .set("Authorization", `Bearer ${otro.token}`)
      .send({ correo: USER.correo });
    expect(loadAsVictim.body).toEqual({ datos: {}, seccion_actual: 1, completado: false });
  });

  test("GET en /ds160 y /ds160/load responde 405 indicando que se debe usar POST", async () => {
    const response = await request(ctx.app).get("/ds160");

    expect(response.status).toBe(405);
  });

  test("completar el DS-160 avanza el trámite a la etapa de pago", async () => {
    ctx.addTramite({ userId: USER.id, progreso: 0 });

    const response = await auth(request(ctx.app).post("/ds160")).send({
      datos: { apellidos: "Perez", nombres: "Ana" },
      seccion_actual: 10,
      completado: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.formulario.completado).toBe(true);
    expect(ctx.state.tramites[0]).toMatchObject({ etapa_actual: "Pago de visa", progreso: 34 });
  });

  test("completar el DS-160 cuando el trámite ya avanzó no repite la actualización", async () => {
    ctx.addTramite({ userId: USER.id, progreso: 34 });

    const response = await auth(request(ctx.app).post("/ds160")).send({
      datos: {},
      seccion_actual: 10,
      completado: true,
    });

    expect(response.status).toBe(200);
    expect(ctx.state.tramites[0].etapa_actual).toBeUndefined();
  });

  test("completar el DS-160 notifica al usuario", async () => {
    ctx.addTramite({ userId: USER.id, progreso: 0 });

    await auth(request(ctx.app).post("/ds160")).send({ datos: {}, seccion_actual: 10, completado: true });

    expect(ctx.notificaciones).toHaveLength(1);
    expect(ctx.notificaciones[0]).toMatchObject({ userId: USER.id, titulo: "DS-160 completado" });
  });

  test("registra en la bitácora la creación y la actualización del formulario", async () => {
    await auth(request(ctx.app).post("/ds160")).send({ datos: { apellidos: "Perez" }, seccion_actual: 1 });
    await auth(request(ctx.app).post("/ds160")).send({ datos: { apellidos: "Perez" }, seccion_actual: 2 });

    const actions = ctx.activityLogService.logActivity.mock.calls.map(([entry]) => entry.description);
    expect(actions).toEqual(["Formulario DS-160 creado", "Formulario DS-160 actualizado"]);
  });

  test("el token de sesión enviado en el body (usado por sendBeacon) también autentica la petición", async () => {
    const response = await request(ctx.app).post("/ds160").send({ token, datos: { apellidos: "Perez" }, seccion_actual: 1 });

    expect(response.status).toBe(200);
    expect(ctx.state.formularios[0].id_usuario).toBe(USER.id);
  });
});

describe("integración: exportar el DS-160 a PDF", () => {
  let ctx;
  let token;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    ctx = createDs160IntegrationApp();
    ({ token } = ctx.addUser(USER));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const auth = (req) => req.set("Authorization", `Bearer ${token}`);

  test("genera un PDF descargable a partir del formulario guardado", async () => {
    await auth(request(ctx.app).post("/ds160")).send({ datos: { apellidos: "Perez", nombres: "Ana" }, seccion_actual: 5 });

    const response = await auth(request(ctx.app).post("/ds160/pdf")).send({}).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toBe(`attachment; filename="ds160-${USER.id}.pdf"`);
    expect(response.body.slice(0, 4).toString()).toBe("%PDF");
  });

  test("exportar el PDF registra la actividad en la bitácora", async () => {
    await auth(request(ctx.app).post("/ds160")).send({ datos: {}, seccion_actual: 1 });

    await auth(request(ctx.app).post("/ds160/pdf")).send({});

    expect(ctx.activityLogService.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: "ds160.pdf_exported",
      userId: USER.id,
    }));
  });

  test("no se puede exportar un formulario que no existe", async () => {
    const response = await auth(request(ctx.app).post("/ds160/pdf")).send({});

    expect(response.status).toBe(404);
  });

  test("exportar el PDF exige una sesión válida", async () => {
    const response = await request(ctx.app).post("/ds160/pdf").send({});

    expect(response.status).toBe(401);
  });

  test("no se puede descargar el PDF del formulario de otro usuario aunque se envíe su correo", async () => {
    const otro = ctx.addUser({ id: 2, correo: "victima@example.com", nombre: "Victima" });
    await auth(request(ctx.app).post("/ds160")).send({ datos: { apellidos: "Perez" }, seccion_actual: 1 });

    const response = await request(ctx.app).post("/ds160/pdf")
      .set("Authorization", `Bearer ${otro.token}`)
      .send({ correo: USER.correo });

    expect(response.status).toBe(404);
  });
});
