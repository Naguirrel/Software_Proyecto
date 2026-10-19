const express = require("express");
const request = require("supertest");
const { createApiDocsRouter } = require("../swagger");

describe("documentación de la API", () => {
  const app = express();
  app.use(createApiDocsRouter());

  test("expone el contrato OpenAPI", async () => {
    const response = await request(app).get("/api-docs.json").expect(200);

    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.paths["/login"].post).toBeDefined();
    expect(response.body.paths["/validar-sesion"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(response.body.paths["/login"].post.responses[429]).toEqual({
      $ref: "#/components/responses/TooManyRequests",
    });
    expect(response.body.components.schemas.Error.properties.requestId).toMatchObject({
      type: "string",
      maxLength: 100,
      pattern: "^[A-Za-z0-9._:-]+$",
    });
  });

  test("sirve Swagger UI", async () => {
    const response = await request(app).get("/api-docs/").expect(200);

    expect(response.text).toContain("VisaGuide API");
  });

  test("documenta cada ruta del asesor con seguridad y respuestas tipadas", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);
    const advisorOperations = Object.entries(contract.paths)
      .filter(([path]) => path.startsWith("/advisor/"))
      .flatMap(([path, operations]) => Object.entries(operations).map(([method, operation]) => ({ path, method, operation })));

    expect(advisorOperations).toHaveLength(31);
    for (const { path, method, operation } of advisorOperations) {
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      expect(operation.description).toContain("Requiere rol asesor");
      const successResponse = Object.entries(operation.responses).find(([status]) => status.startsWith("2"));
      expect(successResponse).toBeDefined();
      if (path === "/advisor/notifications/stream") {
        expect(successResponse[1].content["text/event-stream"].schema).toEqual({ type: "string" });
      } else {
        expect(successResponse[1].content["application/json"].schema.$ref).toMatch(
          /^#\/components\/schemas\/(?:Advisor.+|SuccessMessage)$/
        );
      }
      expect(operation.responses[401]).toEqual({ $ref: "#/components/responses/Unauthorized" });
      expect(operation.responses[403]).toEqual({ $ref: "#/components/responses/Forbidden" });
      expect(operation.operationId).toBe(`${method}_${path}`.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, ""));
    }
  });

  test("documenta filtros, SSE y preferencias de las notificaciones del asesor", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);
    const notificationPath = contract.paths["/advisor/notifications"].get;
    const parameters = Object.fromEntries(notificationPath.parameters.map((parameter) => [parameter.name, parameter]));

    expect(parameters.status.schema.enum).toContain("unread");
    expect(parameters.type.schema.enum).toContain("chat");
    expect(parameters.limit.schema).toMatchObject({ minimum: 1, maximum: 100, default: 50 });
    expect(contract.paths["/advisor/notifications/stream"].get.responses[200].content["text/event-stream"]).toBeDefined();
    expect(contract.paths["/advisor/notifications/preferences/current"].put.requestBody.content["application/json"].example).toEqual({
      soundEnabled: true,
      mutedTypes: ["info"],
    });
  });

  test("describe paginación, parámetros, ejemplos y errores de alcance del chat del asesor", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);
    const messagesPath = contract.paths["/advisor/conversations/{userId}/messages"];
    const parameters = Object.fromEntries(messagesPath.get.parameters.map((parameter) => [parameter.name, parameter]));

    expect(parameters.userId).toMatchObject({ in: "path", required: true, example: 42 });
    expect(parameters.afterId.schema).toMatchObject({ type: "integer", minimum: 1 });
    expect(parameters.beforeId.schema).toMatchObject({ type: "integer", minimum: 1 });
    expect(parameters.limit.schema).toMatchObject({ minimum: 1, maximum: 100, default: 50 });
    expect(messagesPath.get.responses[404]).toEqual({ $ref: "#/components/responses/NotFound" });
    expect(messagesPath.post.requestBody.content["application/json"].example).toEqual({
      message: "Revisé tu formulario. Te dejé dos observaciones.",
    });
  });

  test("publica contratos y ejemplos específicos para las operaciones de escritura", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);

    expect(contract.paths["/advisor/processes/{id}"].put.requestBody.content["application/json"].example).toEqual({
      estado: "En proceso",
      etapaActual: "Formulario DS-160",
    });
    expect(contract.paths["/advisor/documents/{id}"].put.responses[200].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AdvisorDocumentResponse",
    });
    expect(contract.paths["/advisor/tasks"].post.responses[201].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AdvisorTaskResponse",
    });
    expect(contract.paths["/advisor/questions/{id}/status"].patch.requestBody.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AdvisorQuestionStatusRequest",
    });
    expect(contract.components.schemas.AdvisorProfile.required).toEqual(expect.arrayContaining(["id_usuario", "nombre", "correo", "rol"]));
  });
});
