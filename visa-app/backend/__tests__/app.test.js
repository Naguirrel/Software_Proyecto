const request = require("supertest");
const { Readable } = require("stream");
const bcrypt = require("bcrypt");
const { issueSessionToken } = require("../auth");

const LOGIN_TEST_PASSWORD_HASH = bcrypt.hashSync("1234", 10);

const DS160_TEST_USERS = {
  10: "ds160-con-form@example.com",
  11: "ds160-sin-form@example.com",
  12: "ds160-nuevo@example.com",
  13: "ds160-existente@example.com",
  14: "ds160-completado@example.com",
  15: "ds160-datos-vacios@example.com",
  16: "ds160-invalido@example.com",
  17: "ds160-pdf@example.com",
  18: "ds160-pdf-sin-form@example.com",
};

function ds160Token(id) {
  return issueSessionToken({ id_usuario: id, correo: DS160_TEST_USERS[id], rol: "cliente" });
}

const mockQuery = jest.fn();
const mockConnect = jest.fn(() => Promise.resolve());

jest.mock("pg", () => ({
  Pool: jest.fn(() => ({
    connect: mockConnect,
    query: mockQuery,
  })),
}));

jest.mock("../r2", () => ({
  uploadBufferToR2: jest.fn(() =>
    Promise.resolve({
      key: "mock-key.pdf",
      url: "https://r2.example.test/mock-bucket/mock-key.pdf",
    })
  ),
  deleteObjectFromR2: jest.fn(() => Promise.resolve()),
  validateR2Config: jest.fn(),
}));

const storedFileResult = {
  key: "local/mock-document.pdf",
  url: "http://localhost/local-files/mock-document.pdf",
  provider: "local",
};
const mockUploadStoredFile = jest.fn(() => Promise.resolve(storedFileResult));
const mockDeleteStoredFile = jest.fn(() => Promise.resolve());
const mockGetStoredFile = jest.fn(() => Promise.resolve({
  stream: Readable.from(["pdf de prueba"]),
  contentType: "application/octet-stream",
  contentLength: 13,
}));

jest.mock("../storage", () => ({
  LOCAL_STORAGE_DIR: "/tmp/visa-app-test-uploads",
  uploadStoredFile: mockUploadStoredFile,
  deleteStoredFile: mockDeleteStoredFile,
  getStoredFile: mockGetStoredFile,
}));

