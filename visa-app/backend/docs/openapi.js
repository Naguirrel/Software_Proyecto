const objectSchema = { type: "object", additionalProperties: true };

const schemas = {
  Error: {
    type: "object",
    required: ["error"],
    properties: { error: { type: "string" } },
  },
  RegisterRequest: {
    type: "object",
    required: ["nombre", "correo", "contrasena"],
    properties: {
      nombre: { type: "string" },
      correo: { type: "string", format: "email" },
      contrasena: { type: "string", format: "password", minLength: 6 },
    },
  },
  LoginRequest: {
    type: "object",
    required: ["correo", "contrasena"],
    properties: {
      correo: { type: "string", format: "email" },
      contrasena: { type: "string", format: "password" },
    },
  },
  EmailRequest: {
    type: "object",
    required: ["correo"],
    properties: { correo: { type: "string", format: "email" } },
  },
  TokenRequest: {
    type: "object",
    required: ["token"],
    properties: { token: { type: "string" } },
  },
  ResetPasswordRequest: {
    type: "object",
    required: ["token", "nuevaContrasena"],
    properties: {
      token: { type: "string" },
      nuevaContrasena: { type: "string", format: "password", minLength: 6 },
    },
  },
  UserEmailRequest: {
    type: "object",
    required: ["correo"],
    properties: { correo: { type: "string", format: "email" } },
  },
  ProfileRequest: {
    type: "object",
    required: ["correo", "perfil"],
    properties: { correo: { type: "string", format: "email" }, perfil: objectSchema },
  },
  ProfileUpdateRequest: {
    type: "object",
    required: ["correo"],
    properties: {
      correo: { type: "string", format: "email" },
      nombre: { type: "string" },
      telefono: { type: "string" },
      ciudad: { type: "string" },
      pais: { type: "string" },
      notificacionesEmail: { type: "boolean" },
      idioma: { type: "string" },
    },
  },
  ProcessUpdateRequest: {
    type: "object",
    properties: {
      id_tramite: { type: "integer" },
      estado: { type: "string" },
      etapa_actual: { type: "string" },
      progreso: { type: "integer", minimum: 0, maximum: 100 },
      siguiente_paso: { type: "string" },
      mensaje: { type: "string" },
    },
  },
  Ds160Request: {
    type: "object",
    required: ["correo"],
    properties: {
      correo: { type: "string", format: "email" },
      datos: objectSchema,
      seccion_actual: { type: "string" },
      completado: { type: "boolean" },
    },
  },
  UserIdRequest: {
    type: "object",
    required: ["userId"],
    properties: { userId: { type: "integer" } },
  },
  SessionIdRequest: {
    type: "object",
    required: ["sessionId"],
    properties: { sessionId: { type: "integer" } },
  },
  NotificationRequest: {
    type: "object",
    required: ["userId", "titulo", "mensaje"],
    properties: {
      userId: { type: "integer" },
      titulo: { type: "string" },
      mensaje: { type: "string" },
      tipo: { type: "string" },
      etapaRelacionada: { type: "string" },
    },
  },
  DocumentStatusRequest: {
    type: "object",
    properties: { estado: { type: "string" }, status: { type: "string" }, feedback: { type: "string" } },
    anyOf: [{ required: ["estado"] }, { required: ["status"] }],
  },
  AdminProcessRequest: {
    type: "object",
    properties: {
      estado: { type: "string" },
      etapaActual: { type: "string" },
      asesorId: { type: "integer", nullable: true },
    },
  },
  AdminUserRequest: {
    type: "object",
    required: ["nombre", "correo", "contrasena", "rol"],
    properties: {
      nombre: { type: "string" },
      correo: { type: "string", format: "email" },
      contrasena: { type: "string", format: "password" },
      rol: { type: "string", enum: ["cliente", "asesor", "admin"] },
    },
  },
  AssignmentRequest: {
    type: "object",
    required: ["tramiteId", "asesorId"],
    properties: { tramiteId: { type: "integer" }, asesorId: { type: "integer" } },
  },
  AdvisorProcessRequest: {
    type: "object",
    required: ["estado", "etapaActual"],
    properties: {
      estado: { type: "string", enum: ["En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"] },
      etapaActual: { type: "string" },
    },
  },
  AdvisorDocumentRequest: {
    type: "object",
    required: ["status"],
    properties: { status: { type: "string", enum: ["approved", "correction"] }, feedback: { type: "string" } },
  },
  AdvisorDs160Request: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["en_progreso", "por_revisar", "correccion", "aprobado"] },
      feedback: { type: "string" },
    },
  },
  InterviewFeedbackRequest: {
    type: "object",
    required: ["feedback"],
    properties: { feedback: { type: "string" }, rating: { type: "integer", minimum: 1, maximum: 5, nullable: true } },
  },
  ChatMessageRequest: {
    type: "object",
    required: ["message"],
    properties: { message: { type: "string", maxLength: 4000 } },
  },
  AdvisorTaskRequest: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", maxLength: 240 },
      dueAt: { type: "string", format: "date-time", nullable: true },
      priority: { type: "string", enum: ["normal", "high"] },
      status: { type: "string", enum: ["pending", "completed"] },
      userId: { type: "integer", nullable: true },
    },
  },
  AdvisorTaskUpdateRequest: {
    type: "object",
    properties: {
      title: { type: "string", maxLength: 240 },
      dueAt: { type: "string", format: "date-time", nullable: true },
      priority: { type: "string", enum: ["normal", "high"] },
      status: { type: "string", enum: ["pending", "completed"] },
    },
  },
  AdvisorQuestionRequest: {
    type: "object",
    required: ["question", "category", "difficulty"],
    properties: {
      question: { type: "string" }, category: { type: "string" }, difficulty: { type: "string", enum: ["Fácil", "Media", "Alta"] }, is_required: { type: "boolean" },
    },
  },
  AdvisorProfileRequest: {
    type: "object",
    required: ["nombre"],
    properties: { nombre: { type: "string" }, telefono: { type: "string" }, ciudad: { type: "string" }, pais: { type: "string" } },
  },
  GenericRequest: objectSchema,
};

