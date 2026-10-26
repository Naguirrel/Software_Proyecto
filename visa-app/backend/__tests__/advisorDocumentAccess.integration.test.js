const request = require("supertest");
const fakeStorage = require("../test-utils/fakeStorage");
const { createDocumentsIntegrationApp, PDF_CONTENT } = require("../test-utils/documentsIntegrationHarness");

jest.mock("../storage", () => require("../test-utils/fakeStorage"));

// SP10-07: un asesor solo accede a los documentos de los clientes que tiene asignados.

const FORBIDDEN = "No puedes acceder a documentos de otro usuario";

function uploadPdf(app, token, usuarioId, nombre = "pasaporte.pdf") {
  return request(app)
    .post("/documentos")
    .set("Authorization", `Bearer ${token}`)
    .field("nombre", nombre)
    .field("usuario_id", String(usuarioId))
    .attach("file", PDF_CONTENT, { filename: nombre, contentType: "application/pdf" });
}

describe("integración: acceso del asesor a los documentos", () => {
  let ctx;
  let ana;
  let luis;
  let advisorOfAna;
  let otherAdvisor;
  let admin;
  let anaDocumentId;
  let luisDocumentId;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    fakeStorage.reset();
    ctx = createDocumentsIntegrationApp();
    ana = ctx.addUser({ id: 1, nombre: "Ana" });
    luis = ctx.addUser({ id: 2, nombre: "Luis" });
    advisorOfAna = ctx.addUser({ id: 5, rol: "asesor", nombre: "Asesora de Ana" });
    otherAdvisor = ctx.addUser({ id: 6, rol: "asesor", nombre: "Otro asesor" });
    admin = ctx.addUser({ id: 9, rol: "admin", nombre: "Admin" });
    ctx.assignAdvisor(1, 5);
    ctx.assignAdvisor(2, 6);
    anaDocumentId = (await uploadPdf(ctx.app, ana.token, 1)).body.documento.id;
    luisDocumentId = (await uploadPdf(ctx.app, luis.token, 2)).body.documento.id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const get = (path, token) => request(ctx.app).get(path).set("Authorization", `Bearer ${token}`);

  test("el asesor lista los documentos de su cliente asignado", async () => {
    const byParam = await get("/documentos/1", advisorOfAna.token);
    const byBody = await request(ctx.app).post("/documentos/listar").set("Authorization", `Bearer ${advisorOfAna.token}`).send({ usuario_id: 1 });

    expect(byParam.status).toBe(200);
    expect(byParam.body.map((doc) => doc.id)).toEqual([anaDocumentId]);
    expect(byBody.status).toBe(200);
    expect(byBody.body.map((doc) => doc.id)).toEqual([anaDocumentId]);
  });

  test("el asesor no puede listar los documentos de un cliente que no tiene asignado", async () => {
    const byParam = await get("/documentos/2", advisorOfAna.token);
    const byBody = await request(ctx.app).post("/documentos/listar").set("Authorization", `Bearer ${advisorOfAna.token}`).send({ usuario_id: 2 });

    expect(byParam.status).toBe(403);
    expect(byParam.body.error).toBe(FORBIDDEN);
    expect(byBody.status).toBe(403);
    expect(JSON.stringify(byParam.body)).not.toContain("pasaporte");
  });

  test("el asesor abre el archivo de su cliente pero no el de un cliente ajeno", async () => {
    const own = await get(`/documentos/${anaDocumentId}/archivo`, advisorOfAna.token);
    const foreign = await get(`/documentos/${luisDocumentId}/archivo`, advisorOfAna.token);

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toBe(FORBIDDEN);
  });

  test("el asesor no puede subir documentos a nombre de un cliente ajeno", async () => {
    const own = await uploadPdf(ctx.app, advisorOfAna.token, 1, "complemento.pdf");
    const foreign = await uploadPdf(ctx.app, advisorOfAna.token, 2, "intruso.pdf");

    expect(own.status).toBe(201);
    expect(foreign.status).toBe(403);
    expect(ctx.state.documentos.filter((doc) => doc.usuario_id === 2)).toHaveLength(1);
  });

  test("el asesor no puede eliminar documentos de un cliente ajeno", async () => {
    const foreign = await request(ctx.app)
      .delete(`/documentos/${luisDocumentId}`)
      .set("Authorization", `Bearer ${advisorOfAna.token}`)
      .send({ usuario_id: 2 });
    const own = await request(ctx.app)
      .delete(`/documentos/${anaDocumentId}`)
      .set("Authorization", `Bearer ${advisorOfAna.token}`)
      .send({ usuario_id: 1 });

    expect(foreign.status).toBe(403);
    expect(own.status).toBe(200);
    expect(ctx.state.documentos.map((doc) => doc.id)).toEqual([luisDocumentId]);
  });

  test("un asesor sin clientes asignados no accede a ningún documento", async () => {
    const loner = ctx.addUser({ id: 7, rol: "asesor", nombre: "Sin clientes" });

    const list = await get("/documentos/1", loner.token);
    const file = await get(`/documentos/${anaDocumentId}/archivo`, loner.token);

    expect(list.status).toBe(403);
    expect(file.status).toBe(403);
  });

  test("al reasignar al cliente el asesor anterior pierde el acceso y el nuevo lo obtiene", async () => {
    ctx.assignAdvisor(1, 6);

    const previous = await get("/documentos/1", advisorOfAna.token);
    const next = await get("/documentos/1", otherAdvisor.token);

    expect(previous.status).toBe(403);
    expect(next.status).toBe(200);
    expect(next.body.map((doc) => doc.id)).toEqual([anaDocumentId]);
  });

  test("el administrador sigue accediendo a los documentos de cualquier cliente", async () => {
    const list = await get("/documentos/2", admin.token);
    const file = await get(`/documentos/${luisDocumentId}/archivo`, admin.token);

    expect(list.status).toBe(200);
    expect(file.status).toBe(200);
  });

  test("el cliente sigue accediendo solo a sus documentos", async () => {
    const own = await get("/documentos/1", ana.token);
    const foreign = await get("/documentos/2", ana.token);
    const foreignFile = await get(`/documentos/${luisDocumentId}/archivo`, ana.token);

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(403);
    expect(foreignFile.status).toBe(403);
  });

  test("un asesor asignado a un cliente no es asesor de otro: la asignación es por cliente", async () => {
    const ownList = await get("/documentos/2", otherAdvisor.token);
    const crossList = await get("/documentos/1", otherAdvisor.token);

    expect(ownList.status).toBe(200);
    expect(crossList.status).toBe(403);
  });

  test("sin sesión no se accede a ningún documento", async () => {
    const response = await request(ctx.app).get("/documentos/1");

    expect(response.status).toBe(401);
  });
});
