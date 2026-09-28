const request = require("supertest");
const fakeStorage = require("../test-utils/fakeStorage");
const { createDocumentsIntegrationApp, PDF_CONTENT } = require("../test-utils/documentsIntegrationHarness");

jest.mock("../storage", () => require("../test-utils/fakeStorage"));

function uploadPdf(app, token, { usuarioId, documentoKey = "pasaporte", nombre = "pasaporte.pdf" } = {}) {
  return request(app)
    .post("/documentos")
    .set("Authorization", `Bearer ${token}`)
    .field("nombre", nombre)
    .field("usuario_id", String(usuarioId))
    .field("documento_key", documentoKey)
    .attach("file", PDF_CONTENT, { filename: nombre, contentType: "application/pdf" });
}

describe("integración: revisión de documentos por el administrador", () => {
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
    ana = ctx.addUser({ id: 1, nombre: "Ana Pérez", correo: "ana@example.com" });
    luis = ctx.addUser({ id: 2, nombre: "Luis Gómez", correo: "luis@example.com" });
    admin = ctx.addUser({ id: 9, rol: "admin", nombre: "Admin" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("el cliente sube → el admin lo ve con su solicitante → aprueba → el cliente ve el nuevo estado", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    const adminList = await request(ctx.app).get("/admin/documents").set("Authorization", `Bearer ${admin.token}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.documentos).toHaveLength(1);
    expect(adminList.body.documentos[0]).toMatchObject({
      id,
      estado: "review",
      usuario: { id: 1, nombre: "Ana Pérez", correo: "ana@example.com" },
      archivo_url: `/documentos/${id}/archivo`,
    });
    expect(adminList.body.documentos[0].storage_key).toBeUndefined();

    const approved = await request(ctx.app).put(`/admin/documents/${id}/status`).set("Authorization", `Bearer ${admin.token}`).send({ status: "approved" });
    expect(approved.status).toBe(200);
    expect(approved.body.documento.estado).toBe("approved");

    const clientView = await request(ctx.app).get("/documentos/1").set("Authorization", `Bearer ${ana.token}`);
    expect(clientView.body[0].estado).toBe("approved");
  });

  test("aprobar notifica al cliente y queda registrado en la bitácora", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    await request(ctx.app).put(`/admin/documents/${id}/status`).set("Authorization", `Bearer ${admin.token}`).send({ estado: "approved" });

    expect(ctx.notificaciones).toHaveLength(1);
    expect(ctx.notificaciones[0]).toMatchObject({ userId: 1, titulo: "Documento aprobado", tipo: "documento", etapaRelacionada: "pasaporte" });
    expect(ctx.activityLogService.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: "document.status_updated",
      adminId: 9,
      userId: 1,
      entityId: id,
    }));
  });

  test("corrección con observaciones → el cliente las ve → vuelve a subir → regresa a revisión sin observaciones", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    const correction = await request(ctx.app)
      .put(`/admin/documents/${id}/status`).set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "correction", feedback: "  La foto está borrosa  " });
    expect(correction.status).toBe(200);
    expect(ctx.notificaciones[0].titulo).toBe("Documento requiere correcciones");
    expect(ctx.notificaciones[0].mensaje).toContain("observaciones");

    const seenByClient = await request(ctx.app).get("/documentos/1").set("Authorization", `Bearer ${ana.token}`);
    expect(seenByClient.body[0]).toMatchObject({ estado: "correction", feedback: "La foto está borrosa" });

    const reuploaded = await uploadPdf(ctx.app, ana.token, { usuarioId: 1, nombre: "pasaporte-nuevo.pdf" });
    expect(reuploaded.body.documento).toMatchObject({ id, estado: "review", feedback: null, nombre: "pasaporte-nuevo.pdf" });
  });

  test("el estado legacy 'rejected' se normaliza a 'correction'", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    const response = await request(ctx.app).put(`/admin/documents/${id}/status`).set("Authorization", `Bearer ${admin.token}`).send({ status: "rejected" });

    expect(response.status).toBe(200);
    expect(response.body.documento.estado).toBe("correction");
  });

  test("agregar solo observaciones no cambia el estado, notifica y registra feedback_updated", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    const response = await request(ctx.app).put(`/admin/documents/${id}/status`).set("Authorization", `Bearer ${admin.token}`).send({ feedback: "Falta la firma" });

    expect(response.status).toBe(200);
    expect(response.body.documento).toMatchObject({ estado: "review", feedback: "Falta la firma" });
    expect(ctx.notificaciones[0].titulo).toBe("Nuevas observaciones en documento");
    expect(ctx.activityLogService.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "document.feedback_updated" }));
  });

  test("valida la petición: estado inválido, cuerpo vacío, id no numérico y documento inexistente", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;
    const put = (path, body) => request(ctx.app).put(path).set("Authorization", `Bearer ${admin.token}`).send(body);

    const invalidStatus = await put(`/admin/documents/${id}/status`, { status: "aprobado-ya" });
    const emptyBody = await put(`/admin/documents/${id}/status`, {});
    const invalidId = await put("/admin/documents/abc/status", { status: "approved" });
    const notFound = await put("/admin/documents/999/status", { status: "approved" });

    expect(invalidStatus.status).toBe(400);
    expect(emptyBody.status).toBe(400);
    expect(invalidId.status).toBe(400);
    expect(notFound.status).toBe(404);
    expect(ctx.state.documentos[0].estado).toBe("review");
    expect(ctx.notificaciones).toHaveLength(0);
  });

  test("un cliente no puede listar ni cambiar el estado de documentos de administración", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    const list = await request(ctx.app).get("/admin/documents").set("Authorization", `Bearer ${ana.token}`);
    const approve = await request(ctx.app).put(`/admin/documents/${id}/status`).set("Authorization", `Bearer ${ana.token}`).send({ status: "approved" });

    expect(list.status).toBe(403);
    expect(approve.status).toBe(403);
    expect(ctx.state.documentos[0].estado).toBe("review");
  });

  test("sin sesión o con token inválido las rutas de administración responden 401", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    const { id } = created.body.documento;

    const list = await request(ctx.app).get("/admin/documents");
    const approve = await request(ctx.app).put(`/admin/documents/${id}/status`).set("Authorization", "Bearer falso.token").send({ status: "approved" });

    expect(list.status).toBe(401);
    expect(approve.status).toBe(401);
  });

  test("el administrador ve los documentos de varios clientes, primero el más reciente", async () => {
    await uploadPdf(ctx.app, ana.token, { usuarioId: 1, documentoKey: "pasaporte" });
    await uploadPdf(ctx.app, luis.token, { usuarioId: 2, documentoKey: "foto", nombre: "foto.pdf" });

    const list = await request(ctx.app).get("/admin/documents").set("Authorization", `Bearer ${admin.token}`);

    expect(list.body.documentos.map((doc) => doc.usuario.nombre)).toEqual(["Luis Gómez", "Ana Pérez"]);
  });

  test("un fallo al notificar no impide que la revisión se guarde", async () => {
    const created = await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    ctx.notificacionService.crearNotificacion.mockRejectedValueOnce(new Error("notificaciones caídas"));

    const response = await request(ctx.app).put(`/admin/documents/${created.body.documento.id}/status`).set("Authorization", `Bearer ${admin.token}`).send({ status: "approved" });

    expect(response.status).toBe(200);
    expect(ctx.state.documentos[0].estado).toBe("approved");
  });

  test("un cliente eliminado o desactivado pierde el acceso a sus documentos", async () => {
    await uploadPdf(ctx.app, ana.token, { usuarioId: 1 });
    ctx.state.users.find((user) => user.id_usuario === 1).activo = false;

    const response = await request(ctx.app).get("/documentos/1").set("Authorization", `Bearer ${ana.token}`);

    expect(response.status).toBe(401);
  });
});