schemas.DocumentUpload = {
  type: "object",
  required: ["file", "usuario_id"],
  properties: {
    file: { type: "string", format: "binary" },
    usuario_id: { type: "integer" },
    nombre: { type: "string" },
    tipo: { type: "string" },
    documento_key: { type: "string" },
  },
};
schemas.InterviewSessionUpload = {
  type: "object",
  required: ["session"],
  properties: {
    session: { type: "string", description: "Sesión serializada en JSON" },
    audio: { type: "array", items: { type: "string", format: "binary" } },
  },
};
schemas.BankTransferUpload = {
  type: "object",
  required: ["file"],
  properties: { file: { type: "string", format: "binary" }, referencia: { type: "string" } },
};
schemas.GenericUpload = {
  type: "object",
  properties: { file: { type: "string", format: "binary" } },
};

const endpoints = [
  ["get", "/", "Sistema", "Comprobar estado de la API"],
  ["post", "/register", "Autenticación", "Registrar usuario", null, "RegisterRequest", 201],
  ["post", "/login", "Autenticación", "Iniciar sesión", null, "LoginRequest"],
  ["get", "/validar-sesion", "Autenticación", "Validar sesión", "session"],
  ["post", "/forgot-password", "Autenticación", "Solicitar recuperación de contraseña", null, "EmailRequest"],
  ["post", "/reset-password", "Autenticación", "Restablecer contraseña", null, "ResetPasswordRequest"],
  ["post", "/verificar-email", "Autenticación", "Verificar correo", null, "TokenRequest"],
  ["post", "/reenviar-verificacion", "Autenticación", "Reenviar verificación", null, "EmailRequest"],
  ["post", "/guardar-perfil", "Perfil y trámite", "Guardar perfil de visa", null, "ProfileRequest"],
  ["post", "/estado-tramite", "Perfil y trámite", "Consultar estado del trámite", null, "UserEmailRequest"],
  ["post", "/usuario-perfil", "Perfil y trámite", "Consultar perfil del usuario", null, "UserEmailRequest"],
  ["put", "/usuario-perfil", "Perfil y trámite", "Actualizar perfil del usuario", null, "ProfileUpdateRequest"],
  ["put", "/tramite", "Perfil y trámite", "Actualizar trámite", null, "ProcessUpdateRequest"],
  ["post", "/ds160/load", "DS-160", "Cargar formulario DS-160", null, "UserEmailRequest"],
  ["post", "/ds160", "DS-160", "Guardar formulario DS-160", null, "Ds160Request"],
  ["post", "/ds160/pdf", "DS-160", "Exportar DS-160 en PDF", null, "UserEmailRequest", 200, "binary"],
  ["post", "/upload", "Documentos", "Subir documento", "session", "DocumentUpload", 201, null, "multipart/form-data"],
  ["post", "/documentos", "Documentos", "Crear documento", "session", "DocumentUpload", 201, null, "multipart/form-data"],
  ["post", "/documentos/listar", "Documentos", "Listar documentos", "session", "UserIdRequest"],
  ["get", "/documentos/{id}/archivo", "Documentos", "Descargar archivo", "session", null, 200, "binary"],
  ["get", "/documentos/{usuarioId}", "Documentos", "Listar documentos del usuario", "session"],
  ["delete", "/documentos", "Documentos", "Eliminar documento", "session", "GenericRequest"],
  ["delete", "/documentos/{id}", "Documentos", "Eliminar documento", "session"],
  ["get", "/questions", "Preguntas", "Listar preguntas activas"],
  ["get", "/questions/random", "Preguntas", "Seleccionar preguntas activas aleatorias"],
  ["get", "/questions/admin", "Preguntas", "Listar banco de preguntas", "admin"],
  ["post", "/questions", "Preguntas", "Crear pregunta", "admin", "GenericRequest", 201],
  ["put", "/questions/{id}", "Preguntas", "Actualizar pregunta", "admin", "GenericRequest"],
  ["patch", "/questions/{id}/status", "Preguntas", "Cambiar estado de pregunta", "admin", "GenericRequest"],
  ["delete", "/questions/{id}", "Preguntas", "Eliminar pregunta", "admin"],
  ["get", "/interview-sessions", "Entrevistas", "Listar sesiones", "admin"],
  ["post", "/interview-sessions", "Entrevistas", "Crear sesión", null, "InterviewSessionUpload", 201, null, "multipart/form-data"],
  ["post", "/interview-sessions/user", "Entrevistas", "Listar sesiones del usuario", null, "UserIdRequest"],
  ["post", "/interview-sessions/detail", "Entrevistas", "Consultar sesión", null, "SessionIdRequest"],
  ["get", "/interview-sessions/user/{userId}", "Entrevistas", "Listar sesiones del usuario"],
  ["get", "/interview-sessions/{id}/audio/{questionId}", "Entrevistas", "Reproducir audio", null, null, 200, "binary"],
  ["get", "/interview-sessions/{id}", "Entrevistas", "Consultar sesión"],
  ["put", "/interview-sessions/{id}/feedback", "Entrevistas", "Guardar retroalimentación", "admin", "GenericRequest"],
  ["post", "/notificaciones", "Notificaciones", "Crear notificación", "admin", "NotificationRequest", 201],
  ["post", "/notificaciones/no-leidas", "Notificaciones", "Contar no leídas", "session", "UserIdRequest"],
  ["post", "/notificaciones/listar", "Notificaciones", "Listar notificaciones", "session", "UserIdRequest"],
  ["put", "/notificaciones/leer-todas", "Notificaciones", "Marcar todas como leídas", "session", "UserIdRequest"],
  ["get", "/notificaciones/{userId}/no-leidas", "Notificaciones", "Contar no leídas", "session"],
  ["get", "/notificaciones/{userId}", "Notificaciones", "Listar notificaciones", "session"],
  ["put", "/notificaciones/{id}/leer", "Notificaciones", "Marcar como leída", "session"],
  ["delete", "/notificaciones/{id}", "Notificaciones", "Eliminar notificación", "session"],
  ["get", "/payments/me", "Gestión consular", "Consultar pagos propios", "session"],
  ["post", "/payments/bank-transfer", "Gestión consular", "Registrar transferencia", "session", "BankTransferUpload", 201, null, "multipart/form-data"],
  ["get", "/appointments/me", "Gestión consular", "Consultar citas propias", "session"],
  ["get", "/staff/consular-cases", "Gestión consular", "Listar casos consulares", "staff"],
  ["post", "/staff/consular-payments/{id}/start", "Gestión consular", "Iniciar pago consular", "staff"],
  ["post", "/staff/consular-payments/{id}/review-transfer", "Gestión consular", "Revisar transferencia", "staff", "GenericRequest"],
  ["post", "/staff/consular-payments/{id}/receipt", "Gestión consular", "Subir comprobante", "staff", "GenericUpload", 200, null, "multipart/form-data"],
  ["put", "/staff/consular-cases/{userId}/appointment", "Gestión consular", "Registrar cita", "staff", "GenericRequest"],
  ["post", "/staff/consular-cases/{userId}/appointments/{id}/cancel", "Gestión consular", "Cancelar cita", "staff", "GenericRequest"],
  ["get", "/admin/documents", "Administración", "Listar documentos", "admin"],
  ["put", "/admin/documents/{id}/status", "Administración", "Revisar documento", "admin", "DocumentStatusRequest"],
  ["get", "/admin/processes", "Administración", "Listar trámites", "admin"],
  ["get", "/admin/processes/{id}/history", "Administración", "Consultar historial del trámite", "admin"],
  ["get", "/admin/processes/{id}", "Administración", "Consultar trámite", "admin"],
  ["put", "/admin/processes/{id}", "Administración", "Actualizar trámite", "admin", "AdminProcessRequest"],
  ["get", "/admin/metrics/overview", "Administración", "Consultar resumen de métricas", "admin"],
  ["get", "/admin/metrics/processes", "Administración", "Consultar métricas de trámites", "admin"],
  ["get", "/admin/metrics/processes.csv", "Administración", "Exportar métricas en CSV", "admin", null, 200, "binary"],
  ["get", "/admin/metrics/processes.xlsx", "Administración", "Exportar métricas en Excel", "admin", null, 200, "binary"],
  ["get", "/admin/activity-logs", "Administración", "Listar actividad", "admin"],
  ["post", "/admin/email-reminders/run", "Administración", "Ejecutar recordatorios", "admin"],
  ["get", "/admin/dashboard", "Administración", "Consultar panel", "admin"],
  ["get", "/admin/users", "Administración", "Listar usuarios", "admin"],
  ["get", "/admin/users/{id}", "Administración", "Consultar usuario", "admin"],
  ["post", "/admin/users", "Administración", "Crear usuario", "admin", "AdminUserRequest", 201],
  ["patch", "/admin/users/{id}", "Administración", "Actualizar usuario", "admin", "GenericRequest"],
  ["get", "/admin/advisors", "Administración", "Listar asesores", "admin"],
  ["post", "/admin/advisors", "Administración", "Crear asesor", "admin", "AdminUserRequest", 201],
  ["get", "/admin/assignments", "Administración", "Listar asignaciones", "admin"],
  ["post", "/admin/assignments", "Administración", "Asignar asesor", "admin", "AssignmentRequest"],
  ["get", "/admin/ds160", "Administración", "Listar formularios DS-160", "admin"],
  ["put", "/admin/ds160/{id}", "Administración", "Revisar formulario DS-160", "admin", "GenericRequest"],
  ["get", "/admin/profile", "Administración", "Consultar perfil", "admin"],
  ["put", "/admin/profile", "Administración", "Actualizar perfil", "admin", "GenericRequest"],
  ["get", "/admin/settings", "Administración", "Consultar configuración", "admin"],
  ["put", "/admin/settings", "Administración", "Actualizar configuración", "admin", "GenericRequest"],
  ["get", "/chat", "Chat", "Consultar conversación con el asesor", "session"],
  ["post", "/chat/messages", "Chat", "Enviar mensaje al asesor", "session", "ChatMessageRequest", 201],
  ["get", "/advisor/dashboard", "Asesor", "Consultar panel del asesor", "advisor"],
  ["get", "/advisor/processes", "Asesor", "Listar solicitudes asignadas", "advisor"],
  ["get", "/advisor/processes/{id}", "Asesor", "Consultar solicitud asignada", "advisor"],
  ["put", "/advisor/processes/{id}", "Asesor", "Actualizar solicitud asignada", "advisor", "AdvisorProcessRequest"],
  ["get", "/advisor/documents", "Asesor", "Listar documentos asignados", "advisor"],
  ["put", "/advisor/documents/{id}", "Asesor", "Revisar documento asignado", "advisor", "AdvisorDocumentRequest"],
  ["get", "/advisor/ds160", "Asesor", "Listar formularios DS-160 asignados", "advisor"],
  ["put", "/advisor/ds160/{id}", "Asesor", "Revisar formulario DS-160", "advisor", "AdvisorDs160Request"],
  ["get", "/advisor/interviews", "Asesor", "Listar entrevistas asignadas", "advisor"],
  ["put", "/advisor/interviews/{id}/feedback", "Asesor", "Guardar retroalimentación de entrevista", "advisor", "InterviewFeedbackRequest"],
  ["get", "/advisor/conversations", "Asesor", "Listar conversaciones", "advisor"],
  ["get", "/advisor/conversations/{userId}/messages", "Asesor", "Listar mensajes con un solicitante", "advisor"],
  ["post", "/advisor/conversations/{userId}/messages", "Asesor", "Enviar mensaje a un solicitante", "advisor", "ChatMessageRequest", 201],
  ["get", "/advisor/tasks", "Asesor", "Listar tareas", "advisor"],
  ["post", "/advisor/tasks", "Asesor", "Crear tarea", "advisor", "AdvisorTaskRequest", 201],
  ["put", "/advisor/tasks/{id}", "Asesor", "Actualizar tarea", "advisor", "AdvisorTaskUpdateRequest"],
  ["delete", "/advisor/tasks/{id}", "Asesor", "Eliminar tarea", "advisor"],
  ["get", "/advisor/questions", "Asesor", "Listar banco de preguntas", "advisor"],
  ["post", "/advisor/questions", "Asesor", "Crear pregunta", "advisor", "AdvisorQuestionRequest", 201],
  ["put", "/advisor/questions/{id}", "Asesor", "Actualizar pregunta", "advisor", "AdvisorQuestionRequest"],
  ["patch", "/advisor/questions/{id}/status", "Asesor", "Activar o desactivar pregunta", "advisor", "GenericRequest"],
  ["get", "/advisor/profile", "Asesor", "Consultar perfil", "advisor"],
  ["put", "/advisor/profile", "Asesor", "Actualizar perfil", "advisor", "AdvisorProfileRequest"],
];