function defaultQueryHandler(sql, values) {
  const normalized = String(sql).replace(/\s+/g, " ").trim();

  if (normalized.includes("SELECT COUNT(*)::int AS total FROM question_bank")) {
    return Promise.resolve({ rows: [{ total: 1 }] });
  }

  if (normalized.includes("FROM usuario WHERE correo = $1") && !normalized.includes("contrasena")) {
    if (values?.[0] === "valido@example.com") {
      return Promise.resolve({ rows: [{ id_usuario: 1, nombre: "Valido", correo: values[0], perfil: "turismo_negocios", rol: "cliente" }] });
    }
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes("FROM usuario WHERE id_usuario = $1")) {
    const ds160Correo = DS160_TEST_USERS[values[0]];
    if (ds160Correo) {
      return Promise.resolve({ rows: [{ id_usuario: values[0], nombre: "Usuario DS160", correo: ds160Correo, perfil: null, rol: "cliente", activo: true, email_verificado: true }] });
    }
    return Promise.resolve({ rows: [{ id_usuario: values[0], nombre: "Admin", correo: "admin@test.dev", perfil: null, rol: "admin" }] });
  }

  if (normalized.includes("INSERT INTO usuario")) {
    return Promise.resolve({
      rows: [
        {
          id_usuario: 2,
          nombre: values[0],
          correo: values[1],
          contrasena: values[2],
          rol: values[3] || "cliente",
        },
      ],
    });
  }

  if (normalized.includes("FROM usuario WHERE correo = $1")) {
    if (values?.[0] === "login@example.com") {
      return Promise.resolve({
        rows: [
          {
            id_usuario: 3,
            nombre: "Usuario Login",
            correo: "login@example.com",
            perfil: "turismo_negocios",
            rol: "cliente",
            contrasena: LOGIN_TEST_PASSWORD_HASH,
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes("SELECT * FROM formulario_ds160 WHERE id_usuario = $1")) {
    if (values?.[0] === 10) {
      return Promise.resolve({
        rows: [
          {
            id_formulario: 50,
            id_usuario: 10,
            datos: {
              personal: {
                nombreCompleto: "Usuario DS160",
                pasaporte: "A1234567",
              },
            },
            seccion_actual: 3,
            completado: false,
          },
        ],
      });
    }
    if (values?.[0] === 17) {
      return Promise.resolve({
        rows: [
          {
            id_formulario: 51,
            id_usuario: 17,
            datos: {
              personal: {
                nombres: "Usuario",
                apellidos: "PDF",
                numeroPasaporte: "",
              },
              viaje: {
                proposito: "Turismo",
                duracionEstancia: 15,
              },
            },
            seccion_actual: 4,
            completado: false,
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes("SELECT id_formulario FROM formulario_ds160 WHERE id_usuario = $1")) {
    if (values?.[0] === 13 || values?.[0] === 14 || values?.[0] === 16) {
      return Promise.resolve({ rows: [{ id_formulario: 70 }] });
    }
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes("INSERT INTO formulario_ds160")) {
    return Promise.resolve({
      rows: [
        {
          id_formulario: 71,
          id_usuario: values[0],
          datos: JSON.parse(values[1]),
          seccion_actual: values[2],
          completado: values[3],
        },
      ],
    });
  }

  if (normalized.includes("UPDATE formulario_ds160")) {
    return Promise.resolve({
      rows: [
        {
          id_formulario: 70,
          id_usuario: values[3],
          datos: JSON.parse(values[0]),
          seccion_actual: values[1],
          completado: values[2],
        },
      ],
    });
  }

  if (normalized.includes("SELECT id_tramite, progreso FROM tramite WHERE id_usuario = $1")) {
    return Promise.resolve({
      rows: [{ id_tramite: 80, progreso: 17 }],
    });
  }

  if (normalized.includes("UPDATE tramite") && normalized.includes("Pago de visa")) {
    return Promise.resolve({ rows: [] });
  }

  if (
    normalized.includes("SELECT id FROM notificaciones") &&
    normalized.includes("etapa_relacionada = $2")
  ) {
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes("INSERT INTO notificaciones")) {
    return Promise.resolve({
      rows: [
        {
          id: 81,
          id_usuario: values[0],
          titulo: values[1],
          mensaje: values[2],
          tipo: values[3],
          leido: false,
          etapa_relacionada: values[4],
        },
      ],
    });
  }

  if (
    normalized.includes("SELECT id, question, category, difficulty, is_required, created_at") &&
    normalized.includes("FROM question_bank")
  ) {
    return Promise.resolve({
      rows: [
        {
          id: 10,
          question: "Cual es el proposito principal de su viaje?",
          category: "Viaje",
          difficulty: "Facil",
          is_required: true,
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
  }

  if (normalized.includes("INSERT INTO question_bank")) {
    return Promise.resolve({
      rows: [
        {
          id: 11,
          question: values[0],
          category: values[1],
          difficulty: values[2],
          is_required: values[3],
          created_at: "2026-07-02T00:00:00.000Z",
        },
      ],
    });
  }

  if (normalized.includes("UPDATE question_bank SET activo")) {
    return Promise.resolve({
      rows: [{
        id: values[1],
        question: "Pregunta existente",
        category: "General",
        difficulty: "Media",
        is_required: false,
        activo: values[0],
        uso_count: 0,
        created_at: "2026-07-02T00:00:00.000Z",
      }],
    });
  }

  if (normalized.includes("UPDATE question_bank")) {
    return Promise.resolve({
      rows: [
        {
          id: values[4],
          question: values[0],
          category: values[1],
          difficulty: values[2],
          is_required: values[3],
          created_at: "2026-07-02T00:00:00.000Z",
        },
      ],
    });
  }

  if (normalized.includes("DELETE FROM question_bank")) {
    return Promise.resolve({ rows: [{ id: values[0] }] });
  }

  if (normalized.includes("SELECT id, storage_key FROM documentos")) {
    return Promise.resolve({ rows: [] });
  }

  if (
    normalized.includes("FROM documentos") &&
    normalized.includes("WHERE id = $1") &&
    !normalized.includes("usuario_id")
  ) {
    return Promise.resolve({
      rows: [
        {
          id: values[0],
          nombre: "pasaporte.pdf",
          tipo: "application/pdf",
          archivo_url: "http://localhost/local-files/mock-document.pdf",
          storage_key: "local/mock-document.pdf",
        },
      ],
    });
  }

  if (
    normalized.includes("SELECT id, nombre, tipo, archivo_url, usuario_id, documento_key") &&
    normalized.includes("FROM documentos") &&
    normalized.includes("WHERE usuario_id = $1")
  ) {
    if (values?.[0] === 3) {
      return Promise.resolve({
        rows: [
          {
            id: 41,
            nombre: "Pasaporte",
            tipo: "application/pdf",
            archivo_url: "http://localhost/local-files/mock-document.pdf",
            usuario_id: 3,
            documento_key: "passport",
            estado: "review",
            feedback: null,
            creado_en: "2026-07-07T00:00:00.000Z",
            actualizado_en: "2026-07-07T00:00:00.000Z",
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes("FROM documentos d") && normalized.includes("LEFT JOIN usuario u")) {
    return Promise.resolve({
      rows: [
        {
          id: 41,
          nombre: "Pasaporte",
          tipo: "application/pdf",
          archivo_url: "http://localhost/local-files/mock-document.pdf",
          usuario_id: 3,
          documento_key: "passport",
          estado: "review",
          feedback: null,
          creado_en: "2026-07-07T00:00:00.000Z",
          actualizado_en: "2026-07-07T00:00:00.000Z",
          storage_key: "local/mock-document.pdf",
          usuario_nombre: "Usuario Login",
          usuario_correo: "login@example.com",
        },
      ],
    });
  }

  if (normalized.includes("WITH updated AS") && normalized.includes("UPDATE documentos")) {
    const statusIndex = normalized.includes("estado = $1")
      ? 0
      : normalized.includes("estado = $2")
        ? 1
        : -1;
    const feedbackIndex = normalized.includes("feedback = $1")
      ? 0
      : normalized.includes("feedback = $2")
        ? 1
        : -1;

    return Promise.resolve({
      rows: [
        {
          id: values[values.length - 1],
          nombre: "Pasaporte",
          tipo: "application/pdf",
          archivo_url: "http://localhost/local-files/mock-document.pdf",
          usuario_id: 3,
          documento_key: "passport",
          estado: statusIndex >= 0 ? values[statusIndex] : "review",
          feedback: feedbackIndex >= 0 ? values[feedbackIndex] : null,
          creado_en: "2026-07-07T00:00:00.000Z",
          actualizado_en: "2026-07-08T00:00:00.000Z",
          storage_key: "local/mock-document.pdf",
          usuario_nombre: "Usuario Login",
          usuario_correo: "login@example.com",
        },
      ],
    });
  }

  if (normalized.includes("INSERT INTO documentos")) {
    return Promise.resolve({
      rows: [{
        id: 41,
        nombre: values[0],
        tipo: values[1],
        archivo_url: values[2],
        usuario_id: values[3],
        documento_key: values[4],
        estado: "review",
      }],
    });
  }

  if (normalized.includes("DELETE FROM documentos")) {
    return Promise.resolve({ rows: [{ id: values[0], storage_key: "local/mock-document.pdf" }] });
  }

  if (normalized.includes("UPDATE usuario") && normalized.includes("RETURNING id_usuario, nombre")) {
    return Promise.resolve({
      rows: [{
        id_usuario: 3,
        nombre: values[0],
        correo: values[values.length - 1],
        perfil: "turismo_negocios",
        telefono: values[1],
        ciudad: values[2],
        pais: values[3],
        notificaciones_email: true,
        idioma: "es",
      }],
    });
  }

  if (
    normalized.includes("FROM notificaciones") &&
    normalized.includes("WHERE id_usuario = $1") &&
    normalized.includes("ORDER BY created_at DESC")
  ) {
    return Promise.resolve({
      rows: [
        {
          id: 20,
          id_usuario: values[0],
          titulo: "DS-160 completado",
          mensaje: "El formulario fue guardado.",
          tipo: "etapa",
          leido: false,
          etapa_relacionada: "Pago de visa",
          created_at: "2026-07-03T00:00:00.000Z",
          updated_at: "2026-07-03T00:00:00.000Z",
        },
      ],
    });
  }

  if (normalized.includes("UPDATE notificaciones") && normalized.includes("WHERE id = $1 AND id_usuario = $2")) {
    return Promise.resolve({
      rows: [
        {
          id: values[0],
          id_usuario: values[1],
          titulo: "DS-160 completado",
          mensaje: "El formulario fue guardado.",
          tipo: "etapa",
          leido: true,
          etapa_relacionada: "Pago de visa",
          created_at: "2026-07-03T00:00:00.000Z",
          updated_at: "2026-07-04T00:00:00.000Z",
        },
      ],
    });
  }

  if (normalized.includes("DELETE FROM notificaciones")) {
    return Promise.resolve({ rows: [{ id: values[0] }] });
  }

  if (normalized.includes("INSERT INTO interview_sessions")) {
    return Promise.resolve({
      rows: [
        {
          id: 30,
          user_id: values[0],
          user_name: values[1],
          user_email: values[2],
          status: "pending",
          responses: JSON.parse(values[3]),
          feedback: null,
          rating: null,
          created_at: "2026-07-05T00:00:00.000Z",
          reviewed_at: null,
        },
      ],
    });
  }

  if (
    normalized.includes("SELECT id, responses") &&
    normalized.includes("FROM interview_sessions") &&
    normalized.includes("WHERE id = $1")
  ) {
    return Promise.resolve({
      rows: [
        {
          id: values[0],
          responses: [
            {
              id: "purpose",
              text: "Cual es el motivo principal de su viaje?",
              recorded: true,
              duration: 35,
              audio: {
                url: "/interview-sessions/30/audio/purpose",
                key: "local/mock-audio.webm",
                mimetype: "audio/webm",
                size: 14,
              },
            },
          ],
        },
      ],
    });
  }

  if (normalized.includes("UPDATE interview_sessions")) {
    return Promise.resolve({
      rows: [
        {
          id: values[2],
          user_id: 4,
          user_name: "Usuario Entrevista",
          user_email: "entrevista@example.com",
          status: "reviewed",
          responses: [],
          feedback: values[0],
          rating: values[1],
          created_at: "2026-07-05T00:00:00.000Z",
          reviewed_at: "2026-07-06T00:00:00.000Z",
        },
      ],
    });
  }

  return Promise.resolve({ rows: [] });
}

function createIntegrationFlowQueryHandler() {
  const state = {
    user: null,
    ds160: null,
    documentos: [],
    nextUserId: 90,
    nextFormularioId: 190,
    nextDocumentoId: 290,
  };

  function buildDocumentoRow(documento) {
    return {
      id: documento.id,
      nombre: documento.nombre,
      tipo: documento.tipo,
      archivo_url: documento.archivo_url,
      usuario_id: documento.usuario_id,
      documento_key: documento.documento_key,
      estado: documento.estado,
      feedback: documento.feedback,
      creado_en: documento.creado_en,
      actualizado_en: documento.actualizado_en,
    };
  }

  async function queryHandler(sql, values) {
    const normalized = String(sql).replace(/\s+/g, " ").trim();

    if (normalized.includes("INSERT INTO usuario")) {
      state.user = {
        id_usuario: state.nextUserId,
        nombre: values[0],
        correo: values[1],
        contrasena: values[2],
        perfil: null,
        rol: values[3] || "cliente",
      };
      state.nextUserId += 1;
      return { rows: [state.user] };
    }

    if (normalized.includes("FROM usuario WHERE correo = $1")) {
      if (state.user && values?.[0] === state.user.correo) {
        return { rows: [state.user] };
      }
      return { rows: [] };
    }

    if (normalized.includes("SELECT id_usuario FROM usuario WHERE correo = $1")) {
      if (state.user && values?.[0] === state.user.correo) {
        return { rows: [{ id_usuario: state.user.id_usuario }] };
      }
      return { rows: [] };
    }

    if (normalized.includes("SELECT id_formulario FROM formulario_ds160 WHERE id_usuario = $1")) {
      if (state.ds160 && values?.[0] === state.ds160.id_usuario) {
        return { rows: [{ id_formulario: state.ds160.id_formulario }] };
      }
      return { rows: [] };
    }

    if (normalized.includes("INSERT INTO formulario_ds160")) {
      state.ds160 = {
        id_formulario: state.nextFormularioId,
        id_usuario: values[0],
        datos: JSON.parse(values[1]),
        seccion_actual: values[2],
        completado: values[3],
      };
      state.nextFormularioId += 1;
      return { rows: [state.ds160] };
    }

    if (normalized.includes("UPDATE formulario_ds160")) {
      state.ds160 = {
        id_formulario: state.ds160?.id_formulario || state.nextFormularioId,
        id_usuario: values[3],
        datos: JSON.parse(values[0]),
        seccion_actual: values[1],
        completado: values[2],
      };
      return { rows: [state.ds160] };
    }

    if (normalized.includes("SELECT * FROM formulario_ds160 WHERE id_usuario = $1")) {
      if (state.ds160 && values?.[0] === state.ds160.id_usuario) {
        return { rows: [state.ds160] };
      }
      return { rows: [] };
    }

    if (normalized.includes("SELECT id, storage_key FROM documentos")) {
      const existing = state.documentos.find(
        (documento) =>
          documento.usuario_id === values?.[0] &&
          documento.documento_key === values?.[1]
      );
      if (!existing) return { rows: [] };
      return { rows: [{ id: existing.id, storage_key: existing.storage_key }] };
    }

    if (normalized.includes("INSERT INTO documentos")) {
      const documento = {
        id: state.nextDocumentoId,
        nombre: values[0],
        tipo: values[1],
        archivo_url: values[2],
        usuario_id: values[3],
        documento_key: values[4],
        estado: "review",
        feedback: null,
        storage_key: values[5],
        creado_en: "2026-07-08T00:00:00.000Z",
        actualizado_en: "2026-07-08T00:00:00.000Z",
      };
      state.nextDocumentoId += 1;
      state.documentos.push(documento);
      return { rows: [buildDocumentoRow(documento)] };
    }

    if (
      normalized.includes("SELECT id, nombre, tipo, archivo_url, usuario_id, documento_key") &&
      normalized.includes("FROM documentos") &&
      normalized.includes("WHERE usuario_id = $1")
    ) {
      return {
        rows: state.documentos
          .filter((documento) => documento.usuario_id === values?.[0])
          .map(buildDocumentoRow),
      };
    }

    return defaultQueryHandler(sql, values);
  }

  return { state, queryHandler };
}

let app;
let adminToken;

beforeAll(() => {
  mockQuery.mockImplementation(defaultQueryHandler);
  app = require("../app");
  adminToken = require("../auth").issueSessionToken({ id_usuario: 99, correo: "admin@test.dev", rol: "admin" });
});

beforeEach(() => {
  mockQuery.mockClear();
  mockQuery.mockImplementation(defaultQueryHandler);
  mockUploadStoredFile.mockReset();
  mockUploadStoredFile.mockResolvedValue(storedFileResult);
  mockDeleteStoredFile.mockReset();
  mockDeleteStoredFile.mockResolvedValue();
  mockGetStoredFile.mockReset();
  mockGetStoredFile.mockResolvedValue({
    stream: Readable.from(["pdf de prueba"]),
    contentType: "application/octet-stream",
    contentLength: 13,
  });
});

describe("app endpoints", () => {
  test("OPTIONS permite preflight PATCH desde un origen autorizado", async () => {
    const response = await request(app)
      .options("/questions/11/status")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(response.headers["access-control-allow-headers"]).toBe("Authorization,Content-Type");
  });

  test("OPTIONS no autoriza un origen fuera de la lista", async () => {
    const response = await request(app)
      .options("/questions/11/status")
      .set("Origin", "https://untrusted.example.com")
      .set("Access-Control-Request-Method", "PATCH");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("GET /validar-sesion devuelve la sesión obtenida del token", async () => {
    const response = await request(app)
      .get("/validar-sesion")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ valid: true, user: { correo: "admin@test.dev", rol: "admin" } });
  });

  test("GET /validar-sesion devuelve 401 cuando falta el token", async () => {
    const response = await request(app).get("/validar-sesion");
    expect(response.status).toBe(401);
  });

  test("GET /validar-sesion devuelve 500 ante error simulado de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("FROM usuario WHERE id_usuario = $1")) {
        return Promise.reject(new Error("database unavailable"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .get("/validar-sesion")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "No fue posible validar la autorización",
    });
  });

  test("POST /register guarda un usuario con datos validos", async () => {
    const response = await request(app).post("/register").send({
      nombre: "Nuevo Usuario",
      correo: "nuevo@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Usuario guardado en BD");
    expect(response.body.data).toMatchObject({
      nombre: "Nuevo Usuario",
      correo: "nuevo@example.com",
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO activity_logs"),
      expect.arrayContaining(["user.registered", "usuario", "Usuario registrado"])
    );
  });

  test("POST /register guarda la contraseña como hash bcrypt, no en texto plano", async () => {
    await request(app).post("/register").send({
      nombre: "Nuevo Usuario",
      correo: "nuevo@example.com",
      contrasena: "1234",
    });

    const insertCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO usuario"));
    const storedPassword = insertCall[1][2];
    expect(storedPassword).not.toBe("1234");
    expect(storedPassword).toMatch(/^\$2[aby]\$/);
    expect(bcrypt.compareSync("1234", storedPassword)).toBe(true);
  });

  test("POST /register devuelve 500 cuando el correo ya existe", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("INSERT INTO usuario")) {
        return Promise.reject(
          new Error('duplicate key value violates unique constraint "usuario_correo_key"')
        );
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app).post("/register").send({
      nombre: "Usuario Repetido",
      correo: "repetido@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'duplicate key value violates unique constraint "usuario_correo_key"',
    });
  });

  test("POST /register devuelve 400 cuando faltan campos obligatorios", async () => {
    const response = await request(app).post("/register").send({
      nombre: "Usuario Sin Correo",
      contrasena: "1234",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Nombre, correo y contraseña son obligatorios",
    });
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO usuario"), expect.anything());
  });

  test("POST /register rechaza datos con formato invalido", async () => {
    const response = await request(app).post("/register").send({
      nombre: "Usuario Invalido",
      correo: "correo-sin-formato",
      contrasena: "1234",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Correo inválido" });
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO usuario"), expect.anything());
  });

  test("POST /register devuelve 500 ante error simulado de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("INSERT INTO usuario")) {
        return Promise.reject(new Error("duplicate key value"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app).post("/register").send({
      nombre: "Usuario Repetido",
      correo: "nuevo@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("duplicate key value");
  });

  test("POST /login devuelve usuario cuando las credenciales son validas", async () => {
    const response = await request(app).post("/login").send({
      correo: "login@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Login exitoso");
    expect(response.body.user.correo).toBe("login@example.com");
    expect(response.body.usuario).toMatchObject({
      id: 3,
      id_usuario: 3,
      correo: "login@example.com",
      rol: "cliente",
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO activity_logs"),
      expect.arrayContaining(["user.login", "usuario", "Login exitoso"])
    );
  });

  test("POST /login no falla si el log de actividad no se puede registrar", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("INSERT INTO activity_logs")) {
        return Promise.reject(new Error("activity log unavailable"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app).post("/login").send({
      correo: "login@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("POST /login devuelve 403 cuando la cuenta esta desactivada", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).replace(/\s+/g, " ").includes("FROM usuario WHERE correo = $1")) {
        if (values?.[0] === "inactivo@example.com") {
          return Promise.resolve({ rows: [{ id_usuario: 9, nombre: "Inactivo", correo: "inactivo@example.com", perfil: null, rol: "cliente", activo: false, contrasena: LOGIN_TEST_PASSWORD_HASH }] });
        }
        return Promise.resolve({ rows: [] });
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app).post("/login").send({
      correo: "inactivo@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Cuenta desactivada. Contacta a un administrador." });
  });

  test("POST /login migra una contraseña legada en texto plano a bcrypt al iniciar sesion con exito", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).replace(/\s+/g, " ").includes("FROM usuario WHERE correo = $1")) {
        if (values?.[0] === "legado@example.com") {
          return Promise.resolve({ rows: [{ id_usuario: 15, nombre: "Usuario Legado", correo: "legado@example.com", perfil: null, rol: "cliente", activo: true, contrasena: "1234" }] });
        }
        return Promise.resolve({ rows: [] });
      }
      if (String(sql).includes("UPDATE usuario SET contrasena")) {
        return Promise.resolve({ rows: [] });
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app).post("/login").send({
      correo: "legado@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(200);
    const updateCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes("UPDATE usuario SET contrasena"));
    expect(updateCall).toBeDefined();
    expect(updateCall[1][0]).toMatch(/^\$2[aby]\$/);
    expect(updateCall[1][1]).toBe(15);
  });

  test("POST /login devuelve 401 con credenciales incorrectas", async () => {
    const response = await request(app).post("/login").send({
      correo: "login@example.com",
      contrasena: "incorrecta",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "El correo o la contraseña son incorrectos" });
  });

  test("POST /login devuelve 401 cuando faltan campos", async () => {
    const response = await request(app).post("/login").send({
      correo: "login@example.com",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "El correo o la contraseña son incorrectos" });
  });

  test("POST /login devuelve 401 cuando el usuario no existe", async () => {
    const response = await request(app).post("/login").send({
      correo: "noexiste@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "El correo o la contraseña son incorrectos" });
  });

  test("POST /login devuelve 500 ante error simulado de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).replace(/\s+/g, " ").includes("FROM usuario WHERE correo = $1")) {
        return Promise.reject(new Error("connection timeout"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app).post("/login").send({
      correo: "login@example.com",
      contrasena: "1234",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "connection timeout" });
  });

  test("POST /ds160/load carga el formulario del usuario autenticado", async () => {
    const response = await request(app)
      .post("/ds160/load")
      .set("Authorization", `Bearer ${ds160Token(10)}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      datos: {
        personal: {
          nombreCompleto: "Usuario DS160",
          pasaporte: "A1234567",
        },
      },
      seccion_actual: 3,
      completado: false,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT * FROM formulario_ds160 WHERE id_usuario = $1"),
      [10]
    );
  });

  test("POST /ds160/load devuelve formulario vacio cuando el usuario no tiene progreso guardado", async () => {
    const response = await request(app)
      .post("/ds160/load")
      .set("Authorization", `Bearer ${ds160Token(11)}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      datos: {},
      seccion_actual: 1,
      completado: false,
    });
  });

  test("POST /ds160/load devuelve 401 sin una sesión válida", async () => {
    const response = await request(app).post("/ds160/load").send({});

    expect(response.status).toBe(401);
  });

  test("POST /ds160/load ignora un correo ajeno enviado en el body y solo usa la sesión autenticada", async () => {
    const response = await request(app)
      .post("/ds160/load")
      .set("Authorization", `Bearer ${ds160Token(10)}`)
      .send({ correo: "ds160-sin-form@example.com" });

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT * FROM formulario_ds160 WHERE id_usuario = $1"),
      [10]
    );
  });

  test("POST /ds160/load devuelve 500 ante error simulado de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("SELECT * FROM formulario_ds160 WHERE id_usuario = $1")) {
        return Promise.reject(new Error("ds160 read failed"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .post("/ds160/load")
      .set("Authorization", `Bearer ${ds160Token(10)}`)
      .send({});

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "ds160 read failed" });
  });

  test("POST /ds160/pdf genera el PDF del formulario del usuario autenticado", async () => {
    const response = await request(app)
      .post("/ds160/pdf")
      .set("Authorization", `Bearer ${ds160Token(17)}`)
      .send({})
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/pdf/);
    expect(response.headers["content-disposition"]).toBe('attachment; filename="ds160-17.pdf"');
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.subarray(0, 4).toString()).toBe("%PDF");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO activity_logs"),
      expect.arrayContaining(["ds160.pdf_exported", "formulario_ds160", "PDF DS-160 descargado"])
    );
  });

  test("POST /ds160/pdf devuelve 401 sin una sesión válida", async () => {
    const response = await request(app).post("/ds160/pdf").send({});

    expect(response.status).toBe(401);
  });

  test("POST /ds160/pdf devuelve 404 cuando no existe formulario guardado", async () => {
    const response = await request(app)
      .post("/ds160/pdf")
      .set("Authorization", `Bearer ${ds160Token(18)}`)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Formulario DS-160 no encontrado" });
  });

  test("POST /ds160/pdf devuelve 500 ante error interno de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("SELECT * FROM formulario_ds160 WHERE id_usuario = $1")) {
        return Promise.reject(new Error("ds160 pdf failed"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .post("/ds160/pdf")
      .set("Authorization", `Bearer ${ds160Token(17)}`)
      .send({});

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "ds160 pdf failed" });
  });

  test("POST /ds160 crea el formulario inicial y guarda el progreso", async () => {
    const datos = {
      personal: {
        nombreCompleto: "Usuario Nuevo",
        paisNacimiento: "Guatemala",
      },
    };

    const response = await request(app)
      .post("/ds160")
      .set("Authorization", `Bearer ${ds160Token(12)}`)
      .send({ datos, seccion_actual: 2, completado: false });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Formulario guardado correctamente");
    expect(response.body.formulario).toMatchObject({
      id_usuario: 12,
      datos,
      seccion_actual: 2,
      completado: false,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO formulario_ds160"),
      [12, JSON.stringify(datos), 2, false]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO activity_logs"),
      expect.arrayContaining(["ds160.saved", "formulario_ds160", "Formulario DS-160 creado"])
    );
  });

  test("POST /ds160 actualiza un formulario existente y la seccion actual", async () => {
    const datos = {
      viaje: {
        proposito: "Turismo",
        ciudadDestino: "Miami",
      },
    };

    const response = await request(app)
      .post("/ds160")
      .set("Authorization", `Bearer ${ds160Token(13)}`)
      .send({ datos, seccion_actual: 4, completado: false });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Formulario guardado correctamente");
    expect(response.body.formulario).toMatchObject({
      id_usuario: 13,
      datos,
      seccion_actual: 4,
      completado: false,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE formulario_ds160"),
      [JSON.stringify(datos), 4, false, 13]
    );
  });

  test("POST /ds160 marca el formulario como completado, avanza el tramite y notifica al usuario", async () => {
    const datos = {
      confirmacion: {
        numeroConfirmacion: "AA00BB11",
      },
    };

    const response = await request(app)
      .post("/ds160")
      .set("Authorization", `Bearer ${ds160Token(14)}`)
      .send({ datos, seccion_actual: 6, completado: true });

    expect(response.status).toBe(200);
    expect(response.body.formulario).toMatchObject({
      id_usuario: 14,
      datos,
      seccion_actual: 6,
      completado: true,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id_tramite, progreso FROM tramite WHERE id_usuario = $1"),
      [14]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE tramite"),
      [14]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      expect.arrayContaining([14, "DS-160 completado"])
    );
  });

  test("POST /ds160 devuelve 401 sin una sesión válida", async () => {
    const response = await request(app).post("/ds160").send({
      datos: { personal: { nombreCompleto: "Sin Sesion" } },
      seccion_actual: 1,
      completado: false,
    });

    expect(response.status).toBe(401);
  });

  test("POST /ds160 ignora un correo ajeno enviado en el body y guarda sobre la sesión autenticada", async () => {
    const response = await request(app)
      .post("/ds160")
      .set("Authorization", `Bearer ${ds160Token(15)}`)
      .send({ correo: "ds160-con-form@example.com", datos: {}, seccion_actual: 1, completado: false });

    expect(response.status).toBe(200);
    expect(response.body.formulario.id_usuario).toBe(15);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO formulario_ds160"),
      [15, JSON.stringify({}), 1, false]
    );
  });

  test("POST /ds160 guarda datos vacios cuando no se envia el objeto datos", async () => {
    const response = await request(app)
      .post("/ds160")
      .set("Authorization", `Bearer ${ds160Token(15)}`)
      .send({ seccion_actual: 1, completado: false });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Formulario guardado correctamente");
    expect(response.body.formulario).toMatchObject({
      id_usuario: 15,
      datos: {},
      seccion_actual: 1,
      completado: false,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO formulario_ds160"),
      [15, JSON.stringify({}), 1, false]
    );
  });

  test("POST /ds160 acepta valores invalidos porque el backend no valida tipos ni estructura", async () => {
    const response = await request(app)
      .post("/ds160")
      .set("Authorization", `Bearer ${ds160Token(16)}`)
      .send({ datos: "contenido-no-estructurado", seccion_actual: "segunda", completado: false });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Formulario guardado correctamente");
    expect(response.body.formulario).toMatchObject({
      id_usuario: 16,
      datos: "contenido-no-estructurado",
      seccion_actual: "segunda",
      completado: false,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE formulario_ds160"),
      [JSON.stringify("contenido-no-estructurado"), "segunda", false, 16]
    );
  });

  test("POST /ds160 devuelve 500 ante error simulado de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("INSERT INTO formulario_ds160")) {
        return Promise.reject(new Error("ds160 write failed"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .post("/ds160")
      .set("Authorization", `Bearer ${ds160Token(12)}`)
      .send({ datos: { personal: { nombreCompleto: "Error DB" } }, seccion_actual: 1, completado: false });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "ds160 write failed" });
  });

  test("GET /questions lista preguntas desde el servicio", async () => {
    const response = await request(app).get("/questions");

    expect(response.status).toBe(200);
    expect(response.body.questions).toHaveLength(1);
    expect(response.body.questions[0].category).toBe("Viaje");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE activo = TRUE"));
  });

  test("GET /questions/admin exige administrador y lista preguntas inactivas", async () => {
    await request(app).get("/questions/admin").expect(401);

    const response = await request(app)
      .get("/questions/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.questions).toHaveLength(1);
    const listQuery = mockQuery.mock.calls.find(([sql]) => String(sql).includes("FROM question_bank") && String(sql).includes("ORDER BY created_at"));
    expect(String(listQuery[0])).not.toContain("WHERE activo = TRUE");
  });

  test("POST /questions crea una pregunta valida", async () => {
    const response = await request(app).post("/questions").set("Authorization", `Bearer ${adminToken}`).send({
      question: "Quien financiara su viaje?",
      category: "Finanzas",
      difficulty: "Media",
      is_required: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Pregunta creada correctamente");
    expect(response.body.question).toMatchObject({
      question: "Quien financiara su viaje?",
      category: "Finanzas",
      difficulty: "Media",
      is_required: true,
    });
  });

  test("PUT /questions/:id actualiza una pregunta existente", async () => {
    const response = await request(app).put("/questions/11").set("Authorization", `Bearer ${adminToken}`).send({
      question: "Cuanto tiempo permanecera en el pais?",
      category: "Viaje",
      difficulty: "Media",
      is_required: false,
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Pregunta actualizada correctamente");
    expect(response.body.question.id).toBe(11);
  });

  test("DELETE /questions/:id elimina una pregunta existente", async () => {
    const response = await request(app).delete("/questions/11").set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Pregunta eliminada correctamente",
    });
  });

  test("PATCH /questions/:id/status activa o desactiva una pregunta", async () => {
    const response = await request(app)
      .patch("/questions/11/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ activo: false });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Pregunta desactivada correctamente");
    expect(response.body.question).toMatchObject({ id: 11, activo: false });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE question_bank SET activo"),
      [false, 11]
    );
  });

  test("GET /notificaciones/:userId lista notificaciones del usuario", async () => {
    const response = await request(app)
      .get("/notificaciones/1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.notificaciones[0]).toMatchObject({
      id_usuario: 1,
      leido: false,
    });
  });

  test("PUT /notificaciones/:id/leer marca una notificacion como leida", async () => {
    const response = await request(app)
      .put("/notificaciones/20/leer")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: 1 });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Notificación marcada como leída");
    expect(response.body.notificacion.leido).toBe(true);
  });

  test("DELETE /notificaciones/:id elimina una notificacion del usuario", async () => {
    const response = await request(app)
      .delete("/notificaciones/20")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: 1 });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Notificación eliminada correctamente");
  });

  test("POST /interview-sessions crea una sesion sin usar R2 real cuando no hay archivos", async () => {
    const response = await request(app)
      .post("/interview-sessions")
      .field(
        "session",
        JSON.stringify({
          user: {
            id: 4,
            nombre: "Usuario Entrevista",
            correo: "entrevista@example.com",
          },
          questions: [
            {
              id: "purpose",
              text: "Cual es el motivo principal de su viaje?",
              recorded: true,
              duration: 35,
            },
          ],
        })
      );

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      "Sesión de entrevista guardada correctamente"
    );
    expect(response.body.session.status).toBe("pending");
  });

  test("POST /interview-sessions guarda audios con storage y expone URL del backend", async () => {
    const response = await request(app)
      .post("/interview-sessions")
      .field(
        "session",
        JSON.stringify({
          user: {
            id: 4,
            nombre: "Usuario Entrevista",
            correo: "entrevista@example.com",
          },
          questions: [
            {
              id: "purpose",
              text: "Cual es el motivo principal de su viaje?",
              recorded: true,
              duration: 35,
            },
          ],
        })
      )
      .attach("audio_purpose", Buffer.from("audio de prueba"), {
        filename: "purpose.webm",
        contentType: "audio/webm",
      });

    expect(response.status).toBe(201);
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
    expect(response.body.session.responses[0].audio).toMatchObject({
      key: "local/mock-document.pdf",
      url: "/interview-sessions/30/audio/purpose",
      mimetype: "audio/webm",
      size: 15,
    });
  });

  test("POST /interview-sessions rechaza audio con extension no permitida", async () => {
    const response = await request(app)
      .post("/interview-sessions")
      .field(
        "session",
        JSON.stringify({
          user: {
            id: 4,
            nombre: "Usuario Entrevista",
            correo: "entrevista@example.com",
          },
          questions: [
            {
              id: "purpose",
              text: "Cual es el motivo principal de su viaje?",
              recorded: true,
              duration: 35,
            },
          ],
        })
      )
      .attach("audio_purpose", Buffer.from("audio falso"), {
        filename: "purpose.js",
        contentType: "audio/webm",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Tipo de archivo no permitido" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("GET /interview-sessions/:id/audio/:questionId sirve audio almacenado para reproductores HTML", async () => {
    mockGetStoredFile.mockResolvedValueOnce({
      stream: Readable.from(["audio de prueba"]),
      contentType: "application/octet-stream",
      contentLength: 15,
    });

    const response = await request(app)
      .get("/interview-sessions/30/audio/purpose");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^audio\/webm/);
    expect(response.headers["content-disposition"]).toBe(
      'inline; filename="entrevista-30-purpose.webm"'
    );
    expect(mockGetStoredFile).toHaveBeenCalledWith("local/mock-audio.webm");
    expect(Buffer.from(response.body).toString()).toBe("audio de prueba");
  });

  test("PUT /interview-sessions/:id/feedback guarda retroalimentacion valida", async () => {
    const response = await request(app)
      .put("/interview-sessions/30/feedback")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ feedback: "Respuesta clara y concreta.", rating: 5 });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Retroalimentación guardada correctamente");
    expect(response.body.session).toMatchObject({
      id: 30,
      status: "reviewed",
      feedback: "Respuesta clara y concreta.",
      rating: 5,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [
        4,
        "Entrevista revisada",
        "Ya puedes consultar la retroalimentacion de tu entrevista.",
        "entrevista",
        "entrevista-30",
      ]
    );
  });

  test("POST /upload guarda un documento mediante el proveedor configurado", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Pasaporte")
      .field("tipo", "application/pdf")
      .field("usuario_id", "3")
      .field("documento_key", "passport")
      .attach("file", Buffer.from("pdf de prueba"), "pasaporte.pdf");

    expect(response.status).toBe(200);
    expect(response.body.documento).toMatchObject({ id: 41, documento_key: "passport" });
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO activity_logs"),
      expect.arrayContaining(["document.uploaded", "documento", "Documento cargado"])
    );
  });

  test("POST /upload acepta imagen JPG valida", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Fotografia")
      .field("usuario_id", "3")
      .attach("file", Buffer.from("jpg de prueba"), {
        filename: "foto.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Archivo subido correctamente");
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
  });

  test("POST /upload rechaza archivo exe", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Ejecutable")
      .field("usuario_id", "3")
      .attach("file", Buffer.from("exe de prueba"), {
        filename: "archivo.exe",
        contentType: "application/octet-stream",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Tipo de archivo no permitido" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /upload rechaza archivo js", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Script")
      .field("usuario_id", "3")
      .attach("file", Buffer.from("console.log('x')"), {
        filename: "script.js",
        contentType: "application/javascript",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Tipo de archivo no permitido" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /upload rechaza MIME permitido con extension peligrosa", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Archivo falso")
      .field("usuario_id", "3")
      .attach("file", Buffer.from("pdf falso"), {
        filename: "payload.exe",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Tipo de archivo no permitido" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /upload rechaza archivos sin extension valida", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Sin extension")
      .field("usuario_id", "3")
      .attach("file", Buffer.from("sin extension"), {
        filename: "documento",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "El archivo debe tener una extensión válida" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /upload rechaza archivos que exceden 5 MB", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Archivo grande")
      .field("usuario_id", "3")
      .attach("file", Buffer.alloc((5 * 1024 * 1024) + 1), {
        filename: "grande.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "El archivo excede el límite de 5 MB" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /upload devuelve 400 cuando falta el archivo", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Pasaporte")
      .field("usuario_id", "3");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Archivo requerido" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /upload acepta metadatos faltantes porque el backend usa valores por defecto", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("pdf de prueba"), "documento.pdf");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Archivo subido correctamente");
    expect(response.body.documento).toMatchObject({
      nombre: "documento.pdf",
      usuario_id: 99,
      documento_key: null,
    });
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO activity_logs"),
      expect.arrayContaining(["document.uploaded", "documento", "Documento cargado"])
    );
  });

  test("POST /upload devuelve 400 cuando usuario_id no es numerico", async () => {
    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Pasaporte")
      .field("usuario_id", "abc")
      .attach("file", Buffer.from("pdf de prueba"), "pasaporte.pdf");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "usuario_id debe ser numérico" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /upload devuelve 500 cuando uploadStoredFile falla", async () => {
    mockUploadStoredFile.mockRejectedValueOnce(new Error("storage offline"));

    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Pasaporte")
      .field("usuario_id", "3")
      .attach("file", Buffer.from("pdf de prueba"), "pasaporte.pdf");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "No se pudo guardar el documento" });
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
    expect(mockDeleteStoredFile).not.toHaveBeenCalled();
  });

  test("POST /upload limpia el archivo si falla la persistencia en base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("INSERT INTO documentos")) {
        return Promise.reject(new Error("document insert failed"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Pasaporte")
      .field("usuario_id", "3")
      .attach("file", Buffer.from("pdf de prueba"), "pasaporte.pdf");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "No se pudo guardar el documento" });
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
    expect(mockDeleteStoredFile).toHaveBeenCalledWith("local/mock-document.pdf");
  });

  test("POST /upload devuelve 500 si usuario_id no existe y la base de datos rechaza la referencia", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("INSERT INTO documentos") && values?.[3] === 999) {
        return Promise.reject(
          new Error('insert or update on table "documentos" violates foreign key constraint')
        );
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .post("/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Pasaporte")
      .field("usuario_id", "999")
      .attach("file", Buffer.from("pdf de prueba"), "pasaporte.pdf");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "No se pudo guardar el documento" });
    expect(mockDeleteStoredFile).toHaveBeenCalledWith("local/mock-document.pdf");
  });

  test("POST /documentos crea un documento con archivo valido", async () => {
    const response = await request(app)
      .post("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Visa anterior")
      .field("tipo", "application/pdf")
      .field("usuario_id", "3")
      .field("documento_key", "previous_visa")
      .attach("file", Buffer.from("pdf de prueba"), "visa-anterior.pdf");

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Documento guardado correctamente");
    expect(response.body.documento).toMatchObject({
      id: 41,
      nombre: "Visa anterior",
      usuario_id: 3,
      documento_key: "previous_visa",
      estado: "review",
    });
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
  });

  test("POST /documentos acepta imagen PNG valida", async () => {
    const response = await request(app)
      .post("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Fotografia")
      .field("tipo", "image/png")
      .field("usuario_id", "3")
      .field("documento_key", "photo")
      .attach("file", Buffer.from("png de prueba"), {
        filename: "foto.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Documento guardado correctamente");
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
  });

  test("POST /documentos devuelve 400 cuando falta el archivo", async () => {
    const response = await request(app)
      .post("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Visa anterior")
      .field("usuario_id", "3");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Archivo requerido" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /documentos devuelve 400 cuando falta el nombre", async () => {
    const response = await request(app)
      .post("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("usuario_id", "3")
      .attach("file", Buffer.from("pdf de prueba"), "visa-anterior.pdf");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Nombre requerido" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /documentos devuelve 400 cuando usuario_id no es numerico", async () => {
    const response = await request(app)
      .post("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Visa anterior")
      .field("usuario_id", "abc")
      .attach("file", Buffer.from("pdf de prueba"), "visa-anterior.pdf");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "usuario_id debe ser numérico" });
    expect(mockUploadStoredFile).not.toHaveBeenCalled();
  });

  test("POST /documentos devuelve 500 si usuario_id no existe y la base de datos rechaza la referencia", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("INSERT INTO documentos") && values?.[3] === 999) {
        return Promise.reject(
          new Error('insert or update on table "documentos" violates foreign key constraint')
        );
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .post("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Visa anterior")
      .field("usuario_id", "999")
      .attach("file", Buffer.from("pdf de prueba"), "visa-anterior.pdf");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "No se pudo guardar el documento" });
    expect(mockDeleteStoredFile).toHaveBeenCalledWith("local/mock-document.pdf");
  });

  test("POST /documentos devuelve 500 ante error interno de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("INSERT INTO documentos")) {
        return Promise.reject(new Error("document insert failed"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .post("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("nombre", "Visa anterior")
      .field("usuario_id", "3")
      .attach("file", Buffer.from("pdf de prueba"), "visa-anterior.pdf");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "No se pudo guardar el documento" });
    expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);
    expect(mockDeleteStoredFile).toHaveBeenCalledWith("local/mock-document.pdf");
  });

  test("GET /documentos/:usuarioId lista documentos del usuario", async () => {
    const response = await request(app)
      .get("/documentos/3")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: 41,
      nombre: "Pasaporte",
      usuario_id: 3,
      documento_key: "passport",
    });
  });

  test("GET /documentos/:usuarioId presenta rechazos legados como correccion", async () => {
    mockQuery.mockImplementation((sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();

      if (
        normalized.includes("SELECT id, nombre, tipo, archivo_url, usuario_id, documento_key") &&
        normalized.includes("FROM documentos") &&
        normalized.includes("WHERE usuario_id = $1")
      ) {
        return Promise.resolve({
          rows: [
            {
              id: 41,
              nombre: "Pasaporte",
              tipo: "application/pdf",
              archivo_url: "http://localhost/local-files/mock-document.pdf",
              usuario_id: values[0],
              documento_key: "passport",
              estado: "rejected",
              feedback: null,
              creado_en: "2026-07-07T00:00:00.000Z",
              actualizado_en: "2026-07-07T00:00:00.000Z",
            },
          ],
        });
      }

      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .get("/documentos/3")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: 41,
      estado: "correction",
    });
  });

  test("GET /documentos/:id/archivo sirve PDF almacenado para vista previa inline", async () => {
    const response = await request(app)
      .get("/documentos/41/archivo")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("inline");
    expect(response.headers.link).toBe('</visaguide-favicon.svg>; rel="icon"; type="image/svg+xml"');
    expect(mockGetStoredFile).toHaveBeenCalledWith("local/mock-document.pdf");
  });

  test("GET /documentos/:id/archivo no redirige a la misma ruta frontend si falta storage_key", async () => {
    mockQuery.mockImplementation((sql, values) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();

      if (
        normalized.includes("FROM documentos") &&
        normalized.includes("WHERE id = $1") &&
        !normalized.includes("usuario_id")
      ) {
        return Promise.resolve({
          rows: [
            {
              id: values[0],
              nombre: "pasaporte.pdf",
              tipo: "application/pdf",
              archivo_url: `/documentos/${values[0]}/archivo`,
              storage_key: null,
            },
          ],
        });
      }

      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .get("/documentos/41/archivo")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "El archivo no está disponible para vista previa",
    });
    expect(mockGetStoredFile).not.toHaveBeenCalled();
  });

  test("GET /documentos/:usuarioId devuelve lista vacia cuando el usuario no tiene documentos", async () => {
    const response = await request(app)
      .get("/documentos/4")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("GET /documentos/:usuarioId devuelve lista vacia para usuario inexistente porque no valida usuario", async () => {
    const response = await request(app)
      .get("/documentos/999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("GET /documentos/:usuarioId devuelve 400 cuando el id no es numerico", async () => {
    const response = await request(app)
      .get("/documentos/abc")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "usuario_id debe ser numérico" });
  });

  test("GET /documentos/:usuarioId devuelve 500 ante error interno de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (
        String(sql).includes("SELECT id, nombre, tipo, archivo_url, usuario_id, documento_key") &&
        String(sql).includes("FROM documentos")
      ) {
        return Promise.reject(new Error("document list failed"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .get("/documentos/3")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "No se pudieron cargar los documentos" });
  });

  test("GET /admin/documents lista todos los documentos para administradores", async () => {
    const response = await request(app)
      .get("/admin/documents")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.documentos).toHaveLength(1);
    expect(response.body.documentos[0]).toMatchObject({
      id: 41,
      nombre: "Pasaporte",
      archivo_url: "/documentos/41/archivo",
      usuario: {
        nombre: "Usuario Login",
        correo: "login@example.com",
      },
    });
  });

  test("PUT /admin/documents/:id/status actualiza el estado del documento", async () => {
    const response = await request(app)
      .put("/admin/documents/41/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ estado: "approved" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Estado del documento actualizado correctamente");
    expect(response.body.documento).toMatchObject({
      id: 41,
      estado: "approved",
      archivo_url: "/documentos/41/archivo",
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [3, "Documento aprobado", "Tu Pasaporte fue aprobado.", "documento", "passport"]
    );
  });

  test("PUT /admin/documents/:id/status acepta status y notifica documento aprobado", async () => {
    const response = await request(app)
      .put("/admin/documents/41/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });

    expect(response.status).toBe(200);
    expect(response.body.documento).toMatchObject({
      id: 41,
      estado: "approved",
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [3, "Documento aprobado", "Tu Pasaporte fue aprobado.", "documento", "passport"]
    );
  });

  test("PUT /admin/documents/:id/status guarda rechazos como correccion para el cliente", async () => {
    const response = await request(app)
      .put("/admin/documents/41/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ estado: "rejected" });

    expect(response.status).toBe(200);
    expect(response.body.documento).toMatchObject({
      id: 41,
      estado: "correction",
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [3, "Documento requiere correcciones", "Tu Pasaporte requiere correcciones.", "documento", "passport"]
    );
  });

  test("PUT /admin/documents/:id/status guarda observaciones administrativas", async () => {
    const response = await request(app)
      .put("/admin/documents/41/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ feedback: "Documento ilegible. Vuelva a cargarlo." });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Observaciones del documento actualizadas correctamente");
    expect(response.body.documento).toMatchObject({
      id: 41,
      estado: "review",
      feedback: "Documento ilegible. Vuelva a cargarlo.",
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [
        3,
        "Nuevas observaciones en documento",
        "El administrador agrego observaciones a uno de tus documentos.",
        "documento",
        "passport",
      ]
    );
  });

  test("PUT /admin/documents/:id/status permite rechazar con observaciones", async () => {
    const response = await request(app)
      .put("/admin/documents/41/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        estado: "correction",
        feedback: "Falta la segunda pagina del pasaporte.",
      });

    expect(response.status).toBe(200);
    expect(response.body.documento).toMatchObject({
      id: 41,
      estado: "correction",
      feedback: "Falta la segunda pagina del pasaporte.",
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [
        3,
        "Documento requiere correcciones",
        "Tu Pasaporte requiere correcciones. Revisa las observaciones del administrador.",
        "documento",
        "passport",
      ]
    );
  });

  test("PUT /admin/documents/:id/status envia a correccion con status y notifica al usuario", async () => {
    const response = await request(app)
      .put("/admin/documents/41/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "correction" });

    expect(response.status).toBe(200);
    expect(response.body.documento).toMatchObject({
      id: 41,
      estado: "correction",
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [3, "Documento requiere correcciones", "Tu Pasaporte requiere correcciones.", "documento", "passport"]
    );
  });

  test("PUT /admin/documents/:id/status exige estado u observaciones", async () => {
    const response = await request(app)
      .put("/admin/documents/41/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Debe enviar estado u observaciones" });
  });

  test("PUT /admin/documents/:id/status rechaza estados invalidos", async () => {
    const response = await request(app)
      .put("/admin/documents/41/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ estado: "review" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Estado de documento invalido" });
  });

  test("DELETE /documentos elimina el registro y el archivo almacenado con IDs en body", async () => {
    const response = await request(app)
      .delete("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ documento_id: 41, usuario_id: 3 });

    expect(response.status).toBe(200);
    expect(mockDeleteStoredFile).toHaveBeenCalledWith("local/mock-document.pdf");
  });

  test("DELETE /documentos devuelve 404 cuando el documento no existe", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("DELETE FROM documentos")) {
        return Promise.resolve({ rows: [] });
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .delete("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ documento_id: 404, usuario_id: 3 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Documento no encontrado" });
    expect(mockDeleteStoredFile).not.toHaveBeenCalled();
  });

  test("DELETE /documentos devuelve 400 cuando el id no es numerico", async () => {
    const response = await request(app)
      .delete("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ documento_id: "abc", usuario_id: 3 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "documento_id debe ser numérico" });
    expect(mockDeleteStoredFile).not.toHaveBeenCalled();
  });

  test("DELETE /documentos devuelve 400 cuando usuario_id no es numerico", async () => {
    const response = await request(app)
      .delete("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ documento_id: 41, usuario_id: "abc" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "usuario_id requerido en el body y debe ser numérico" });
    expect(mockDeleteStoredFile).not.toHaveBeenCalled();
  });

  test("DELETE /documentos devuelve 500 ante error interno de base de datos", async () => {
    mockQuery.mockImplementation((sql, values) => {
      if (String(sql).includes("DELETE FROM documentos")) {
        return Promise.reject(new Error("document delete failed"));
      }
      return defaultQueryHandler(sql, values);
    });

    const response = await request(app)
      .delete("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ documento_id: 41, usuario_id: 3 });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "No se pudo eliminar el documento" });
  });

  test("DELETE /documentos mantiene respuesta exitosa si falla deleteStoredFile", async () => {
    mockDeleteStoredFile.mockRejectedValueOnce(new Error("delete storage failed"));

    const response = await request(app)
      .delete("/documentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ documento_id: 41, usuario_id: 3 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Documento eliminado correctamente" });
    expect(mockDeleteStoredFile).toHaveBeenCalledWith("local/mock-document.pdf");
  });

  test("PUT /usuario-perfil persiste la edición del perfil", async () => {
    const response = await request(app).put("/usuario-perfil").send({
      correo: "login@example.com",
      nombre: "Nombre Actualizado",
      telefono: "55550000",
      ciudad: "Guatemala",
      pais: "Guatemala",
    });

    expect(response.status).toBe(200);
    expect(response.body.usuario).toMatchObject({
      nombre: "Nombre Actualizado",
      telefono: "55550000",
      ciudad: "Guatemala",
      pais: "Guatemala",
    });
  });

  describe("flujo de integracion registro, login, DS-160 y documentos", () => {
    it("mantiene consistente el usuario entre autenticacion, formulario y documentos", async () => {
      const { state, queryHandler } = createIntegrationFlowQueryHandler();
      mockQuery.mockImplementation(queryHandler);

      const usuario = {
        nombre: "Usuario Integracion",
        correo: "integracion@example.com",
        contrasena: "clave-segura",
      };
      const datosDs160 = {
        personal: {
          nombreCompleto: usuario.nombre,
          correo: usuario.correo,
        },
        viaje: {
          proposito: "Turismo",
          ciudadDestino: "Miami",
        },
      };

      const registerResponse = await request(app).post("/register").send(usuario);

      expect(registerResponse.status).toBe(200);
      expect(registerResponse.body.message).toBe("Usuario guardado en BD");
      expect(registerResponse.body.data).toMatchObject({
        id_usuario: 90,
        nombre: usuario.nombre,
        correo: usuario.correo,
      });

      const userId = registerResponse.body.data.id_usuario;

      const loginResponse = await request(app).post("/login").send({
        correo: usuario.correo,
        contrasena: usuario.contrasena,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.message).toBe("Login exitoso");
      expect(loginResponse.body.usuario).toMatchObject({
        id_usuario: userId,
        correo: usuario.correo,
        rol: "cliente",
      });

      const saveDs160Response = await request(app)
        .post("/ds160")
        .set("Authorization", `Bearer ${registerResponse.body.token}`)
        .send({
          datos: datosDs160,
          seccion_actual: 3,
          completado: false,
        });

      expect(saveDs160Response.status).toBe(200);
      expect(saveDs160Response.body.message).toBe("Formulario guardado correctamente");
      expect(saveDs160Response.body.formulario).toMatchObject({
        id_usuario: userId,
        datos: datosDs160,
        seccion_actual: 3,
        completado: false,
      });

      const getDs160Response = await request(app)
        .post("/ds160/load")
        .set("Authorization", `Bearer ${registerResponse.body.token}`)
        .send({});

      expect(getDs160Response.status).toBe(200);
      expect(getDs160Response.body).toEqual({
        datos: datosDs160,
        seccion_actual: 3,
        completado: false,
      });

      const uploadResponse = await request(app)
        .post("/upload")
        .set("Authorization", `Bearer ${registerResponse.body.token}`)
        .field("nombre", "Pasaporte")
        .field("tipo", "application/pdf")
        .field("usuario_id", String(userId))
        .field("documento_key", "passport")
        .attach("file", Buffer.from("pdf de prueba"), "pasaporte.pdf");

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.message).toBe("Archivo subido correctamente");
      expect(uploadResponse.body.documento).toMatchObject({
        usuario_id: userId,
        documento_key: "passport",
        nombre: "Pasaporte",
        estado: "review",
      });
      expect(mockUploadStoredFile).toHaveBeenCalledTimes(1);

      const documentosResponse = await request(app)
        .get(`/documentos/${userId}`)
        .set("Authorization", `Bearer ${registerResponse.body.token}`);

      expect(documentosResponse.status).toBe(200);
      expect(documentosResponse.body).toHaveLength(1);
      expect(documentosResponse.body[0]).toMatchObject({
        id: uploadResponse.body.documento.id,
        usuario_id: userId,
        documento_key: "passport",
        archivo_url: "http://localhost/local-files/mock-document.pdf",
      });

      expect(state.user.id_usuario).toBe(userId);
      expect(state.ds160.id_usuario).toBe(userId);
      expect(state.documentos[0].usuario_id).toBe(userId);
    });
  });
});
