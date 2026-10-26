const express = require("express");
const fs = require("fs");
const path = require("path");
const request = require("supertest");
const SwaggerParser = require("@apidevtools/swagger-parser");
const { createApiDocsRouter } = require("../swagger");

function listMountedRoutes() {
  const backendRoot = path.resolve(__dirname, "..");
  const appSource = fs.readFileSync(path.join(backendRoot, "app.js"), "utf8");
  const factoryFiles = new Map();
  const requirePattern = /const\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(["']\.\/routes\/([^"']+)["']\)/g;

  for (const match of appSource.matchAll(requirePattern)) {
    const names = match[1] ? match[1].split(",").map((name) => name.trim()) : [match[2]];
    for (const name of names) factoryFiles.set(name, match[3]);
  }

  const routes = [];
  const mountPattern = /app\.use\(\s*["']([^"']+)["']\s*,\s*(create\w+Routes)\s*\(/g;
  for (const [, prefix, factoryName] of appSource.matchAll(mountPattern)) {
    const routeFile = factoryFiles.get(factoryName);
    if (!routeFile) throw new Error(`No se encontró el archivo de ${factoryName}`);
    const routeSource = fs.readFileSync(path.join(backendRoot, "routes", `${routeFile}.js`), "utf8");
    const routePattern = /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
    for (const [, method, localPath] of routeSource.matchAll(routePattern)) {
      const joined = `${prefix === "/" ? "" : prefix}${localPath === "/" ? "" : localPath}` || "/";
      routes.push({
        method,
        path: joined.replace(/:([A-Za-z0-9_]+)/g, "{$1}"),
        source: `routes/${routeFile}.js`,
      });
    }
  }
  return routes;
}

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

  test("el contrato OpenAPI es estructuralmente válido", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);

    await expect(SwaggerParser.validate(contract)).resolves.toBeDefined();
  });

  test("documenta todas las rutas HTTP montadas en Express", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);
    const missing = listMountedRoutes().filter(({ method, path: routePath }) => !contract.paths[routePath]?.[method]);

    expect(missing).toEqual([]);
  });

  test("sirve Swagger UI", async () => {
    const response = await request(app).get("/api-docs/").expect(200);

    expect(response.text).toContain("VisaGuide API");
  });

  test("documenta las rutas nuevas de flujo y desbloqueo con contratos específicos", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);
    const workflow = contract.paths["/workflow/me"].get;
    const unlockByToken = contract.paths["/desbloquear-cuenta"].post;
    const unlockByAdmin = contract.paths["/admin/users/{id}/unlock"].post;

    expect(workflow.security).toEqual([{ bearerAuth: [] }]);
    expect(workflow.responses[200].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/ClientWorkflowResponse",
    });
    expect(workflow.responses[404]).toEqual({ $ref: "#/components/responses/NotFound" });
    expect(contract.components.schemas.ClientWorkflowResponse.properties.gates.required).toContain("interview");

    expect(unlockByToken.requestBody.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/UnlockTokenRequest",
    });
    expect(contract.components.schemas.UnlockTokenRequest.properties.token).toMatchObject({
      minLength: 64,
      maxLength: 64,
      pattern: "^[a-f0-9]{64}$",
    });
    expect(unlockByToken.responses[200].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/SuccessMessage",
    });

    expect(unlockByAdmin.security).toEqual([{ bearerAuth: [] }]);
    expect(unlockByAdmin.parameters[0]).toMatchObject({ name: "id", in: "path", required: true });
    expect(unlockByAdmin.responses[200].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AdminUserResponse",
    });
    expect(unlockByAdmin.responses[404]).toEqual({ $ref: "#/components/responses/NotFound" });

    expect(contract.paths["/login"].post.responses[423].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AccountLockedError",
    });
  });

  test("marca como obsoletas las rutas legacy que responden 405", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);
    const legacyOperations = [
      contract.paths["/estado-tramite"].get,
      contract.paths["/usuario-perfil"].get,
      contract.paths["/ds160"].get,
      contract.paths["/ds160/pdf"].get,
      contract.paths["/notificaciones/{userId}/leer-todas"].put,
    ];

    for (const operation of legacyOperations) {
      expect(operation.deprecated).toBe(true);
      expect(operation.responses[405]).toBeDefined();
      expect(operation.responses[200]).toBeUndefined();
    }
  });

  test("documenta cada ruta del asesor con seguridad y respuestas tipadas", async () => {
    const { body: contract } = await request(app).get("/api-docs.json").expect(200);
    const advisorOperations = Object.entries(contract.paths)
      .filter(([path]) => path.startsWith("/advisor/"))
      .flatMap(([path, operations]) => Object.entries(operations).map(([method, operation]) => ({ path, method, operation })));

    expect(advisorOperations).toHaveLength(32);
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
    const documentReminder = contract.paths["/advisor/documents/reminders"].post;
    expect(documentReminder.security).toEqual([{ bearerAuth: [] }]);
    expect(documentReminder.requestBody.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AdvisorDocumentReminderRequest",
    });
    expect(documentReminder.responses[201].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/SuccessMessage",
    });
    expect(documentReminder.responses[404]).toEqual({ $ref: "#/components/responses/NotFound" });
    expect(documentReminder.responses[409]).toBeDefined();
    expect(contract.paths["/advisor/tasks"].post.responses[201].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AdvisorTaskResponse",
    });
    expect(contract.paths["/advisor/questions/{id}/status"].patch.requestBody.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/AdvisorQuestionStatusRequest",
    });
    expect(contract.components.schemas.AdvisorProfile.required).toEqual(expect.arrayContaining(["id_usuario", "nombre", "correo", "rol"]));
  });
});
