const request = require("supertest");
const { createDs160IntegrationApp } = require("../test-utils/ds160IntegrationHarness");

const USER = { id: 1, correo: "ana@example.com", nombre: "Ana" };

describe("integración: cargar y guardar el formulario DS-160", () => {
  let ctx;

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    ctx = createDs160IntegrationApp();
    ctx.addUser(USER);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("cargar el formulario de un usuario sin datos previos devuelve uno vacío en la sección 1", async () => {
    const response = await request(ctx.app).post("/ds160/load").send({ correo: USER.correo });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ datos: {}, seccion_actual: 1, completado: false });
  });

  test("guardar progreso parcial crea el formulario y luego cargarlo devuelve esos mismos datos", async () => {
    const datos = { apellidos: "Perez", nombres: "Ana" };

    const saved = await request(ctx.app).post("/ds160").send({ correo: USER.correo, datos, seccion_actual: 2 });
    expect(saved.status).toBe(200);
    expect(saved.body.formulario).toMatchObject({ datos, seccion_actual: 2, completado: false });

    const loaded = await request(ctx.app).post("/ds160/load").send({ correo: USER.correo });
    expect(loaded.body).toEqual({ datos, seccion_actual: 2, completado: false });
  });

  test("guardar dos veces actualiza el mismo formulario en lugar de crear uno nuevo", async () => {
    await request(ctx.app).post("/ds160").send({ correo: USER.correo, datos: { apellidos: "Perez" }, seccion_actual: 1 });
    await request(ctx.app).post("/ds160").send({ correo: USER.correo, datos: { apellidos: "Perez", nombres: "Ana" }, seccion_actual: 3 });

    expect(ctx.state.formularios).toHaveLength(1);
    const loaded = await request(ctx.app).post("/ds160/load").send({ correo: USER.correo });
    expect(loaded.body).toEqual({ datos: { apellidos: "Perez", nombres: "Ana" }, seccion_actual: 3, completado: false });
  });

  test("el autoguardado simula avances sucesivos de sección conservando los datos acumulados", async () => {
    const secciones = [
      { seccion_actual: 1, datos: { apellidos: "Perez" } },
      { seccion_actual: 2, datos: { apellidos: "Perez", nombres: "Ana" } },
      { seccion_actual: 3, datos: { apellidos: "Perez", nombres: "Ana", pasaporte: "G1234567" } },
    ];

    for (const paso of secciones) {
      const response = await request(ctx.app).post("/ds160").send({ correo: USER.correo, ...paso });
      expect(response.status).toBe(200);
      expect(response.body.formulario.seccion_actual).toBe(paso.seccion_actual);
    }

    expect(ctx.state.formularios).toHaveLength(1);
    expect(ctx.state.formularios[0].datos).toEqual(secciones[2].datos);
  });

  test("cargar y guardar responden 404 si el correo no pertenece a ningún usuario", async () => {
    const load = await request(ctx.app).post("/ds160/load").send({ correo: "nadie@example.com" });
    const save = await request(ctx.app).post("/ds160").send({ correo: "nadie@example.com", datos: {}, seccion_actual: 1 });

    expect(load.status).toBe(404);
    expect(save.status).toBe(404);
  });

  test("cargar y guardar exigen el correo en el body", async () => {
    const load = await request(ctx.app).post("/ds160/load").send({});
    const save = await request(ctx.app).post("/ds160").send({ datos: {} });

    expect(load.status).toBe(400);
    expect(save.status).toBe(400);
  });

  test("GET en /ds160 y /ds160/load responde 405 indicando que se debe usar POST", async () => {
    const response = await request(ctx.app).get("/ds160");

    expect(response.status).toBe(405);
  });

  test("completar el DS-160 avanza el trámite a la etapa de pago", async () => {
    ctx.addTramite({ userId: USER.id, progreso: 0 });

    const response = await request(ctx.app).post("/ds160").send({
      correo: USER.correo,
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

    const response = await request(ctx.app).post("/ds160").send({
      correo: USER.correo,
      datos: {},
      seccion_actual: 10,
      completado: true,
    });

    expect(response.status).toBe(200);
    expect(ctx.state.tramites[0].etapa_actual).toBeUndefined();
  });

  test("registra en la bitácora la creación y la actualización del formulario", async () => {
    await request(ctx.app).post("/ds160").send({ correo: USER.correo, datos: { apellidos: "Perez" }, seccion_actual: 1 });
    await request(ctx.app).post("/ds160").send({ correo: USER.correo, datos: { apellidos: "Perez" }, seccion_actual: 2 });

    const actions = ctx.activityLogService.logActivity.mock.calls.map(([entry]) => entry.description);
    expect(actions).toEqual(["Formulario DS-160 creado", "Formulario DS-160 actualizado"]);
  });
});

describe("integración: exportar el DS-160 a PDF", () => {
  let ctx;

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    ctx = createDs160IntegrationApp();
    ctx.addUser(USER);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("genera un PDF descargable a partir del formulario guardado", async () => {
    await request(ctx.app).post("/ds160").send({ correo: USER.correo, datos: { apellidos: "Perez", nombres: "Ana" }, seccion_actual: 5 });

    const response = await request(ctx.app).post("/ds160/pdf").send({ correo: USER.correo }).buffer(true).parse((res, cb) => {
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
    await request(ctx.app).post("/ds160").send({ correo: USER.correo, datos: {}, seccion_actual: 1 });

    await request(ctx.app).post("/ds160/pdf").send({ correo: USER.correo });

    expect(ctx.activityLogService.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: "ds160.pdf_exported",
      userId: USER.id,
    }));
  });

  test("no se puede exportar un formulario que no existe", async () => {
    const response = await request(ctx.app).post("/ds160/pdf").send({ correo: USER.correo });

    expect(response.status).toBe(404);
  });

  test("no se puede exportar el PDF de un usuario que no existe", async () => {
    const response = await request(ctx.app).post("/ds160/pdf").send({ correo: "nadie@example.com" });

    expect(response.status).toBe(404);
  });

  test("exportar el PDF exige el correo en el body", async () => {
    const response = await request(ctx.app).post("/ds160/pdf").send({});

    expect(response.status).toBe(400);
  });
});
