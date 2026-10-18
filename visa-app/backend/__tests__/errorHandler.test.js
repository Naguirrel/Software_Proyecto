const express = require("express");
const request = require("supertest");
const { notFoundHandler, errorHandler } = require("../middleware/errorHandler");

describe("notFoundHandler", () => {
  test("responde 404 en JSON para rutas no encontradas", async () => {
    const app = express();
    app.use(notFoundHandler);

    const response = await request(app).get("/ruta-que-no-existe");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Recurso no encontrado" });
  });
});

describe("errorHandler", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("usa el statusCode del error y expone su mensaje cuando es menor a 500", async () => {
    const app = express();
    app.get("/boom", async () => {
      const error = new Error("Datos inválidos");
      error.statusCode = 422;
      throw error;
    });
    app.use(errorHandler);

    const response = await request(app).get("/boom");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: "Datos inválidos" });
  });

  test("devuelve 500 genérico y oculta el mensaje interno cuando no hay statusCode", async () => {
    const app = express();
    app.get("/boom", async () => {
      throw new Error("detalle interno sensible");
    });
    app.use(errorHandler);

    const response = await request(app).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: "Ocurrió un error interno. Inténtalo nuevamente más tarde.",
      code: "INTERNAL_ERROR",
      requestId: expect.any(String),
    });
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
    expect(JSON.stringify(response.body)).not.toContain("detalle interno sensible");
  });

  test("captura errores sincrónicos lanzados dentro de una ruta", async () => {
    const app = express();
    app.get("/boom-sync", () => {
      throw new Error("fallo sincrónico");
    });
    app.use(errorHandler);

    const response = await request(app).get("/boom-sync");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: "Ocurrió un error interno. Inténtalo nuevamente más tarde.",
      code: "INTERNAL_ERROR",
      requestId: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain("fallo sincrónico");
  });

  test("preserva un estado 5xx explícito, pero nunca expone su detalle", async () => {
    const app = express();
    app.get("/dependency", async () => {
      const error = new Error("postgres://usuario:clave@servidor/produccion");
      error.statusCode = 503;
      error.code = "ECONNREFUSED";
      throw error;
    });
    app.use(errorHandler);

    const response = await request(app).get("/dependency");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: "INTERNAL_ERROR", requestId: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toContain("usuario:clave");
    const logEntry = JSON.parse(console.error.mock.calls.at(-1)[0]);
    expect(logEntry).toMatchObject({
      event: "request.failed",
      requestId: response.body.requestId,
      error: { code: "ECONNREFUSED" },
    });
    expect(logEntry.error.message).toContain("usuario:[REDACTED]");
    expect(JSON.stringify(logEntry)).not.toContain("usuario:clave");
  });

  test("normaliza códigos inválidos a 500", async () => {
    const app = express();
    app.get("/invalid-status", async () => {
      const error = new Error("detalle privado");
      error.statusCode = 700;
      throw error;
    });
    app.use(errorHandler);

    const response = await request(app).get("/invalid-status");

    expect(response.status).toBe(500);
    expect(response.body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("detalle privado");
  });

  test("delega al siguiente manejador sin intentar responder si los encabezados ya fueron enviados", () => {
    const res = { headersSent: true, status: jest.fn(), json: jest.fn() };
    const next = jest.fn();
    const error = new Error("boom tras enviar encabezados");

    errorHandler(error, {}, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
