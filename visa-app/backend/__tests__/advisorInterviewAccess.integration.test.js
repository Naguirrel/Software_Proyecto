const express = require("express");
const request = require("supertest");
const fakeStorage = require("../test-utils/fakeStorage");
const createInterviewSessionRoutes = require("../routes/interviewSessionRoutes");
const { createRoleMiddleware, createSessionMiddleware, issueSessionToken } = require("../auth");

jest.mock("../storage", () => require("../test-utils/fakeStorage"));

// SP10-07: un asesor solo ve las sesiones de entrevista (y su audio) de los clientes que tiene asignados.

const normalize = (sql) => String(sql).replace(/\s+/g, " ").trim();

function createFixture() {
  const users = [];
  const tramites = [];
  const sessions = [];

  async function query(sql, values = []) {
    const text = normalize(sql);

    if (text.startsWith("CREATE TABLE")) return { rows: [] };

    if (text.includes("FROM usuario WHERE id_usuario = $1")) {
      const user = users.find((row) => row.id_usuario === values[0]);
      return { rows: user ? [{ ...user }] : [] };
    }

    if (text.startsWith("SELECT 1 FROM tramite WHERE id_usuario = $1 AND id_asesor = $2")) {
      const assigned = tramites.some((row) => row.id_usuario === values[0] && row.id_asesor === values[1]);
      return { rows: assigned ? [{ "?column?": 1 }] : [] };
    }

    if (text.includes("FROM interview_sessions WHERE user_id = $1")) {
      return { rows: sessions.filter((row) => row.user_id === values[0]).map((row) => ({ ...row })) };
    }

    if (text.includes("FROM interview_sessions s WHERE s.id = $1") && text.includes("s.responses")) {
      const advisorId = values[1];
      const session = sessions.find((row) => row.id === values[0]);
      const assigned = session && tramites.some((row) => row.id_usuario === session.user_id && row.id_asesor === advisorId);
      return { rows: assigned ? [{ id: session.id, responses: session.responses }] : [] };
    }

    if (text.startsWith("SELECT id, responses FROM interview_sessions WHERE id = $1")) {
      const session = sessions.find((row) => row.id === values[0] && (!text.includes("AND user_id = $2") || row.user_id === values[1]));
      return { rows: session ? [{ id: session.id, responses: session.responses }] : [] };
    }

    if (text.includes("FROM interview_sessions s WHERE s.id = $1")) {
      const hasAdvisor = text.includes("t.id_asesor");
      const hasUser = text.includes("s.user_id = $");
      const advisorId = hasAdvisor ? values[1] : null;
      const userId = hasUser ? values[hasAdvisor ? 2 : 1] : null;
      const session = sessions.find((row) => row.id === values[0]
        && (!hasAdvisor || tramites.some((t) => t.id_usuario === row.user_id && t.id_asesor === advisorId))
        && (!hasUser || row.user_id === userId));
      return { rows: session ? [{ ...session }] : [] };
    }

    throw new Error(`Consulta no soportada por la prueba: ${text}`);
  }

  function addUser({ id, rol = "cliente", nombre }) {
    const user = { id_usuario: id, nombre: nombre || `Usuario ${id}`, correo: `u${id}@example.com`, perfil: null, rol, activo: true, email_verificado: true };
    users.push(user);
    return { user, token: issueSessionToken(user) };
  }

  function addSession({ id, userId }) {
    const key = `fake/audio-${id}.webm`;
    fakeStorage.files.set(key, Buffer.from(`audio-${id}`));
    sessions.push({
      id,
      user_id: userId,
      user_name: `Usuario ${userId}`,
      user_email: `u${userId}@example.com`,
      status: "pending",
      responses: [{ id: "purpose", text: "Motivo", recorded: true, audio: { key, mimetype: "audio/webm", size: 10 } }],
      feedback: null,
      rating: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      reviewed_at: null,
    });
  }

  function assignAdvisor(userId, advisorId) {
    const existing = tramites.find((row) => row.id_usuario === userId);
    if (existing) existing.id_asesor = advisorId;
    else tramites.push({ id_usuario: userId, id_asesor: advisorId });
  }

  const pool = { query: jest.fn(query) };
  const app = express();
  app.use(express.json());
  app.use("/interview-sessions", createInterviewSessionRoutes(pool, {
    requireSession: createSessionMiddleware(pool),
    requireAdmin: createRoleMiddleware(pool, ["admin"]),
  }));
  return { app, addUser, addSession, assignAdvisor };
}

