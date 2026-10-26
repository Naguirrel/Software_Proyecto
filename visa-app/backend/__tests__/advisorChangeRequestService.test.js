const { createAdvisorChangeRequestService } = require("../services/advisorChangeRequestService");

function requestRow(overrides = {}) {
  return {
    id: 44,
    user_id: 7,
    applicant_name: "Ana López",
    applicant_email: "ana@example.com",
    current_advisor_id: 9,
    current_advisor_name: "Laura Asesora",
    current_advisor_email: "laura@example.com",
    category: "poor_communication",
    message: "No he recibido respuesta durante varios días.",
    status: "pending",
    created_at: new Date("2026-10-24T10:00:00Z"),
    updated_at: new Date("2026-10-24T10:00:00Z"),
    ...overrides,
  };
}

function transactionalPool(queryImplementation) {
  const client = {
    query: jest.fn(queryImplementation),
    release: jest.fn(),
  };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, client };
}

describe("advisorChangeRequestService", () => {
  test("rechaza explicaciones insuficientes antes de abrir una transacción", async () => {
    const pool = { connect: jest.fn() };
    const service = createAdvisorChangeRequestService(pool);

    await expect(service.createRequest(7, { category: "other", message: "Muy corto" }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("crea una única solicitud pendiente para el asesor asignado", async () => {
    const { pool, client } = transactionalPool(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM tramite") && normalized.includes("FOR UPDATE")) {
        return { rows: [{ id_tramite: 12, id_asesor: 9 }] };
      }
      if (normalized.startsWith("SELECT id FROM advisor_change_requests")) return { rows: [] };
      if (normalized.startsWith("INSERT INTO advisor_change_requests")) return { rows: [{ id: 44 }] };
      if (normalized.includes("FROM advisor_change_requests request")) return { rows: [requestRow()] };
      return { rows: [] };
    });
    const service = createAdvisorChangeRequestService(pool);

    const created = await service.createRequest(7, {
      category: "poor_communication",
      message: "No he recibido respuesta durante varios días.",
    });

    expect(created).toMatchObject({ id: 44, userId: 7, status: "pending" });
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  test("aprueba y reasigna atómicamente respetando disponibilidad y capacidad", async () => {
    const statements = [];
    const resolvedRow = requestRow({
      status: "approved",
      resolution: "Se verificó la situación y se aprobó el cambio.",
      reviewed_by: 1,
      reviewer_name: "Administración",
      new_advisor_id: 10,
      new_advisor_name: "Carlos Asesor",
      new_advisor_email: "carlos@example.com",
    });
    const { pool, client } = transactionalPool(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      statements.push(normalized);
      if (normalized.startsWith("SELECT * FROM advisor_change_requests")) return { rows: [requestRow()] };
      if (normalized.includes("FROM tramite") && normalized.includes("FOR UPDATE")) {
        return { rows: [{ id_tramite: 12, id_usuario: 7, id_asesor: 9 }] };
      }
      if (normalized.includes("FROM usuario") && normalized.includes("rol = 'asesor'")) {
        return { rows: [{ id_usuario: 10, nombre: "Carlos", activo: true, disponible_asesor: true, capacidad: 2 }] };
      }
      if (normalized.startsWith("SELECT COUNT(*)")) return { rows: [{ total: 1 }] };
      if (normalized.includes("FROM advisor_change_requests request")) return { rows: [resolvedRow] };
      return { rows: [] };
    });
    const service = createAdvisorChangeRequestService(pool);

    const resolved = await service.resolveRequest(44, 1, {
      decision: "approved",
      resolution: "Se verificó la situación y se aprobó el cambio.",
      newAdvisorId: 10,
    });

    expect(resolved).toMatchObject({ status: "approved", newAdvisor: { id: 10 } });
    expect(statements.some((sql) => sql.startsWith("UPDATE tramite SET id_asesor"))).toBe(true);
    expect(statements.some((sql) => sql.startsWith("INSERT INTO process_change_history"))).toBe(true);
    expect(statements.at(-1)).toBe("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  test("revierte si la asignación cambió mientras la solicitud estaba pendiente", async () => {
    const { pool, client } = transactionalPool(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT * FROM advisor_change_requests")) return { rows: [requestRow()] };
      if (normalized.includes("FROM tramite") && normalized.includes("FOR UPDATE")) {
        return { rows: [{ id_tramite: 12, id_usuario: 7, id_asesor: 11 }] };
      }
      return { rows: [] };
    });
    const service = createAdvisorChangeRequestService(pool);

    await expect(service.resolveRequest(44, 1, {
      decision: "approved",
      resolution: "Se verificó la solicitud administrativa.",
      newAdvisorId: 10,
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE tramite"), expect.anything());
  });
});