function buildOperation(method, path, tag, summary, auth, body, successStatus = 200, responseType, contentType = "application/json") {
  const roleDescriptions = {
    session: "Requiere una sesión válida.",
    staff: "Requiere rol asesor o administrador.",
    advisor: "Requiere rol asesor.",
    admin: "Requiere rol administrador.",
  };
  const operation = {
    tags: [tag],
    summary,
    operationId: `${method}_${path}`.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, ""),
    responses: {
      [successStatus]: responseType === "binary"
        ? { description: "Respuesta correcta", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } }
        : { description: "Respuesta correcta", content: { "application/json": { schema: objectSchema } } },
      400: { $ref: "#/components/responses/BadRequest" },
      500: { $ref: "#/components/responses/InternalError" },
    },
  };

  if (auth) {
    operation.description = roleDescriptions[auth];
    operation.security = [{ bearerAuth: [] }];
    operation.responses[401] = { $ref: "#/components/responses/Unauthorized" };
    operation.responses[403] = { $ref: "#/components/responses/Forbidden" };
  }

  const pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1], in: "path", required: true, schema: { type: "integer" },
  }));
  if (pathParameters.length) operation.parameters = pathParameters;

  if (body) {
    operation.requestBody = {
      required: true,
      content: { [contentType]: { schema: { $ref: `#/components/schemas/${body}` } } },
    };
  }
  return operation;
}

