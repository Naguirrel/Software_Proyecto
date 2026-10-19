const fs = require("fs");
const path = require("path");
const createNotificacionService = require("../services/notificacionService");

const { VALID_NOTIFICATION_PRIORITIES } = createNotificacionService;

// SP10-16 / RF-16: las notificaciones tienen una prioridad ("baja" | "normal" | "alta").

function createService(extra = async () => ({ rows: [] })) {
  const pool = {
    query: jest.fn(async (sql, values) => {
      if (sql.includes("SELECT notificaciones_automaticas")) return { rows: [{ notificaciones_automaticas: true }] };
      if (sql.includes("INSERT INTO notificaciones")) {
        const row = { id: 1, id_usuario: values[0], titulo: values[1], mensaje: values[2], tipo: values[3] };
        return { rows: [row] };
      }
      return extra(sql, values);
    }),
  };
  return { service: createNotificacionService(pool), pool };
}

function insertCalls(pool) {
  return pool.query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO notificaciones"));
}

describe("prioridad de las notificaciones", () => {
  test("las prioridades válidas son baja, normal y alta", () => {
    expect([...VALID_NOTIFICATION_PRIORITIES].sort()).toEqual(["alta", "baja", "normal"]);
  });

  test("sin prioridad explícita se guarda como normal", async () => {
    const { service, pool } = createService();

    await service.crearNotificacion({ userId: 4, titulo: "Hola", mensaje: "Mensaje" });

    const [sql, values] = insertCalls(pool)[0];
    expect(sql).toContain("prioridad");
    expect(values.at(-1)).toBe("normal");
  });

  test.each(["baja", "normal", "alta"])("guarda la prioridad %s", async (prioridad) => {
    const { service, pool } = createService();

    await service.crearNotificacion({ userId: 4, titulo: "Hola", mensaje: "Mensaje", prioridad });

    expect(insertCalls(pool)[0][1].at(-1)).toBe(prioridad);
  });

  test.each(["urgente", "ALTA", "", null, 3, {}])("una prioridad inválida (%p) se guarda como normal", async (prioridad) => {
    const { service, pool } = createService();

    await service.crearNotificacion({ userId: 4, titulo: "Hola", mensaje: "Mensaje", prioridad });

    expect(insertCalls(pool)[0][1].at(-1)).toBe("normal");
  });

  test("también se guarda en las notificaciones con clave de deduplicación y se actualiza si cambia", async () => {
    const { service, pool } = createService();

    await service.crearNotificacion({
      userId: 9,
      titulo: "Tarea vencida",
      mensaje: "Revisar",
      tipo: "task",
      entityType: "advisor_task",
      entityId: 3,
      dedupeKey: "advisor:9:task:3:deadline",
      prioridad: "alta",
    });

    const [sql, values] = insertCalls(pool)[0];
    expect(sql).toContain("INSERT INTO notificaciones AS existing");
    expect(sql).toContain("prioridad = EXCLUDED.prioridad");
    expect(sql).toContain("existing.prioridad IS DISTINCT FROM EXCLUDED.prioridad");
    expect(values.at(-1)).toBe("alta");
    expect(values).toHaveLength(10);
  });

  test("la notificación creada devuelve su prioridad (SQL con RETURNING prioridad)", async () => {
    const { service, pool } = createService();

    await service.crearNotificacion({ userId: 4, titulo: "Hola", mensaje: "Mensaje", prioridad: "alta" });

    expect(insertCalls(pool)[0][0]).toMatch(/RETURNING[\s\S]*prioridad/);
  });

  test("el listado, marcar como leída y archivar incluyen la prioridad", async () => {
    const { service, pool } = createService(async () => ({ rows: [{ id: 1, id_usuario: 4 }] }));

    await service.listarPorUsuario(4);
    await service.marcarLeida(1, 4);
    await service.archivar(1, 4);

    const statements = pool.query.mock.calls.map(([sql]) => String(sql));
    const select = statements.find((sql) => sql.includes("FROM notificaciones") && sql.includes("ORDER BY"));
    const read = statements.find((sql) => sql.includes("SET leido = TRUE") && sql.includes("RETURNING"));
    const archive = statements.find((sql) => sql.includes("SET archivado = TRUE"));
    for (const sql of [select, read, archive]) expect(sql).toMatch(/prioridad/);
  });

  test("el esquema crea la columna con valor por defecto y restricción de valores", async () => {
    const { service, pool } = createService();

    await service.ensureSchema();

    const schema = pool.query.mock.calls.map(([sql]) => String(sql)).join("\n");
    expect(schema).toContain("prioridad VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta'))");
    expect(schema).toContain("ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'normal'");
    expect(schema).toContain("notificaciones_prioridad_check");
  });

  test("un cambio de etapa conserva la prioridad indicada y por defecto es normal", async () => {
    const { service, pool } = createService();

    await service.notificarCambioEtapa(4, "Cita consular", "Nueva etapa", "Avanzaste", "baja");
    await service.notificarCambioEtapa(4, "Entrevista", "Nueva etapa", "Avanzaste");

    expect(insertCalls(pool).map(([, values]) => values.at(-1))).toEqual(["baja", "normal"]);
  });

  test("al notificar al asesor de un cliente se conserva la prioridad", async () => {
    const { service, pool } = createService(async (sql) => (
      String(sql).includes("FROM tramite t") ? { rows: [{ id_tramite: 1, id_asesor: 9, client_name: "Ana" }] } : { rows: [] }
    ));

    await service.notificarAsesorDeCliente(4, { titulo: "Aviso", mensaje: "{clientName} hizo algo", tipo: "chat", prioridad: "alta" });

    expect(insertCalls(pool)[0][1].at(-1)).toBe("alta");
  });

  test("un recordatorio de tarea vencida es de prioridad alta y uno próximo a vencer, normal", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60 * 60_000).toISOString();
    const { service, pool } = createService(async (sql) => (
      String(sql).includes("FROM advisor_tasks task")
        ? { rows: [{ id: 1, title: "Vencida", due_at: past }, { id: 2, title: "Pronto", due_at: future }] }
        : { rows: [] }
    ));

    await service.ensureAdvisorTaskReminders(9);

    expect(insertCalls(pool).map(([, values]) => [values[1], values.at(-1)])).toEqual([
      ["Tarea vencida", "alta"],
      ["Tarea próxima a vencer", "normal"],
    ]);
  });
});

describe("esquema SQL de la prioridad", () => {
  const root = path.join(__dirname, "..", "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

  test("init.sql, la migración 004 y el servicio usan la misma restricción", () => {
    expect(read("init.sql")).toContain("prioridad VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta'))");
    const migration = read("backend", "migrations", "004_notification_priority.sql");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'normal'");
    expect(migration).toContain("CHECK (prioridad IN ('baja', 'normal', 'alta'))");
    expect(migration).toContain("notificaciones_prioridad_check");
  });

  test("la migración se puede ejecutar más de una vez y va dentro de una transacción", () => {
    const migration = read("backend", "migrations", "004_notification_priority.sql").trim();
    expect(migration.startsWith("BEGIN;")).toBe(true);
    expect(migration.endsWith("COMMIT;")).toBe(true);
    expect(migration).toContain("IF NOT EXISTS");
  });
});
