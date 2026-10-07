const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const bcrypt = require("bcrypt");
const request = require("supertest");
const { issueSessionToken, verifySessionToken } = require("../auth");
const { createPostgresTask5Harness } = require("../test-utils/postgresTask5Harness");

// Only the external R2 adapter is replaced. HTTP routes, SQL and local storage remain real.
jest.mock("../r2", () => ({
  validateR2Config: () => { throw new Error("R2 disabled for PostgreSQL tests"); },
  uploadBufferToR2: jest.fn(() => { throw new Error("R2 must not be used in tests"); }),
  deleteObjectFromR2: jest.fn(() => { throw new Error("R2 must not be used in tests"); }),
  getObjectFromR2: jest.fn(() => { throw new Error("R2 must not be used in tests"); }),
}));

const PDF_BYTES = Buffer.from("%PDF-1.4\nVisaGuide test document\n%%EOF\n");
const AUDIO_BYTES = Buffer.from("webm test audio bytes");
const TEST_PASSWORD = `T5a-${crypto.randomBytes(12).toString("hex")}`;

function binaryParser(response, callback) {
  const chunks = [];
  response.on("data", (chunk) => chunks.push(chunk));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("Tarea 5: HTTP y PostgreSQL 15 real", () => {
  let ctx;
  let consoleError;

  beforeAll(async () => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    ctx = await createPostgresTask5Harness();
  }, 30000);

  afterAll(async () => {
    try {
      if (ctx) await ctx.close();
    } finally {
      consoleError?.mockRestore();
    }
  }, 30000);

  async function registerUser() {
    const correo = ctx.email();
    const response = await request(ctx.app).post("/register").send({
      nombre: "Usuario Tarea 5",
      correo,
      contrasena: TEST_PASSWORD,
    });
    expect(response.status).toBe(200);
    return { correo, response, id: response.body.data.id_usuario, token: response.body.token };
  }

  test("INT-001: registro persiste hash, trámite, token y estado; duplicado responde 409", async () => {
    const user = await registerUser();
    const result = await ctx.pool.query(
      "SELECT id_usuario, correo, contrasena, rol, email_verificado FROM usuario WHERE id_usuario = $1",
      [user.id]
    );
    const row = result.rows[0];
    expect(row.correo).toBe(user.correo);
    expect(row.rol).toBe("cliente");
    expect(row.email_verificado).toBe(false);
    expect(row.contrasena === TEST_PASSWORD).toBe(false);
    expect(await bcrypt.compare(TEST_PASSWORD, row.contrasena)).toBe(true);
    expect((await ctx.pool.query("SELECT id_tramite FROM tramite WHERE id_usuario = $1", [user.id])).rows).toHaveLength(1);

    const segments = user.token.split(".");
    expect(segments.length).toBe(2);
    const claims = verifySessionToken(user.token);
    expect(claims?.sub).toBe(user.id);
    expect(claims?.rol).toBe("cliente");
    expect(claims?.exp > Date.now()).toBe(true);
    const session = await request(ctx.app).get("/validar-sesion").set("Authorization", `Bearer ${user.token}`);
    expect(session.status).toBe(200);

    const duplicate = await request(ctx.app).post("/register").send({
      nombre: "Duplicado",
      correo: user.correo,
      contrasena: TEST_PASSWORD,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("El correo ya está registrado");
    expect(Object.hasOwn(duplicate.body, "token")).toBe(false);
    expect((await ctx.pool.query("SELECT id_usuario FROM usuario WHERE correo = $1", [user.correo])).rows).toHaveLength(1);
  });

  test("INT-002: documento persiste metadatos y archivo local recuperable; sin Bearer responde 401", async () => {
    const user = await registerUser();
    const unauthenticated = await request(ctx.app).post("/documentos")
      .field("nombre", "prueba.pdf")
      .attach("file", PDF_BYTES, { filename: "prueba.pdf", contentType: "application/pdf" });
    expect(unauthenticated.status).toBe(401);

    const created = await request(ctx.app).post("/documentos")
      .set("Authorization", `Bearer ${user.token}`)
      .field("nombre", "prueba.pdf")
      .field("documento_key", "task5-document")
      .attach("file", PDF_BYTES, { filename: "prueba.pdf", contentType: "application/pdf" });
    expect(created.status).toBe(201);
    const documentId = created.body.documento.id;
    const dbDocument = await ctx.pool.query(
      "SELECT usuario_id, nombre, estado, documento_key, storage_key FROM documentos WHERE id = $1",
      [documentId]
    );
    expect(dbDocument.rows[0]).toMatchObject({
      usuario_id: user.id, nombre: "prueba.pdf", estado: "review", documento_key: "task5-document",
    });
    expect(dbDocument.rows[0].storage_key.startsWith("local/")).toBe(true);
    const stored = await fs.readFile(path.join(ctx.uploadDir, path.basename(dbDocument.rows[0].storage_key)));
    expect(stored.equals(PDF_BYTES)).toBe(true);

    const file = await request(ctx.app).get(`/documentos/${documentId}/archivo`)
      .set("Authorization", `Bearer ${user.token}`).buffer(true).parse(binaryParser);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("application/pdf");
    expect(file.body.equals(PDF_BYTES)).toBe(true);
    expect((await request(ctx.app).get(`/documentos/${documentId}/archivo`)).status).toBe(401);
  });

  test("INT-003: sesión y respuestas JSONB persisten; audio local se recupera sin proveedor", async () => {
    const user = await registerUser();
    const payload = {
      user: { id: user.id, nombre: "Usuario Tarea 5", correo: user.correo },
      questions: [{ id: "q1", text: "¿Motivo de viaje?", recorded: true, duration: 4 }],
    };
    const created = await request(ctx.app).post("/interview-sessions")
      .field("session", JSON.stringify(payload))
      .attach("audio_q1", AUDIO_BYTES, { filename: "q1.webm", contentType: "audio/webm" });
    expect(created.status).toBe(201);
    const sessionId = created.body.session.id;
    const persisted = await ctx.pool.query(
      "SELECT user_id, status, responses, pg_typeof(responses)::text AS response_type FROM interview_sessions WHERE id = $1",
      [sessionId]
    );
    expect(persisted.rows[0].user_id).toBe(user.id);
    expect(persisted.rows[0].status).toBe("pending");
    expect(persisted.rows[0].response_type).toBe("jsonb");
    expect(persisted.rows[0].responses[0].id).toBe("q1");
    expect(persisted.rows[0].responses[0].audio.key.startsWith("local/")).toBe(true);

    // These endpoints are public in the current backend contract.
    const fetched = await request(ctx.app).get(`/interview-sessions/${sessionId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.session.responses[0].audio.url).toBe(`/interview-sessions/${sessionId}/audio/q1`);
    const audio = await request(ctx.app).get(`/interview-sessions/${sessionId}/audio/q1`)
      .buffer(true).parse(binaryParser);
    expect(audio.status).toBe(200);
    expect(audio.body.equals(AUDIO_BYTES)).toBe(true);
  });

  test("REG-001: bcrypt permite la clave correcta y rechaza clave incorrecta, vacía y variaciones", async () => {
    const user = await registerUser();
    const login = (contrasena) => request(ctx.app).post("/login").send({ correo: user.correo, contrasena });
    const valid = await login(TEST_PASSWORD);
    expect(valid.status).toBe(200);
    expect(verifySessionToken(valid.body.token)?.sub).toBe(user.id);
    for (const candidate of ["incorrecta", "", TEST_PASSWORD.toLowerCase(), `${TEST_PASSWORD} `]) {
      const invalid = await login(candidate);
      expect(invalid.status).toBe(401);
      expect(Object.hasOwn(invalid.body, "token")).toBe(false);
    }
  });

  test("REG-002: admin accede, cliente recibe 403, sin token 401 y degradación revoca acceso", async () => {
    const client = await registerUser();
    const adminEmail = ctx.email();
    const adminRow = await ctx.pool.query(
      "INSERT INTO usuario(nombre, correo, contrasena, rol, email_verificado) VALUES($1,$2,$3,'admin',TRUE) RETURNING id_usuario, correo, rol",
      ["Admin Tarea 5", adminEmail, await bcrypt.hash(TEST_PASSWORD, 10)]
    );
    const admin = adminRow.rows[0];
    const adminToken = issueSessionToken(admin);
    const endpoint = "/admin/metrics/overview";

    expect((await request(ctx.app).get(endpoint)).status).toBe(401);
    expect((await request(ctx.app).get(endpoint).set("Authorization", `Bearer ${client.token}`)).status).toBe(403);
    const allowed = await request(ctx.app).get(endpoint).set("Authorization", `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(typeof allowed.body.usuarios_total).toBe("number");

    await ctx.pool.query("UPDATE usuario SET rol = 'cliente' WHERE id_usuario = $1", [admin.id_usuario]);
    expect((await request(ctx.app).get(endpoint).set("Authorization", `Bearer ${adminToken}`)).status).toBe(403);
  });

  test("REG-003: verificación inválida falla y token capturado cambia BD y sesión a verificado", async () => {
    const user = await registerUser();
    expect(user.response.body.data.emailVerificado).toBe(false);
    const before = await request(ctx.app).get("/validar-sesion").set("Authorization", `Bearer ${user.token}`);
    expect(before.status).toBe(200);
    expect(before.body.user.emailVerificado).toBe(false);
    expect((await request(ctx.app).post("/verificar-email").send({ token: "invalido" })).status).toBe(400);

    const message = ctx.mailbox.find((item) => item.to === user.correo);
    const token = message?.text.match(/\/verificar-email\?token=([a-f0-9]{64})/)?.[1];
    if (!token) throw new Error("No verification token was captured; valid-token case cannot be skipped");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await ctx.pool.query(
      "SELECT id_usuario, used_at FROM email_verifications WHERE token_hash = $1", [tokenHash]
    );
    expect(record.rows[0]?.id_usuario).toBe(user.id);
    expect(record.rows[0]?.used_at).toBeNull();

    const verified = await request(ctx.app).post("/verificar-email").send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.usuario.emailVerificado).toBe(true);
    const userRow = await ctx.pool.query("SELECT email_verificado FROM usuario WHERE id_usuario = $1", [user.id]);
    expect(userRow.rows[0].email_verificado).toBe(true);
    const after = await request(ctx.app).get("/validar-sesion").set("Authorization", `Bearer ${user.token}`);
    expect(after.status).toBe(200);
    expect(after.body.user.emailVerificado).toBe(true);
    expect((await request(ctx.app).post("/verificar-email").send({ token })).status).toBe(400);
  });
});