const paths = {};
for (const endpoint of endpoints) {
  const [method, path, ...settings] = endpoint;
  paths[path] ??= {};
  paths[path][method] = buildOperation(method, path, ...settings);
}

paths["/questions/random"].get.description = "Devuelve preguntas activas con texto distinto. intro excluye la categoría Viaje, que contiene la pregunta del banco sobre el propósito del viaje; el ID de esa pregunta depende de cada base de datos. La introducción fija del simulador no forma parte del banco.";
paths["/questions/random"].get.parameters = [
  { name: "count", in: "query", schema: { type: "integer", minimum: 1, maximum: 20, default: 4 }, description: "Cantidad de preguntas solicitadas." },
  { name: "exclude", in: "query", schema: { type: "string", example: "intro,id:12,category:Finanzas" }, description: "Lista separada por comas: intro, id:<entero> o category:<categoría>. intro equivale a category:Viaje." },
  { name: "excludeText", in: "query", schema: { type: "string", minLength: 1, maxLength: 500 }, description: "Excluye una pregunta cuyo texto coincida tras TRIM y comparación sin distinguir mayúsculas/minúsculas. Acepta un solo texto." },
];
paths["/questions/random"].get.responses[409] = {
  description: "No hay suficientes preguntas activas elegibles para la cantidad solicitada.",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

module.exports = {
  openapi: "3.0.3",
  info: { title: "VisaGuide API", version: "1.0.0" },
  servers: [{ url: "/", description: "Servidor actual" }],
  tags: [
    "Sistema", "Autenticación", "Perfil y trámite", "DS-160", "Documentos",
    "Preguntas", "Entrevistas", "Notificaciones", "Gestión consular", "Chat", "Asesor", "Administración",
  ].map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Token de sesión" },
    },
    schemas,
    responses: {
      BadRequest: { description: "Solicitud inválida", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      Unauthorized: { description: "Sesión ausente o inválida", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      Forbidden: { description: "Permisos insuficientes", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      InternalError: { description: "Error interno", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
    },
  },
};
