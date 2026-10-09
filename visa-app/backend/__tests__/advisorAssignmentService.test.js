const createAdvisorAssignmentService = require("../services/advisorAssignmentService");

function createTransactionalPool(handler) {
  const client = {
    query: jest.fn(async (sql, values = []) => {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) return { rows: [] };
      return handler(sql, values);
    }),
    release: jest.fn(),
  };
  return { pool: { connect: jest.fn(async () => client) }, client };
}

function successfulAssignmentHandler(sql, values) {
  if (sql.includes("SELECT id_tramite, id_usuario, id_asesor FROM tramite")) {
    return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: null }] };
  }
  if (sql.includes("FROM usuario") && sql.includes("rol = 'asesor'")) {
    return { rows: [{ id_usuario: 7, nombre: "Laura", activo: true, disponible_asesor: true, capacidad: 5 }] };
  }
  if (sql.includes("COUNT(*)::int AS asignados")) return { rows: [{ asignados: 2 }] };
  if (sql.includes("UPDATE tramite SET id_asesor")) {
    return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: values[0] }] };
  }
  if (sql.includes("INSERT INTO process_change_history")) return { rows: [{ id: 1 }] };
  return { rows: [] };
}

describe("advisorAssignmentService", () => {
  test("confirma la asignación y su historial en una sola transacción", async () => {
    const { pool, client } = createTransactionalPool(successfulAssignmentHandler);
    const result = await createAdvisorAssignmentService(pool).assignUnassigned({
      processId: 22,
      advisorId: 7,
      changedBy: 1,
    });

    expect(result.process).toMatchObject({ id_tramite: 22, id_asesor: 7 });
    expect(client.query.mock.calls[0][0]).toBe("BEGIN");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("FOR UPDATE"), [22]);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.query).not.toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("rechaza asesores pausados sin modificar el trámite", async () => {
    const { pool, client } = createTransactionalPool((sql, values) => {
      if (sql.includes("SELECT id_tramite, id_usuario, id_asesor FROM tramite")) {
        return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: null }] };
      }
      if (sql.includes("FROM usuario") && sql.includes("rol = 'asesor'")) {
        return { rows: [{ id_usuario: values[0], activo: true, disponible_asesor: false, capacidad: 5 }] };
      }
      return { rows: [] };
    });

    await expect(createAdvisorAssignmentService(pool).assignUnassigned({
      processId: 22,
      advisorId: 7,
      changedBy: 1,
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE tramite SET id_asesor"), expect.anything());
  });

  test("rechaza asesores que alcanzaron su capacidad", async () => {
    const { pool, client } = createTransactionalPool((sql) => {
      if (sql.includes("SELECT id_tramite, id_usuario, id_asesor FROM tramite")) {
        return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: null }] };
      }
      if (sql.includes("FROM usuario") && sql.includes("rol = 'asesor'")) {
        return { rows: [{ id_usuario: 7, activo: true, disponible_asesor: true, capacidad: 2 }] };
      }
      if (sql.includes("COUNT(*)::int AS asignados")) return { rows: [{ asignados: 2 }] };
      return { rows: [] };
    });

    await expect(createAdvisorAssignmentService(pool).assignUnassigned({
      processId: 22,
      advisorId: 7,
      changedBy: 1,
    })).rejects.toMatchObject({ statusCode: 409, message: "El asesor alcanzó su capacidad máxima" });

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  test("revierte toda la asignación cuando falla el registro de historial", async () => {
    const { pool, client } = createTransactionalPool(async (sql, values) => {
      if (sql.includes("INSERT INTO process_change_history")) throw new Error("history unavailable");
      return successfulAssignmentHandler(sql, values);
    });

    await expect(createAdvisorAssignmentService(pool).assignUnassigned({
      processId: 22,
      advisorId: 7,
      changedBy: 1,
    })).rejects.toThrow("history unavailable");

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith("COMMIT");
  });
});
