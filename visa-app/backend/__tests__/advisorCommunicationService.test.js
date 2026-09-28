const createAdvisorCommunicationService = require("../services/advisorCommunicationService");

function createPool({ assigned = true, clientHasAdvisor = true } = {}) {
  let messageId = 1;
  return {
    query: jest.fn(async (sql, values = []) => {
      if (/CREATE (TABLE|INDEX)/.test(sql)) return { rows: [] };
      if (sql.includes("WHERE t.id_asesor = $1 AND t.id_usuario = $2")) {
        return { rows: assigned ? [{ id_tramite: 4, id_usuario: values[1], id_asesor: values[0], user_name: "Ana", advisor_name: "Laura" }] : [] };
      }
      if (sql.includes("WHERE t.id_usuario = $1") && sql.includes("LEFT JOIN usuario advisor")) {
        return { rows: [{ id_tramite: 4, id_usuario: values[0], id_asesor: clientHasAdvisor ? 9 : null, user_name: "Ana", advisor_name: clientHasAdvisor ? "Laura" : null }] };
      }
      if (sql.includes("INSERT INTO advisor_chat_messages")) {
        return { rows: [{ id: messageId++, advisor_id: values[0], user_id: values[1], sender_role: values[2], message: values[3], created_at: new Date("2026-09-27T12:00:00Z"), read_at: null }] };
      }
      if (sql.includes("INSERT INTO advisor_tasks")) {
        return { rows: [{ id: 8, advisor_id: values[0], user_id: values[1], title: values[2], due_at: values[3], priority: values[4], status: "pending", created_at: new Date(), updated_at: new Date() }] };
      }
      return { rows: [] };
    }),
  };
}

describe("advisorCommunicationService", () => {
  test("guarda mensajes del asesor únicamente para solicitudes asignadas", async () => {
    const pool = createPool();
    const service = createAdvisorCommunicationService(pool);

    const message = await service.sendMessage({ advisorId: 9, userId: 2, senderRole: "advisor", message: "  Revisa tu formulario.  " });

    expect(message).toMatchObject({ advisorId: 9, userId: 2, sender: "advisor", message: "Revisa tu formulario." });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO advisor_chat_messages"), [9, 2, "advisor", "Revisa tu formulario."]);
  });

  test("impide escribir a una solicitud no asignada", async () => {
    const service = createAdvisorCommunicationService(createPool({ assigned: false }));

    await expect(service.sendMessage({ advisorId: 9, userId: 3, senderRole: "advisor", message: "Hola" }))
      .rejects.toMatchObject({ statusCode: 404, message: "Solicitud no asignada a este asesor" });
  });

  test("impide al cliente enviar mensajes sin asesor", async () => {
    const service = createAdvisorCommunicationService(createPool({ clientHasAdvisor: false }));

    await expect(service.sendClientMessage(2, "Necesito ayuda"))
      .rejects.toMatchObject({ statusCode: 409, message: "Aún no tienes un asesor asignado" });
  });

  test("valida longitud y contenido del mensaje", async () => {
    const service = createAdvisorCommunicationService(createPool());

    await expect(service.sendMessage({ advisorId: 9, userId: 2, senderRole: "advisor", message: " " }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(service.sendMessage({ advisorId: 9, userId: 2, senderRole: "advisor", message: "x".repeat(4001) }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test("crea tareas asociadas únicamente a solicitantes asignados", async () => {
    const pool = createPool();
    const service = createAdvisorCommunicationService(pool);

    const task = await service.createTask(9, { title: " Revisar DS-160 ", userId: 2, priority: "high" });

    expect(task).toMatchObject({ id: 8, title: "Revisar DS-160", userId: 2, priority: "high", status: "pending" });
  });
});
