const express = require("express");
const request = require("supertest");
const createAdvisorRoutes = require("../routes/advisorRoutes");
const createChatRoutes = require("../routes/chatRoutes");

function createPool() {
  const state = { messages: [], tasks: [] };
  return {
    state,
    query: jest.fn(async (sql, values = []) => {
      if (/CREATE (TABLE|INDEX)/.test(sql)) return { rows: [] };
      if (sql.includes("INSERT INTO advisor_chat_messages")) {
        const isClient = sql.includes("'client', $2");
        const row = {
          id: state.messages.length + 1,
          advisor_id: isClient ? 9 : values[0],
          user_id: isClient ? values[0] : values[1],
          sender_role: isClient ? "client" : values[2],
          message: isClient ? values[1] : values[3],
          created_at: new Date().toISOString(),
          read_at: null,
        };
        state.messages.push(row);
        return { rows: [row] };
      }
      if (sql.includes("WHERE t.id_asesor = $1 AND t.id_usuario = $2")) {
        return { rows: [{ id_tramite: 4, id_usuario: values[1], id_asesor: values[0], user_name: "Ana", advisor_name: "Laura", perfil: "Turismo", estado: "En proceso", etapa_actual: "Formulario DS-160" }] };
      }
      if (sql.includes("WHERE t.id_usuario = $1") && sql.includes("LEFT JOIN usuario advisor")) {
        return { rows: [{ id_tramite: 4, id_usuario: values[0], id_asesor: 9, user_name: "Ana", advisor_name: "Laura", perfil: "Turismo", estado: "En proceso", etapa_actual: "Formulario DS-160" }] };
      }
      if (sql.includes("UPDATE advisor_chat_messages SET read_at")) return { rows: [] };
      if (sql.includes("SELECT id, advisor_id, user_id, sender_role, message")) {
        const cursor = values.length === 4 ? values[2] : null;
        const limit = values.at(-1);
        let rows = state.messages.filter((row) => row.advisor_id === values[0] && row.user_id === values[1]);
        if (sql.includes("id > $3")) rows = rows.filter((row) => row.id > cursor).sort((a, b) => a.id - b.id);
        else {
          if (sql.includes("id < $3")) rows = rows.filter((row) => row.id < cursor);
          rows = rows.sort((a, b) => b.id - a.id);
        }
        return { rows: rows.slice(0, limit) };
      }
      if (sql.includes("INSERT INTO advisor_tasks")) {
        const row = { id: state.tasks.length + 1, advisor_id: values[0], user_id: values[1], title: values[2], due_at: values[3], priority: values[4], status: "pending", applicant_name: values[1] ? "Ana" : null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        state.tasks.push(row);
        return { rows: [row] };
      }
      if (sql.includes("UPDATE advisor_tasks")) {
        const task = state.tasks[0];
        task.status = values[0];
        task.updated_at = new Date().toISOString();
        return { rows: [{ ...task, applicant_name: "Ana" }] };
      }
      if (sql.includes("FROM advisor_tasks task")) return { rows: state.tasks };
      if (sql.includes("DELETE FROM advisor_tasks")) {
        const index = state.tasks.findIndex((task) => task.id === values[0] && task.advisor_id === values[1]);
        if (index < 0) return { rows: [] };
        const [removed] = state.tasks.splice(index, 1);
        return { rows: [{ id: removed.id }] };
      }
      return { rows: [] };
    }),
  };
}

function buildApps() {
  const pool = createPool();
  const requireSession = (req, _res, next) => {
    req.auth = { id_usuario: 5, rol: "cliente" };
    next();
  };
  const requireAdvisor = (req, _res, next) => {
    req.auth = { id_usuario: 9, rol: "asesor" };
    next();
  };
  const clientApp = express();
  clientApp.use(express.json());
  clientApp.use("/chat", createChatRoutes(pool, { requireSession }));
  const advisorApp = express();
  advisorApp.use(express.json());
  advisorApp.use("/advisor", createAdvisorRoutes(pool, {
    requireAdvisor,
    activityLogService: { ensureSchema: jest.fn(async () => undefined), logActivity: jest.fn(async () => null) },
  }));
  return { clientApp, advisorApp, pool };
}

describe("chat y tareas del asesor", () => {
  test("transporta mensajes en ambas direcciones y permite consultas incrementales", async () => {
    const { clientApp, advisorApp } = buildApps();

    await request(clientApp).post("/chat/messages").send({ message: "Necesito ayuda" }).expect(201);
    const advisorInbox = await request(advisorApp).get("/advisor/conversations/5/messages?limit=50").expect(200);
    expect(advisorInbox.body.messages).toEqual([expect.objectContaining({ sender: "client", message: "Necesito ayuda" })]);

    await request(advisorApp).post("/advisor/conversations/5/messages").send({ message: "Claro, revisemos tu caso" }).expect(201);
    const clientUpdate = await request(clientApp).get("/chat?afterId=1&limit=50").expect(200);
    expect(clientUpdate.body.messages).toEqual([expect.objectContaining({ sender: "advisor", message: "Claro, revisemos tu caso" })]);
  });

  test("crea, completa y elimina una tarea conservando el solicitante", async () => {
    const { advisorApp } = buildApps();
    const created = await request(advisorApp).post("/advisor/tasks").send({
      title: "Revisar documentos",
      userId: 5,
      dueAt: "2026-10-06T15:00:00.000Z",
      priority: "high",
    }).expect(201);
    expect(created.body.task).toMatchObject({ applicantName: "Ana", priority: "high", status: "pending" });

    const completed = await request(advisorApp).put(`/advisor/tasks/${created.body.task.id}`).send({ status: "completed" }).expect(200);
    expect(completed.body.task).toMatchObject({ applicantName: "Ana", status: "completed" });

    await request(advisorApp).delete(`/advisor/tasks/${created.body.task.id}`).expect(200);
  });
});
