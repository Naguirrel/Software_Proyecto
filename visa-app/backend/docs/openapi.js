const objectSchema = { type: "object", additionalProperties: true };
const questionExampleText = (description) => ({ type: "string", nullable: true, maxLength: 2000, description });
const questionExampleProperties = {
  ejemplo_fuerte: questionExampleText("Ejemplo de respuesta fuerte."),
  explicacion_fuerte: questionExampleText("Por qué el ejemplo fuerte funciona."),
  ejemplo_debil: questionExampleText("Ejemplo de respuesta débil."),
  explicacion_debil: questionExampleText("Por qué el ejemplo débil perjudica la entrevista."),
};

const schemas = {
  Error: {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string" },
      code: { type: "string", nullable: true },
      requestId: {
        type: "string",
        nullable: true,
        maxLength: 100,
        pattern: "^[A-Za-z0-9._:-]+$",
        description: "Identificador de correlación incluido en errores internos y límites de solicitudes.",
      },
    },
  },
  RegisterRequest: {
    type: "object",
    required: ["nombre", "correo", "contrasena"],
    properties: {
      nombre: { type: "string" },
      correo: { type: "string", format: "email" },
      contrasena: { type: "string", format: "password", minLength: 8, description: "Mínimo 8 caracteres, con letras y números." },
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
      nuevaContrasena: { type: "string", format: "password", minLength: 8, description: "Mínimo 8 caracteres, con letras y números." },
    },
  },
  UserEmailRequest: {
    type: "object",
    required: ["correo"],
    properties: { correo: { type: "string", format: "email" } },
  },
  ProfileRequest: {
    type: "object",
    required: ["perfil"],
    properties: { perfil: objectSchema },
  },
  ProfileUpdateRequest: {
    type: "object",
    properties: {
      nombre: { type: "string" },
      telefono: { type: "string" },
      ciudad: { type: "string" },
      pais: { type: "string" },
      notificacionesEmail: { type: "boolean" },
      idioma: { type: "string" },
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
      prioridad: { type: "string", enum: ["baja", "normal", "alta"], default: "normal" },
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
      userId: { type: "integer", nullable: true },
    },
  },
  AdvisorQuestionRequest: {
    type: "object",
    required: ["question", "category", "difficulty"],
    properties: {
      question: { type: "string" }, category: { type: "string" }, difficulty: { type: "string", enum: ["Fácil", "Media", "Alta"] }, is_required: { type: "boolean" },
      ...questionExampleProperties,
    },
  },
  AdvisorQuestionStatusRequest: {
    type: "object",
    required: ["activo"],
    properties: { activo: { type: "boolean", example: false } },
  },
  AdvisorProfileRequest: {
    type: "object",
    required: ["nombre"],
    properties: { nombre: { type: "string" }, telefono: { type: "string" }, ciudad: { type: "string" }, pais: { type: "string" } },
  },
  AdvisorNotificationPreferencesRequest: {
    type: "object",
    required: ["soundEnabled", "mutedTypes"],
    properties: {
      soundEnabled: { type: "boolean" },
      mutedTypes: {
        type: "array",
        uniqueItems: true,
        items: { type: "string", enum: ["info", "etapa", "documento", "entrevista", "alerta", "chat", "assignment", "ds160", "task"] },
      },
    },
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

Object.assign(schemas, {
  AccountLockedError: {
    type: "object",
    required: ["error", "bloqueadoHasta", "minutosRestantes"],
    properties: {
      error: { type: "string", example: "Tu cuenta está bloqueada temporalmente por varios intentos fallidos." },
      bloqueadoHasta: { type: "string", format: "date-time" },
      minutosRestantes: { type: "integer", minimum: 1, maximum: 15, example: 15 },
    },
  },
  ClientWorkflowGate: {
    type: "object",
    required: ["allowed", "reason", "requiredStep", "requiredPath"],
    properties: {
      allowed: { type: "boolean" },
      reason: { type: "string" },
      requiredStep: {
        type: "string",
        nullable: true,
        enum: ["profile", "assignment", "documents", "ds160", "payment", "appointment", "interview"],
      },
      requiredPath: { type: "string", nullable: true, pattern: "^/" },
    },
  },
  ClientWorkflowProcess: {
    type: "object",
    required: ["id", "state", "stage", "progress"],
    properties: {
      id: { type: "integer", example: 18 },
      state: { type: "string", example: "En proceso" },
      stage: { type: "string", example: "Formulario DS-160" },
      progress: { type: "integer", minimum: 0, maximum: 100, example: 17 },
    },
  },
  ClientWorkflowRequirements: {
    type: "object",
    required: [
      "profileComplete", "ds160Complete", "requiredDocuments", "requiredDocumentsUploaded",
      "requiredDocumentsApproved", "documentsUploaded", "documentsApproved", "paymentStarted",
      "consularPaid", "appointmentScheduled", "interviewStarted",
    ],
    properties: {
      profileComplete: { type: "boolean" },
      ds160Complete: { type: "boolean" },
      requiredDocuments: { type: "integer", minimum: 0, example: 3 },
      requiredDocumentsUploaded: { type: "integer", minimum: 0, example: 2 },
      requiredDocumentsApproved: { type: "integer", minimum: 0, example: 1 },
      documentsUploaded: { type: "boolean" },
      documentsApproved: { type: "boolean" },
      paymentStarted: { type: "boolean" },
      consularPaid: { type: "boolean" },
      appointmentScheduled: { type: "boolean" },
      interviewStarted: { type: "boolean" },
    },
  },
  ClientWorkflowResponse: {
    type: "object",
    required: ["assigned", "advisorId", "currentStep", "currentStepLabel", "process", "requirements", "gates"],
    properties: {
      assigned: { type: "boolean" },
      advisorId: { type: "integer", nullable: true, example: 7 },
      currentStep: {
        type: "string",
        enum: ["profile", "assignment", "documents", "ds160", "payment", "appointment", "interview"],
      },
      currentStepLabel: { type: "string", example: "Completar DS-160" },
      process: { allOf: [{ $ref: "#/components/schemas/ClientWorkflowProcess" }], nullable: true },
      requirements: { $ref: "#/components/schemas/ClientWorkflowRequirements" },
      gates: {
        type: "object",
        required: [
          "profile", "documents", "dashboard", "timeline", "notifications", "information",
          "chat", "ds160", "payment", "appointment", "interview",
        ],
        additionalProperties: false,
        properties: Object.fromEntries(
          [
            "profile", "documents", "dashboard", "timeline", "notifications", "information",
            "chat", "ds160", "payment", "appointment", "interview",
          ].map((name) => [name, { $ref: "#/components/schemas/ClientWorkflowGate" }])
        ),
      },
    },
  },
  AdminUser: {
    type: "object",
    required: ["id", "nombre", "correo", "rol", "activo", "bloqueado", "bloqueadoHasta"],
    properties: {
      id: { type: "integer" },
      nombre: { type: "string" },
      correo: { type: "string", format: "email" },
      rol: { type: "string", enum: ["cliente", "asesor", "admin"] },
      perfil: { type: "string", nullable: true },
      activo: { type: "boolean" },
      bloqueado: { type: "boolean" },
      bloqueadoHasta: { type: "string", format: "date-time", nullable: true },
      telefono: { type: "string" },
      ciudad: { type: "string" },
      pais: { type: "string" },
      createdAt: { type: "string", format: "date-time", nullable: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
      capacidad: { type: "integer", minimum: 0 },
      disponible: { type: "boolean" },
      asignados: { type: "integer", minimum: 0 },
      pendientes: { type: "integer", minimum: 0 },
      asesor: { type: "string", nullable: true },
      asesorId: { type: "integer", nullable: true },
      actividad: { type: "string", format: "date-time", nullable: true },
    },
  },
  AdminUserResponse: {
    type: "object",
    required: ["usuario"],
    properties: { usuario: { $ref: "#/components/schemas/AdminUser" } },
  },
  AdvisorApplicant: {
    type: "object",
    required: ["id", "nombre", "correo", "perfil"],
    properties: {
      id: { type: "integer", example: 42 },
      nombre: { type: "string", example: "Ana López" },
      correo: { type: "string", format: "email", example: "ana@example.com" },
      perfil: { type: "string", example: "Turismo" },
      telefono: { type: "string", example: "+502 5555 0101" },
      ciudad: { type: "string", example: "Ciudad de Guatemala" },
      pais: { type: "string", example: "Guatemala" },
    },
  },
  AdvisorProcess: {
    type: "object",
    required: ["id", "estado", "etapaActual", "progreso", "solicitante"],
    properties: {
      id: { type: "integer", example: 18 },
      estado: { type: "string", enum: ["En proceso", "Pendiente", "Aprobado", "Inactivo", "Completado"] },
      etapaActual: { type: "string", example: "Formulario DS-160" },
      progreso: { type: "integer", minimum: 0, maximum: 100, example: 17 },
      siguientePaso: { type: "string", example: "Continuar con Formulario DS-160" },
      mensaje: { type: "string" },
      createdAt: { type: "string", format: "date-time", nullable: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
      solicitante: { $ref: "#/components/schemas/AdvisorApplicant" },
    },
  },
  AdvisorDashboardResponse: {
    type: "object",
    required: ["stats", "attention", "workQueue", "activity"],
    properties: {
      stats: {
        type: "object",
        required: ["activeProcesses", "pendingDocuments", "pendingDs160", "pendingInterviews", "pendingTasks", "unreadMessages"],
        properties: {
          activeProcesses: { type: "integer", minimum: 0, example: 12 },
          pendingDocuments: { type: "integer", minimum: 0, example: 4 },
          pendingDs160: { type: "integer", minimum: 0, example: 2 },
          pendingInterviews: { type: "integer", minimum: 0, example: 3 },
          pendingTasks: { type: "integer", minimum: 0, example: 5 },
          unreadMessages: { type: "integer", minimum: 0, example: 2 },
        },
      },
      attention: { type: "array", items: { $ref: "#/components/schemas/AdvisorProcess" } },
      workQueue: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "title", "actionUrl", "priority", "overdue"],
          properties: {
            id: { type: "integer" },
            type: { type: "string", enum: ["task", "ds160", "documento", "entrevista", "chat"] },
            title: { type: "string" },
            subtitle: { type: "string", nullable: true },
            actionUrl: { type: "string", pattern: "^/advisor/" },
            priority: { type: "string", enum: ["normal", "high"] },
            overdue: { type: "boolean" },
            dueAt: { type: "string", format: "date-time", nullable: true },
          },
        },
      },
      activity: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "action", "description", "createdAt"],
          properties: {
            id: { type: "integer" },
            action: { type: "string", example: "advisor.document_reviewed" },
            description: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  AdvisorProcessListResponse: {
    type: "object",
    required: ["processes"],
    properties: { processes: { type: "array", items: { $ref: "#/components/schemas/AdvisorProcess" } } },
  },
  AdvisorProcessResponse: {
    type: "object",
    required: ["process"],
    properties: { process: { $ref: "#/components/schemas/AdvisorProcess" } },
  },
  AdvisorProcessDetailResponse: {
    type: "object",
    required: ["process", "documents", "ds160", "interviews", "history"],
    properties: {
      process: { $ref: "#/components/schemas/AdvisorProcess" },
      documents: { type: "array", items: { $ref: "#/components/schemas/AdvisorDocument" } },
      ds160: { allOf: [{ $ref: "#/components/schemas/AdvisorDs160" }], nullable: true },
      interviews: { type: "array", items: { $ref: "#/components/schemas/AdvisorInterview" } },
      history: { type: "array", items: { type: "object", additionalProperties: true } },
    },
  },
  AdvisorDocument: {
    type: "object",
    required: ["id", "nombre", "usuario_id", "estado", "usuario"],
    properties: {
      id: { type: "integer", example: 31 },
      nombre: { type: "string", example: "Pasaporte" },
      tipo: { type: "string", example: "application/pdf" },
      archivo_url: { type: "string", example: "/documentos/31/archivo" },
      usuario_id: { type: "integer", example: 42 },
      documento_key: { type: "string", nullable: true, example: "passport" },
      estado: { type: "string", enum: ["pending", "review", "correction", "rejected", "approved"] },
      feedback: { type: "string", nullable: true },
      creado_en: { type: "string", format: "date-time", nullable: true },
      actualizado_en: { type: "string", format: "date-time", nullable: true },
      asesor_id: { type: "integer", nullable: true },
      asesor_nombre: { type: "string", nullable: true },
      usuario: {
        type: "object",
        required: ["id", "nombre", "correo"],
        properties: {
          id: { type: "integer", example: 42 },
          nombre: { type: "string", example: "Ana López" },
          correo: { type: "string", format: "email", example: "ana@example.com" },
        },
      },
    },
  },
  AdvisorDocumentListResponse: {
    type: "object",
    required: ["documents"],
    properties: { documents: { type: "array", items: { $ref: "#/components/schemas/AdvisorDocument" } } },
  },
  AdvisorDocumentResponse: {
    type: "object",
    required: ["document"],
    properties: { document: { $ref: "#/components/schemas/AdvisorDocument" } },
  },
  AdvisorDs160: {
    type: "object",
    required: ["id", "userId", "name", "email", "currentSection", "completed", "progress", "status", "data"],
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      name: { type: "string" },
      email: { type: "string", format: "email" },
      profile: { type: "string" },
      currentSection: { type: "integer", minimum: 1 },
      completed: { type: "boolean" },
      progress: { type: "integer", minimum: 0, maximum: 100 },
      status: { type: "string", enum: ["en_progreso", "por_revisar", "correccion", "aprobado"] },
      feedback: { type: "string" },
      data: { type: "object", additionalProperties: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  AdvisorDs160ListResponse: {
    type: "object",
    required: ["forms"],
    properties: { forms: { type: "array", items: { $ref: "#/components/schemas/AdvisorDs160" } } },
  },
  AdvisorInterviewResponseItem: {
    type: "object",
    properties: {
      id: { type: "string" },
      text: { type: "string" },
      recorded: { type: "boolean" },
      duration: { type: "number", minimum: 0 },
      audio: { type: "object", nullable: true, additionalProperties: true },
    },
  },
  AdvisorInterview: {
    type: "object",
    required: ["id", "user_id", "user_name", "user_email", "status", "responses"],
    properties: {
      id: { type: "integer" },
      user_id: { type: "integer" },
      user_name: { type: "string" },
      user_email: { type: "string", format: "email" },
      status: { type: "string", enum: ["pending", "reviewed"] },
      responses: { type: "array", items: { $ref: "#/components/schemas/AdvisorInterviewResponseItem" } },
      feedback: { type: "string", nullable: true },
      rating: { type: "integer", minimum: 1, maximum: 5, nullable: true },
      created_at: { type: "string", format: "date-time" },
      reviewed_at: { type: "string", format: "date-time", nullable: true },
      advisor_id: { type: "integer", nullable: true },
      advisor_name: { type: "string", nullable: true },
    },
  },
  AdvisorInterviewListResponse: {
    type: "object",
    required: ["sessions"],
    properties: { sessions: { type: "array", items: { $ref: "#/components/schemas/AdvisorInterview" } } },
  },
  AdvisorInterviewResponse: {
    type: "object",
    required: ["session"],
    properties: { session: { $ref: "#/components/schemas/AdvisorInterview" } },
  },
  AdvisorConversation: {
    type: "object",
    required: ["userId", "name", "email", "profile", "stage", "status", "lastMessage", "unreadCount"],
    properties: {
      userId: { type: "integer" },
      name: { type: "string" },
      email: { type: "string", format: "email" },
      profile: { type: "string" },
      stage: { type: "string" },
      status: { type: "string" },
      lastMessage: { type: "string" },
      lastMessageAt: { type: "string", format: "date-time", nullable: true },
      unreadCount: { type: "integer", minimum: 0 },
    },
  },
  AdvisorConversationListResponse: {
    type: "object",
    required: ["conversations"],
    properties: { conversations: { type: "array", items: { $ref: "#/components/schemas/AdvisorConversation" } } },
  },
  AdvisorChatAssignment: {
    type: "object",
    required: ["id_tramite", "id_usuario", "id_asesor", "etapa_actual", "estado"],
    additionalProperties: true,
    properties: {
      id_tramite: { type: "integer" },
      id_usuario: { type: "integer" },
      id_asesor: { type: "integer" },
      etapa_actual: { type: "string" },
      estado: { type: "string" },
      user_name: { type: "string" },
      user_email: { type: "string", format: "email" },
      advisor_name: { type: "string" },
      advisor_email: { type: "string", format: "email" },
    },
  },
  AdvisorChatMessage: {
    type: "object",
    required: ["id", "advisorId", "userId", "sender", "message", "createdAt"],
    properties: {
      id: { type: "integer" },
      advisorId: { type: "integer" },
      userId: { type: "integer" },
      sender: { type: "string", enum: ["advisor", "client"] },
      message: { type: "string", maxLength: 4000 },
      createdAt: { type: "string", format: "date-time" },
      readAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  AdvisorChatMessagePage: {
    type: "object",
    required: ["assignment", "messages", "hasMoreBefore", "hasMoreAfter"],
    properties: {
      assignment: { $ref: "#/components/schemas/AdvisorChatAssignment" },
      messages: { type: "array", items: { $ref: "#/components/schemas/AdvisorChatMessage" } },
      hasMoreBefore: { type: "boolean" },
      hasMoreAfter: { type: "boolean" },
    },
  },
  AdvisorChatMessageResponse: {
    type: "object",
    required: ["message"],
    properties: { message: { $ref: "#/components/schemas/AdvisorChatMessage" } },
  },
  AdvisorTask: {
    type: "object",
    required: ["id", "title", "priority", "status", "userId", "applicantName"],
    properties: {
      id: { type: "integer" },
      title: { type: "string", maxLength: 240 },
      dueAt: { type: "string", format: "date-time", nullable: true },
      priority: { type: "string", enum: ["normal", "high"] },
      status: { type: "string", enum: ["pending", "completed"] },
      userId: { type: "integer", nullable: true },
      applicantName: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  AdvisorTaskListResponse: {
    type: "object",
    required: ["tasks"],
    properties: { tasks: { type: "array", items: { $ref: "#/components/schemas/AdvisorTask" } } },
  },
  AdvisorTaskResponse: {
    type: "object",
    required: ["task"],
    properties: { task: { $ref: "#/components/schemas/AdvisorTask" } },
  },
  AdvisorQuestion: {
    type: "object",
    required: ["id", "question", "category", "difficulty", "is_required", "activo"],
    properties: {
      id: { type: "integer" },
      question: { type: "string" },
      category: { type: "string" },
      difficulty: { type: "string", enum: ["Fácil", "Media", "Alta"] },
      is_required: { type: "boolean" },
      activo: { type: "boolean" },
      uso_count: { type: "integer", minimum: 0 },
      created_at: { type: "string", format: "date-time" },
      ...questionExampleProperties,
    },
  },
  AdvisorQuestionListResponse: {
    type: "object",
    required: ["questions"],
    properties: { questions: { type: "array", items: { $ref: "#/components/schemas/AdvisorQuestion" } } },
  },
  AdvisorQuestionResponse: {
    type: "object",
    required: ["question"],
    properties: { question: { $ref: "#/components/schemas/AdvisorQuestion" } },
  },
  AdvisorProfile: {
    type: "object",
    required: ["id_usuario", "nombre", "correo", "rol"],
    properties: {
      id_usuario: { type: "integer" },
      nombre: { type: "string" },
      correo: { type: "string", format: "email" },
      telefono: { type: "string" },
      ciudad: { type: "string" },
      pais: { type: "string" },
      rol: { type: "string", enum: ["asesor"] },
    },
  },
  AdvisorProfileResponse: {
    type: "object",
    required: ["user"],
    properties: { user: { allOf: [{ $ref: "#/components/schemas/AdvisorProfile" }], nullable: true } },
  },
  AdvisorNotification: {
    type: "object",
    required: ["id", "id_usuario", "titulo", "mensaje", "tipo", "leido", "archivado", "created_at"],
    properties: {
      id: { type: "integer" },
      id_usuario: { type: "integer" },
      titulo: { type: "string" },
      mensaje: { type: "string" },
      tipo: { type: "string", enum: ["info", "etapa", "documento", "entrevista", "alerta", "chat", "assignment", "ds160", "task"] },
      leido: { type: "boolean" },
      archivado: { type: "boolean" },
      etapa_relacionada: { type: "string", nullable: true },
      action_url: { type: "string", nullable: true, pattern: "^/" },
      entity_type: { type: "string", nullable: true },
      entity_id: { type: "integer", nullable: true },
      dedupe_key: { type: "string", nullable: true },
      prioridad: { type: "string", enum: ["baja", "normal", "alta"], description: "Prioridad visual: alta pide atención o una acción; baja es solo informativa." },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  AdvisorNotificationListResponse: {
    type: "object",
    required: ["notifications", "hasMore", "unreadCount"],
    properties: {
      notifications: { type: "array", items: { $ref: "#/components/schemas/AdvisorNotification" } },
      hasMore: { type: "boolean" },
      unreadCount: { type: "integer", minimum: 0 },
    },
  },
  AdvisorNotificationResponse: {
    type: "object",
    required: ["notification"],
    properties: { notification: { $ref: "#/components/schemas/AdvisorNotification" } },
  },
  AdvisorNotificationPreferences: {
    type: "object",
    required: ["advisor_id", "sound_enabled", "muted_types"],
    properties: {
      advisor_id: { type: "integer" },
      sound_enabled: { type: "boolean" },
      muted_types: { type: "array", items: { type: "string" } },
      updated_at: { type: "string", format: "date-time", nullable: true },
    },
  },
  AdvisorNotificationPreferencesResponse: {
    type: "object",
    required: ["preferences"],
    properties: { preferences: { $ref: "#/components/schemas/AdvisorNotificationPreferences" } },
  },
  AdvisorNotificationReadAllResponse: {
    type: "object",
    required: ["message", "updated"],
    properties: { message: { type: "string" }, updated: { type: "integer", minimum: 0 } },
  },
  SuccessMessage: {
    type: "object",
    required: ["message"],
    properties: { message: { type: "string" } },
  },
});

const endpoints = [
  ["get", "/", "Sistema", "Comprobar estado de la API"],
  ["post", "/register", "Autenticación", "Registrar usuario", null, "RegisterRequest", 201],
  ["post", "/login", "Autenticación", "Iniciar sesión", null, "LoginRequest"],
  ["get", "/validar-sesion", "Autenticación", "Validar sesión", "session"],
  ["post", "/forgot-password", "Autenticación", "Solicitar recuperación de contraseña", null, "EmailRequest"],
  ["post", "/reset-password", "Autenticación", "Restablecer contraseña", null, "ResetPasswordRequest"],
  ["post", "/verificar-email", "Autenticación", "Verificar correo", null, "TokenRequest"],
  ["post", "/reenviar-verificacion", "Autenticación", "Reenviar verificación", null, "EmailRequest"],
  ["post", "/desbloquear-cuenta", "Autenticación", "Desbloquear cuenta con el enlace del correo", null, "TokenRequest"],
  ["post", "/guardar-perfil", "Perfil y trámite", "Guardar perfil de visa", "session", "ProfileRequest"],
  ["post", "/estado-tramite", "Perfil y trámite", "Consultar estado del trámite", "session"],
  ["get", "/workflow/me", "Perfil y trámite", "Consultar permisos y progreso del flujo del solicitante", "session"],
  ["post", "/usuario-perfil", "Perfil y trámite", "Consultar perfil del usuario", "session"],
  ["put", "/usuario-perfil", "Perfil y trámite", "Actualizar perfil del usuario", "session", "ProfileUpdateRequest"],
  ["put", "/tramite", "Perfil y trámite", "Actualización manual de trámite bloqueada", "session"],
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
  ["get", "/questions", "Preguntas", "Listar preguntas activas", "session"],
  ["get", "/questions/random", "Preguntas", "Seleccionar preguntas activas aleatorias", "session"],
  ["get", "/questions/admin", "Preguntas", "Listar banco de preguntas", "admin"],
  ["post", "/questions", "Preguntas", "Crear pregunta", "admin", "AdvisorQuestionRequest", 201],
  ["put", "/questions/{id}", "Preguntas", "Actualizar pregunta", "admin", "AdvisorQuestionRequest"],
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
  ["post", "/admin/users/{id}/unlock", "Administración", "Desbloquear cuenta bloqueada por intentos fallidos", "admin"],
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
  ["patch", "/advisor/questions/{id}/status", "Asesor", "Activar o desactivar pregunta", "advisor", "AdvisorQuestionStatusRequest"],
  ["get", "/advisor/profile", "Asesor", "Consultar perfil", "advisor"],
  ["put", "/advisor/profile", "Asesor", "Actualizar perfil", "advisor", "AdvisorProfileRequest"],
  ["get", "/advisor/notifications", "Asesor", "Listar notificaciones en tiempo real", "advisor"],
  ["get", "/advisor/notifications/stream", "Asesor", "Abrir flujo de notificaciones", "advisor"],
  ["put", "/advisor/notifications/read-all", "Asesor", "Marcar todas las notificaciones como leídas", "advisor"],
  ["put", "/advisor/notifications/{id}/read", "Asesor", "Marcar una notificación como leída", "advisor"],
  ["put", "/advisor/notifications/{id}/archive", "Asesor", "Archivar una notificación", "advisor"],
  ["delete", "/advisor/notifications/{id}", "Asesor", "Eliminar una notificación", "advisor"],
  ["get", "/advisor/notifications/preferences/current", "Asesor", "Consultar preferencias de notificación", "advisor"],
  ["put", "/advisor/notifications/preferences/current", "Asesor", "Actualizar preferencias de notificación", "advisor", "AdvisorNotificationPreferencesRequest"],
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
      429: { $ref: "#/components/responses/TooManyRequests" },
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

paths["/tramite"].put.description = "Ruta heredada protegida. Los clientes no pueden modificar estado, etapa ni progreso; el sistema los actualiza al completar cada actividad validada.";
delete paths["/tramite"].put.responses[200];
paths["/tramite"].put.responses[403] = {
  description: "La actualización manual del trámite no está permitida.",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

paths["/questions/random"].get.description = "Devuelve preguntas activas con texto distinto. intro excluye la categoría Viaje, que contiene la pregunta del banco sobre el propósito del viaje; el ID de esa pregunta depende de cada base de datos. La introducción fija del simulador no forma parte del banco.";
paths["/questions/random"].get.parameters = [
  { name: "count", in: "query", schema: { type: "integer", minimum: 1, maximum: 20, default: 4 }, description: "Cantidad de preguntas solicitadas." },
  { name: "exclude", in: "query", schema: { type: "string", example: "intro,id:12,category:Finanzas" }, description: "Lista separada por comas: intro, id:<entero> o category:<categoría>. intro equivale a category:Viaje." },
  { name: "excludeText", in: "query", schema: { type: "string", minLength: 1, maxLength: 500 }, description: "Excluye una pregunta cuyo texto coincida tras TRIM y comparación sin distinguir mayúsculas/minúsculas. Acepta un solo texto." },
];
paths["/login"].post.description = "Tras 5 intentos fallidos seguidos la cuenta se bloquea 15 minutos (RNF-13) y se envía un correo con un enlace de desbloqueo. Durante el bloqueo responde 423 aunque la contraseña sea correcta.";
paths["/login"].post.responses[423] = {
  description: "Cuenta bloqueada temporalmente por intentos fallidos. Incluye bloqueadoHasta y minutosRestantes.",
  content: { "application/json": { schema: { $ref: "#/components/schemas/AccountLockedError" } } },
};

paths["/desbloquear-cuenta"].post.description = "Consume una sola vez el token enviado por correo y reinicia el bloqueo y el contador de intentos fallidos.";
paths["/desbloquear-cuenta"].post.requestBody.content["application/json"].example = {
  token: "4a90f50b21f59ac32cf9f98b08953f1986501dc7ba66eb0332f40da91a043cca",
};
paths["/desbloquear-cuenta"].post.responses[200] = jsonSchemaResponse(
  "Cuenta desbloqueada",
  "SuccessMessage"
);

paths["/workflow/me"].get.description = "Requiere una sesión válida con rol cliente. Devuelve el estado calculado del trámite y las compuertas que determinan qué secciones están habilitadas.";
paths["/workflow/me"].get.responses[200] = jsonSchemaResponse(
  "Flujo actual del solicitante",
  "ClientWorkflowResponse"
);
paths["/workflow/me"].get.responses[404] = { $ref: "#/components/responses/NotFound" };

paths["/admin/users/{id}/unlock"].post.description = "Requiere rol administrador. Elimina el bloqueo temporal y reinicia el contador de intentos fallidos de la cuenta indicada.";
paths["/admin/users/{id}/unlock"].post.responses[200] = jsonSchemaResponse(
  "Cuenta desbloqueada",
  "AdminUserResponse"
);
paths["/admin/users/{id}/unlock"].post.responses[404] = { $ref: "#/components/responses/NotFound" };

paths["/questions/random"].get.responses[409] = {
  description: "No hay suficientes preguntas activas elegibles para la cantidad solicitada.",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

const messagePaginationParameters = [
  { name: "afterId", in: "query", required: false, schema: { type: "integer", minimum: 1 }, description: "Devuelve mensajes posteriores al identificador." },
  { name: "beforeId", in: "query", required: false, schema: { type: "integer", minimum: 1 }, description: "Devuelve mensajes anteriores al identificador." },
  { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
];
for (const path of ["/chat", "/advisor/conversations/{userId}/messages"]) {
  paths[path].get.parameters = [...(paths[path].get.parameters || []), ...messagePaginationParameters];
}

function jsonSchemaResponse(description, schemaName) {
  return {
    description,
    content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } } },
  };
}

const advisorDocumentation = {
  "/advisor/dashboard": {
    get: {
      description: "Devuelve métricas, solicitudes que requieren atención y actividad reciente del asesor autenticado.",
      response: [200, "Resumen del panel", "AdvisorDashboardResponse"],
    },
  },
  "/advisor/processes": {
    get: {
      description: "Lista únicamente los trámites asignados al asesor autenticado.",
      response: [200, "Solicitudes asignadas", "AdvisorProcessListResponse"],
    },
  },
  "/advisor/processes/{id}": {
    get: {
      description: "Obtiene el expediente completo de una solicitud asignada, incluidos documentos, DS-160, entrevistas e historial.",
      response: [200, "Detalle de la solicitud", "AdvisorProcessDetailResponse"],
      notFound: true,
    },
    put: {
      description: "Actualiza el estado y la etapa de una solicitud asignada y registra los cambios en el historial.",
      response: [200, "Solicitud actualizada", "AdvisorProcessResponse"],
      notFound: true,
      requestExample: { estado: "En proceso", etapaActual: "Formulario DS-160" },
    },
  },
  "/advisor/documents": {
    get: {
      description: "Lista los documentos pertenecientes a solicitantes asignados al asesor autenticado.",
      response: [200, "Documentos asignados", "AdvisorDocumentListResponse"],
    },
  },
  "/advisor/documents/{id}": {
    put: {
      description: "Aprueba un documento asignado o solicita su corrección. Para una corrección se recomienda explicar el cambio requerido en feedback.",
      response: [200, "Documento revisado", "AdvisorDocumentResponse"],
      notFound: true,
      requestExample: { status: "correction", feedback: "La página biográfica debe verse completa y sin reflejos." },
    },
  },
  "/advisor/ds160": {
    get: {
      description: "Lista los formularios DS-160 de los solicitantes asignados.",
      response: [200, "Formularios asignados", "AdvisorDs160ListResponse"],
    },
  },
  "/advisor/ds160/{id}": {
    put: {
      description: "Registra el resultado de la revisión de un formulario DS-160 asignado.",
      response: [200, "Formulario actualizado", "SuccessMessage"],
      notFound: true,
      requestExample: { status: "correccion", feedback: "Verifica las fechas de viajes anteriores." },
    },
  },
  "/advisor/interviews": {
    get: {
      description: "Lista las simulaciones de entrevista de solicitantes asignados al asesor.",
      response: [200, "Entrevistas asignadas", "AdvisorInterviewListResponse"],
    },
  },
  "/advisor/interviews/{id}/feedback": {
    put: {
      description: "Guarda retroalimentación y una calificación opcional para una entrevista asignada.",
      response: [200, "Entrevista revisada", "AdvisorInterviewResponse"],
      notFound: true,
      requestExample: { feedback: "Respuestas claras; conviene precisar el itinerario.", rating: 4 },
    },
  },
  "/advisor/conversations": {
    get: {
      description: "Lista una conversación por cada solicitante asignado, con el último mensaje y el conteo de no leídos.",
      response: [200, "Conversaciones asignadas", "AdvisorConversationListResponse"],
    },
  },
  "/advisor/conversations/{userId}/messages": {
    get: {
      description: "Lista una página de mensajes de un solicitante asignado. afterId y beforeId son mutuamente excluyentes.",
      response: [200, "Página de mensajes", "AdvisorChatMessagePage"],
      notFound: true,
    },
    post: {
      description: "Envía un mensaje al solicitante asignado indicado por userId.",
      response: [201, "Mensaje enviado", "AdvisorChatMessageResponse"],
      notFound: true,
      requestExample: { message: "Revisé tu formulario. Te dejé dos observaciones." },
    },
  },
  "/advisor/tasks": {
    get: {
      description: "Lista las tareas propias del asesor autenticado.",
      response: [200, "Tareas del asesor", "AdvisorTaskListResponse"],
    },
    post: {
      description: "Crea una tarea personal y, opcionalmente, la asocia con un solicitante asignado.",
      response: [201, "Tarea creada", "AdvisorTaskResponse"],
      notFound: true,
      requestExample: { title: "Revisar pasaporte", dueAt: "2026-10-12T16:00:00.000Z", priority: "high", userId: 42 },
    },
  },
  "/advisor/tasks/{id}": {
    put: {
      description: "Actualiza campos de una tarea propiedad del asesor autenticado.",
      response: [200, "Tarea actualizada", "AdvisorTaskResponse"],
      notFound: true,
      requestExample: { title: "Confirmar corrección de pasaporte", status: "completed" },
    },
    delete: {
      description: "Elimina una tarea propiedad del asesor autenticado.",
      response: [200, "Tarea eliminada", "SuccessMessage"],
      notFound: true,
    },
  },
  "/advisor/questions": {
    get: {
      description: "Lista el banco completo de preguntas de entrevista, incluidas las inactivas.",
      response: [200, "Banco de preguntas", "AdvisorQuestionListResponse"],
    },
    post: {
      description: "Crea una pregunta para el simulador de entrevistas.",
      response: [201, "Pregunta creada", "AdvisorQuestionResponse"],
      requestExample: { question: "¿Quién financiará su viaje?", category: "Finanzas", difficulty: "Media", is_required: true },
    },
  },
  "/advisor/questions/{id}": {
    put: {
      description: "Reemplaza el contenido editable de una pregunta existente. Los ejemplos y explicaciones que no se envíen conservan su valor; enviar null o texto vacío los borra.",
      response: [200, "Pregunta actualizada", "AdvisorQuestionResponse"],
      notFound: true,
      requestExample: { question: "¿Cómo financiará su viaje?", category: "Finanzas", difficulty: "Media", is_required: true },
    },
  },
  "/advisor/questions/{id}/status": {
    patch: {
      description: "Activa o desactiva una pregunta del simulador.",
      response: [200, "Estado de la pregunta actualizado", "AdvisorQuestionResponse"],
      notFound: true,
      requestExample: { activo: false },
    },
  },
  "/advisor/profile": {
    get: {
      description: "Obtiene los datos de contacto del asesor autenticado.",
      response: [200, "Perfil del asesor", "AdvisorProfileResponse"],
    },
    put: {
      description: "Actualiza el nombre y los datos de contacto del asesor autenticado.",
      response: [200, "Perfil actualizado", "AdvisorProfileResponse"],
      requestExample: { nombre: "María Asesora", telefono: "+502 5555 0102", ciudad: "Guatemala", pais: "Guatemala" },
    },
  },
  "/advisor/notifications": {
    get: {
      description: "Lista el buzón del asesor autenticado con filtros y paginación por cursor. También genera, una sola vez, recordatorios para tareas próximas a vencer o vencidas.",
      response: [200, "Buzón de notificaciones", "AdvisorNotificationListResponse"],
    },
  },
  "/advisor/notifications/stream": {
    get: {
      description: "Mantiene una conexión SSE autenticada. Envía un evento snapshot inicial, eventos notification posteriores y latidos periódicos para mantener viva la conexión.",
      response: [200, "Flujo de eventos SSE", "AdvisorNotificationListResponse"],
    },
  },
  "/advisor/notifications/read-all": {
    put: {
      description: "Marca como leídas todas las notificaciones del asesor autenticado.",
      response: [200, "Notificaciones actualizadas", "AdvisorNotificationReadAllResponse"],
    },
  },
  "/advisor/notifications/{id}/read": {
    put: {
      description: "Marca como leída una notificación que pertenece al asesor autenticado.",
      response: [200, "Notificación actualizada", "AdvisorNotificationResponse"],
      notFound: true,
    },
  },
  "/advisor/notifications/{id}/archive": {
    put: {
      description: "Archiva una notificación propia y la excluye del buzón activo.",
      response: [200, "Notificación archivada", "AdvisorNotificationResponse"],
      notFound: true,
    },
  },
  "/advisor/notifications/{id}": {
    delete: {
      description: "Elimina definitivamente una notificación propia.",
      response: [200, "Notificación eliminada", "SuccessMessage"],
      notFound: true,
    },
  },
  "/advisor/notifications/preferences/current": {
    get: {
      description: "Consulta las preferencias de sonido y categorías silenciadas del asesor autenticado.",
      response: [200, "Preferencias de notificación", "AdvisorNotificationPreferencesResponse"],
    },
    put: {
      description: "Actualiza las preferencias de sonido y categorías silenciadas del asesor autenticado.",
      response: [200, "Preferencias actualizadas", "AdvisorNotificationPreferencesResponse"],
      requestExample: { soundEnabled: true, mutedTypes: ["info"] },
    },
  },
};

paths["/advisor/notifications"].get.parameters = [
  { name: "status", in: "query", schema: { type: "string", enum: ["all", "read", "unread", "archived"], default: "all" } },
  { name: "type", in: "query", schema: { type: "string", enum: ["all", "info", "etapa", "documento", "entrevista", "alerta", "chat", "assignment", "ds160", "task"], default: "all" } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
  { name: "beforeId", in: "query", schema: { type: "integer", minimum: 1 } },
];

for (const [path, methods] of Object.entries(advisorDocumentation)) {
  for (const [method, documentation] of Object.entries(methods)) {
    const operation = paths[path][method];
    const [status, responseDescription, schemaName] = documentation.response;
    operation.description = `Requiere rol asesor. ${documentation.description}`;
    operation.responses[status] = jsonSchemaResponse(responseDescription, schemaName);
    if (documentation.notFound) operation.responses[404] = { $ref: "#/components/responses/NotFound" };
    if (documentation.requestExample) {
      operation.requestBody.content["application/json"].example = documentation.requestExample;
    }
    for (const parameter of operation.parameters || []) {
      parameter.description = parameter.name === "userId"
        ? "Identificador del solicitante asignado."
        : "Identificador del recurso asignado al asesor.";
      parameter.example = parameter.name === "userId" ? 42 : 18;
    }
  }
}

paths["/advisor/notifications/stream"].get.responses[200] = {
  description: "Flujo de eventos del servidor. Cada bloque contiene event, id opcional y data serializada como JSON.",
  content: { "text/event-stream": { schema: { type: "string" } } },
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
      NotFound: { description: "Recurso no encontrado o no asignado al asesor autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      TooManyRequests: { description: "Límite temporal de solicitudes excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      InternalError: { description: "Error interno", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
    },
  },
};
