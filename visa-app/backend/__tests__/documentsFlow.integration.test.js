const request = require("supertest");
const fakeStorage = require("../test-utils/fakeStorage");
const { createDocumentsIntegrationApp, PDF_CONTENT } = require("../test-utils/documentsIntegrationHarness");

jest.mock("../storage", () => require("../test-utils/fakeStorage"));

const flushCleanup = () => new Promise((resolve) => setImmediate(resolve));

function uploadPdf(app, token, { usuarioId, documentoKey, nombre = "pasaporte.pdf", content = PDF_CONTENT, path = "/documentos" } = {}) {
  const req = request(app)
    .post(path)
    .set("Authorization", `Bearer ${token}`)
    .field("nombre", nombre)
    .field("usuario_id", String(usuarioId));
  if (documentoKey) req.field("documento_key", documentoKey);
  return req.attach("file", content, { filename: nombre, contentType: "application/pdf" });
}

describe("integración: flujo de documentos del cliente", () => {
  let ctx;
  let ana;
  let luis;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    fakeStorage.reset();
    ctx = createDocumentsIntegrationApp();
    ana = ctx.addUser({ id: 1, nombre: "Ana" });
    luis = ctx.addUser({ id: 2, nombre: "Luis" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("subir → listar → ver archivo → eliminar", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "pasaporte" });
    expect(created.status).toBe(201);
    expect(created.body.documento).toMatchObject({ nombre: "pasaporte.pdf", estado: "review", usuario_id: 1, documento_key: "pasaporte" });
    const { id } = created.body.documento;

    const listed = await request(ctx.app).get("/documentos/1").set("Authorization", `Bearer ${ana.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(id);

    const file = await request(ctx.app).get(`/documentos/${id}/archivo`).set("Authorization", `Bearer ${ana.token}`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("application/pdf");
    expect(file.headers["content-disposition"]).toMatch(/^inline; filename="pasaporte.pdf"/);
    expect(file.body.equals(PDF_CONTENT)).toBe(true);

    const removed = await request(ctx.app).delete(`/documentos/${id}`).set("Authorization", `Bearer ${ana.token}`).send({ usuario_id: 1 });
    expect(removed.status).toBe(200);
    await flushCleanup();
    expect(fakeStorage.files.size).toBe(0);

    const afterDelete = await request(ctx.app).post("/documentos/listar").set("Authorization", `Bearer ${ana.token}`).send({ usuario_id: 1 });
    expect(afterDelete.body).toEqual([]);
  });

  test("la API expone una URL interna del archivo y nunca la clave de almacenamiento", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { documento } = created.body;

    expect(documento.archivo_url).toBe(`/documentos/${documento.id}/archivo`);
    expect(JSON.stringify(created.body)).not.toContain("storage_key");
    expect(JSON.stringify(created.body)).not.toContain("fake-storage.test");
  });

  test("POST /upload también guarda el documento y usa el nombre del archivo por defecto", async () => {
    const response = await request(ctx.app)
      .post("/upload")
      .set("Authorization", `Bearer ${ana.token}`)
      .field("usuario_id", "1")
      .attach("file", PDF_CONTENT, { filename: "visa-anterior.pdf", contentType: "application/pdf" });

    expect(response.status).toBe(200);
    expect(response.body.documento.nombre).toBe("visa-anterior.pdf");
    expect(response.body.documento.estado).toBe("review");
  });

  test("sin usuario_id en el body se asigna al usuario autenticado", async () => {
    const response = await request(ctx.app)
      .post("/documentos")
      .set("Authorization", `Bearer ${ana.token}`)
      .field("nombre", "foto.pdf")
      .attach("file", PDF_CONTENT, { filename: "foto.pdf", contentType: "application/pdf" });

    expect(response.status).toBe(201);
    expect(response.body.documento.usuario_id).toBe(1);
  });

  test("volver a subir el mismo documento_key reemplaza el registro, reinicia la revisión y borra el archivo anterior", async () => {
    const first = await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "pasaporte", nombre: "v1.pdf" });
    const firstFileKeys = [...fakeStorage.files.keys()];
    ctx.state.documentos[0].estado = "correction";
    ctx.state.documentos[0].feedback = "Foto borrosa";

    const second = await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "pasaporte", nombre: "v2.pdf" });
    await flushCleanup();

    expect(second.body.documento.id).toBe(first.body.documento.id);
    expect(second.body.documento).toMatchObject({ nombre: "v2.pdf", estado: "review", feedback: null });
    expect(ctx.state.documentos).toHaveLength(1);
    expect(fakeStorage.files.size).toBe(1);
    expect(fakeStorage.files.has(firstFileKeys[0])).toBe(false);
  });

  test("documentos con distinto documento_key conviven y se listan del más reciente al más antiguo", async () => {
    await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "pasaporte", nombre: "pasaporte.pdf" });
    await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "foto", nombre: "foto.pdf" });

    const listed = await request(ctx.app).get("/documentos/1").set("Authorization", `Bearer ${ana.token}`);

    expect(listed.body.map((doc) => doc.documento_key)).toEqual(["foto", "pasaporte"]);
  });

  test("el mismo documento_key de otro usuario no se pisa entre usuarios", async () => {
    await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "pasaporte" });
    await uploadPdf(ctx.app, luis.token, { usuarioId: 2, documentoKey: "pasaporte" });

    expect(ctx.state.documentos).toHaveLength(2);
    const anaDocs = await request(ctx.app).get("/documentos/1").set("Authorization", `Bearer ${ana.token}`);
    expect(anaDocs.body).toHaveLength(1);
    expect(anaDocs.body[0].usuario_id).toBe(1);
  });

  test("las imágenes se muestran en línea y los tipos no previsualizables se descargan como adjunto", async () => {
    const png = await request(ctx.app)
      .post("/documentos")
      .set("Authorization", `Bearer ${ana.token}`)
      .field("nombre", "foto.png")
      .field("usuario_id", "1")
      .attach("file", Buffer.from("png-bytes"), { filename: "foto.png", contentType: "image/png" });
    const generic = await uploadPdf(ctx.app, ana.token, { usuarioId: 1, nombre: "acta.pdf" });
    ctx.state.documentos.find((doc) => doc.id === generic.body.documento.id).tipo = "application/octet-stream";

    const pngFile = await request(ctx.app).get(`/documentos/${png.body.documento.id}/archivo`).set("Authorization", `Bearer ${ana.token}`);
    const genericFile = await request(ctx.app).get(`/documentos/${generic.body.documento.id}/archivo`).set("Authorization", `Bearer ${ana.token}`);

    expect(pngFile.headers["content-disposition"]).toMatch(/^inline/);
    expect(genericFile.headers["content-disposition"]).toMatch(/^attachment/);
  });

  test("registra la actividad de carga en la bitácora", async () => {
    await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "pasaporte" });

    expect(ctx.activityLogService.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: "document.uploaded",
      userId: 1,
      entityType: "documento",
    }));
  });
});

describe("integración: validaciones y permisos de documentos", () => {
  let ctx;
  let ana;
  let luis;
  let admin;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    fakeStorage.reset();
    ctx = createDocumentsIntegrationApp();
    ana = ctx.addUser({ id: 1, nombre: "Ana" });
    luis = ctx.addUser({ id: 2, nombre: "Luis" });
    admin = ctx.addUser({ id: 9, rol: "admin", nombre: "Admin" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("rechaza extensiones peligrosas, tipos MIME que no coinciden y campos desconocidos sin guardar nada", async () => {
    const executable = await request(ctx.app)
      .post("/documentos").set("Authorization", `Bearer ${ana.token}`)
      .field("nombre", "virus").field("usuario_id", "1")
      .attach("file", Buffer.from("MZ"), { filename: "virus.exe", contentType: "application/octet-stream" });
    const mismatch = await request(ctx.app)
      .post("/documentos").set("Authorization", `Bearer ${ana.token}`)
      .field("nombre", "falso").field("usuario_id", "1")
      .attach("file", Buffer.from("<html>"), { filename: "falso.pdf", contentType: "text/html" });
    const unknownField = await request(ctx.app)
      .post("/documentos").set("Authorization", `Bearer ${ana.token}`)
      .field("nombre", "otro").field("usuario_id", "1")
      .attach("archivo", PDF_CONTENT, { filename: "otro.pdf", contentType: "application/pdf" });

    expect(executable.status).toBe(400);
    expect(mismatch.status).toBe(400);
    expect(unknownField.status).toBe(400);
    expect(ctx.state.documentos).toHaveLength(0);
    expect(fakeStorage.files.size).toBe(0);
  });

  test("rechaza archivos que superan el límite de 5 MB con 413", async () => {
    const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1, "a");

    const response = await uploadPdf(ctx.app, ana.token, { usuarioId: 1, content: tooLarge });

    expect(response.status).toBe(413);
    expect(ctx.state.documentos).toHaveLength(0);
  });

  test("exige archivo, nombre y un usuario_id numérico", async () => {
    const withoutFile = await request(ctx.app).post("/documentos").set("Authorization", `Bearer ${ana.token}`).field("nombre", "x").field("usuario_id", "1");
    const withoutName = await request(ctx.app)
      .post("/documentos").set("Authorization", `Bearer ${ana.token}`).field("usuario_id", "1")
      .attach("file", PDF_CONTENT, { filename: "x.pdf", contentType: "application/pdf" });
    const badUserId = await uploadPdf(ctx.app, ana.token, { usuarioId: "abc" });

    expect(withoutFile.status).toBe(400);
    expect(withoutName.status).toBe(400);
    expect(badUserId.status).toBe(400);
    expect(ctx.state.documentos).toHaveLength(0);
  });

  test("todas las rutas exigen sesión válida", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    const responses = await Promise.all([
      request(ctx.app).get("/documentos/1"),
      request(ctx.app).post("/documentos/listar").send({ usuario_id: 1 }),
      request(ctx.app).get(`/documentos/${id}/archivo`),
      request(ctx.app).delete(`/documentos/${id}`).send({ usuario_id: 1 }),
      request(ctx.app).post("/documentos").field("nombre", "x").attach("file", PDF_CONTENT, { filename: "x.pdf", contentType: "application/pdf" }),
      request(ctx.app).get("/documentos/1").set("Authorization", "Bearer token.invalido"),
    ]);

    responses.forEach((response) => expect(response.status).toBe(401));
    expect(ctx.state.documentos).toHaveLength(1);
  });

  test("un cliente no puede listar, ver, subir ni eliminar documentos de otro usuario", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "pasaporte" });
    const { id } = created.body.documento;

    const list = await request(ctx.app).get("/documentos/1").set("Authorization", `Bearer ${luis.token}`);
    const listBody = await request(ctx.app).post("/documentos/listar").set("Authorization", `Bearer ${luis.token}`).send({ usuario_id: 1 });
    const file = await request(ctx.app).get(`/documentos/${id}/archivo`).set("Authorization", `Bearer ${luis.token}`);
    const uploadForOther = await uploadPdf(ctx.app, luis.token, { usuarioId: 1, documentoKey: "pasaporte", nombre: "intruso.pdf" });
    const remove = await request(ctx.app).delete(`/documentos/${id}`).set("Authorization", `Bearer ${luis.token}`).send({ usuario_id: 1 });

    expect(list.status).toBe(403);
    expect(listBody.status).toBe(403);
    expect(file.status).toBe(403);
    expect(uploadForOther.status).toBe(403);
    expect(remove.status).toBeGreaterThanOrEqual(400);
    expect(ctx.state.documentos).toHaveLength(1);
    expect(ctx.state.documentos[0].nombre).toBe("pasaporte.pdf");
    expect(fakeStorage.files.size).toBe(1);
  });

  test("un administrador puede consultar y ver los documentos de cualquier cliente", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    const list = await request(ctx.app).get("/documentos/1").set("Authorization", `Bearer ${admin.token}`);
    const file = await request(ctx.app).get(`/documentos/${id}/archivo`).set("Authorization", `Bearer ${admin.token}`);

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(file.status).toBe(200);
  });

  test("eliminar valida el id y responde 404 si el documento no existe", async () => {
    const invalidId = await request(ctx.app).delete("/documentos/abc").set("Authorization", `Bearer ${ana.token}`).send({ usuario_id: 1 });
    const missingUser = await request(ctx.app).delete("/documentos/1").set("Authorization", `Bearer ${ana.token}`).send({});
    const notFound = await request(ctx.app).delete("/documentos/999").set("Authorization", `Bearer ${ana.token}`).send({ usuario_id: 1 });

    expect(invalidId.status).toBe(400);
    expect(missingUser.status).toBe(400);
    expect(notFound.status).toBe(404);
  });

  test("ver el archivo de un documento inexistente o con id inválido responde 404 y 400", async () => {
    const missing = await request(ctx.app).get("/documentos/999/archivo").set("Authorization", `Bearer ${ana.token}`);
    const invalid = await request(ctx.app).get("/documentos/abc/archivo").set("Authorization", `Bearer ${ana.token}`);

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
  });

  test("si el almacenamiento perdió el archivo, la vista previa falla sin exponer detalles internos", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    fakeStorage.files.clear();

    const response = await request(ctx.app).get(`/documentos/${created.body.documento.id}/archivo`).set("Authorization", `Bearer ${ana.token}`);

    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain("fake/");
  });
});