describe("integración: acceso del asesor a las entrevistas", () => {
  let ctx;
  let ana;
  let luis;
  let advisorOfAna;
  let otherAdvisor;
  let admin;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.SESSION_SECRET;
    jest.spyOn(console, "error").mockImplementation(() => {});
    fakeStorage.reset();
    ctx = createFixture();
    ana = ctx.addUser({ id: 1, nombre: "Ana" });
    luis = ctx.addUser({ id: 2, nombre: "Luis" });
    advisorOfAna = ctx.addUser({ id: 5, rol: "asesor" });
    otherAdvisor = ctx.addUser({ id: 6, rol: "asesor" });
    admin = ctx.addUser({ id: 9, rol: "admin" });
    ctx.assignAdvisor(1, 5);
    ctx.assignAdvisor(2, 6);
    ctx.addSession({ id: 10, userId: 1 });
    ctx.addSession({ id: 20, userId: 2 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const get = (path, token) => request(ctx.app).get(path).set("Authorization", `Bearer ${token}`);
  const post = (path, token, body) => request(ctx.app).post(path).set("Authorization", `Bearer ${token}`).send(body);

  test("el asesor ve las sesiones de su cliente asignado", async () => {
    const byParam = await get("/interview-sessions/user/1", advisorOfAna.token);
    const byBody = await post("/interview-sessions/user", advisorOfAna.token, { userId: 1 });

    expect(byParam.status).toBe(200);
    expect(byParam.body.sessions.map((session) => session.id)).toEqual([10]);
    expect(byBody.status).toBe(200);
    expect(byBody.body.sessions.map((session) => session.id)).toEqual([10]);
  });

  test("el asesor no puede listar las sesiones de un cliente que no tiene asignado", async () => {
    const byParam = await get("/interview-sessions/user/2", advisorOfAna.token);
    const byBody = await post("/interview-sessions/user", advisorOfAna.token, { userId: 2 });

    expect(byParam.status).toBe(403);
    expect(byBody.status).toBe(403);
    expect(JSON.stringify(byParam.body)).not.toContain("Usuario 2");
  });

  test("el asesor abre el detalle de la sesión de su cliente pero no la de uno ajeno", async () => {
    const own = await get("/interview-sessions/10", advisorOfAna.token);
    const foreign = await get("/interview-sessions/20", advisorOfAna.token);
    const foreignByBody = await post("/interview-sessions/detail", advisorOfAna.token, { sessionId: 20 });

    expect(own.status).toBe(200);
    expect(own.body.session.id).toBe(10);
    expect(foreign.status).toBe(404);
    expect(foreignByBody.status).toBe(404);
  });

  test("el asesor escucha el audio de la sesión de su cliente pero no el de uno ajeno", async () => {
    const own = await get("/interview-sessions/10/audio/purpose", advisorOfAna.token);
    const foreign = await get("/interview-sessions/20/audio/purpose", advisorOfAna.token);

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(404);
  });

  test("al reasignar al cliente el asesor anterior pierde el acceso y el nuevo lo obtiene", async () => {
    ctx.assignAdvisor(1, 6);

    expect((await get("/interview-sessions/10", advisorOfAna.token)).status).toBe(404);
    expect((await get("/interview-sessions/user/1", advisorOfAna.token)).status).toBe(403);
    expect((await get("/interview-sessions/10", otherAdvisor.token)).status).toBe(200);
    expect((await get("/interview-sessions/10/audio/purpose", otherAdvisor.token)).status).toBe(200);
  });

  test("el administrador sigue viendo las sesiones y el audio de cualquier cliente", async () => {
    expect((await get("/interview-sessions/user/2", admin.token)).status).toBe(200);
    expect((await get("/interview-sessions/20", admin.token)).status).toBe(200);
    expect((await get("/interview-sessions/20/audio/purpose", admin.token)).status).toBe(200);
  });

  test("el cliente sigue viendo solo sus propias sesiones", async () => {
    const own = await get("/interview-sessions/10", ana.token);
    const foreign = await get("/interview-sessions/20", ana.token);
    const foreignAudio = await get("/interview-sessions/20/audio/purpose", ana.token);
    const listed = await get("/interview-sessions/user/2", ana.token);

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(404);
    expect(foreignAudio.status).toBe(404);
    expect(listed.body.sessions.map((session) => session.id)).toEqual([10]);
    expect(luis.user.id_usuario).toBe(2);
  });

  test("sin sesión no se accede a las entrevistas", async () => {
    const response = await request(ctx.app).get("/interview-sessions/10");

    expect(response.status).toBe(401);
  });
});
