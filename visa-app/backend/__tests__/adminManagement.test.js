const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const { createRoleMiddleware, issueSessionToken } = require("../auth");
const createAdminManagementRoutes = require("../routes/adminManagementRoutes");
const createNotificacionService = require("../services/notificacionService");

describe("admin management integration", () => {
  const admin = { id_usuario: 1, correo: "admin@test.dev", nombre: "Admin", rol: "admin" };
  const client = { id_usuario: 4, correo: "client@test.dev", nombre: "Cliente", rol: "cliente" };

  function createApp(query, overrides = {}) {
    const pool = { query: jest.fn(query) };
    const app = express();
    app.use(express.json());
    app.use("/admin", createAdminManagementRoutes(pool, {
      requireAdmin: createRoleMiddleware(pool, ["admin"]),
      schemaReady: Promise.resolve(),
      notificacionService: createNotificacionService(pool),
      ...overrides,
    }));
    return { app, pool };
  }

  test("protects every management endpoint with the verified database role", async () => {
    const { app } = createApp(async () => ({ rows: [client] }));
    await request(app).get("/admin/users").expect(401);
    await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${issueSessionToken(client)}`)
      .expect(403);
  });

  test("returns paginated activity logs to an admin", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("FROM activity_logs")) {
        return {
          rows: [{
            id: 12,
            user_id: 4,
            admin_id: null,
            user_email: "client@test.dev",
            role: "cliente",
            action: "user.login",
            entity_type: "usuario",
            entity_id: "4",
            description: "Login exitoso",
            metadata: {},
            ip_address: "127.0.0.1",
            user_agent: "supertest",
            created_at: "2026-09-01T10:00:00.000Z",
            total: "1",
          }],
        };
      }
      return { rows: [] };
    });

    const response = await request(app)
      .get("/admin/activity-logs?action=login&limit=25")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body).toMatchObject({
      page: 1,
      limit: 25,
      total: 1,
      logs: [{ action: "user.login", userEmail: "client@test.dev" }],
    });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM activity_logs"),
      expect.arrayContaining(["%login%", 25, 0])
    );
  });

  test("runs email reminders and records an activity log", async () => {
    const candidate = {
      user_id: 4,
      recipient_email: "client@test.dev",
      reminder_type: "pending_document",
      entity_type: "documento",
      entity_id: "41",
      subject: "Recordatorio",
      body: "Contenido",
      metadata: {},
    };
    const emailReminderService = {
      listReminderCandidates: jest.fn(async () => [candidate, { ...candidate, entity_id: "42" }]),
      sendReminder: jest.fn()
        .mockResolvedValueOnce({ status: "dry_run" })
        .mockResolvedValueOnce({ status: "skipped", reason: "duplicate" }),
    };
    const activityLogService = {
      listLogs: jest.fn(),
      logActivity: jest.fn(async () => null),
    };
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      return { rows: [] };
    }, { emailReminderService, activityLogService });

    const response = await request(app)
      .post("/admin/email-reminders/run")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body).toMatchObject({
      encontrados: 2,
      enviados: 0,
      dryRun: 1,
      omitidosDuplicado: 1,
      errores: 0,
    });
    expect(emailReminderService.sendReminder).toHaveBeenCalledTimes(2);
    expect(activityLogService.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: "email_reminders.run",
      metadata: expect.objectContaining({ encontrados: 2, dryRun: 1, omitidosDuplicado: 1 }),
    }));
  });

  test("returns dashboard metrics, workload, activity and attention from database queries", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("solicitudes_activas")) return { rows: [{ solicitudes_activas: "4", sin_asignar: "2", asesores_activos: "3", ds160_pendientes: "1", documentos_pendientes: "5", entrevistas_pendientes: "2", usuarios_nuevos_30d: "7", solicitudes_completadas: "8", progreso_promedio: "64.4", solicitudes_total: "10" }] };
      if (sql.includes("GROUP BY u.id_usuario")) return { rows: [{ id: 7, nombre: "Laura", asignados: "5", pendientes: "2" }] };
      if (sql.includes("FROM admin_activity")) return { rows: [{ id: "admin-9", accion: "Solicitud asignada", detalle: "Trámite 4", actor: "Admin", tipo: "administracion", destino: "/admin/users", created_at: new Date().toISOString() }] };
      if (sql.includes("FROM tramite t JOIN usuario applicant")) return { rows: [{ id: 4, nombre: "Solicitante", correo: "s@test.dev", perfil: "turismo", asesor: null }] };
      return { rows: [] };
    });

    const response = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body.resumen).toEqual({ solicitudesActivas: 4, sinAsignar: 2, asesoresActivos: 3, ds160Pendientes: 1, documentosPendientes: 5, entrevistasPendientes: 2, usuariosNuevos30d: 7, solicitudesCompletadas: 8, progresoPromedio: 64, tasaCompletitud: 80 });
    expect(response.body.cargaAsesores[0]).toMatchObject({ nombre: "Laura", asignados: 5, pendientes: 2 });
    expect(response.body.actividad).toHaveLength(1);
    expect(response.body.actividad[0]).toMatchObject({ tipo: "administracion", actor: "Admin" });
    expect(response.body.pendientes).toEqual([
      { id: "asignaciones", label: "Solicitudes sin asignar", total: 2, destino: "/admin/assignments" },
      { id: "ds160", label: "DS-160 por revisar", total: 1, destino: "/admin/ds160" },
      { id: "documentos", label: "Documentos por revisar", total: 5, destino: "/admin/documents" },
      { id: "entrevistas", label: "Entrevistas pendientes", total: 2, destino: "/admin/interviews" },
    ]);
    expect(response.body.atencion).toHaveLength(1);
  });

  test("returns a client's detail with their process summary", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("FROM usuario u") && sql.includes("WHERE u.id_usuario = $1")) {
        return { rows: [{ ...client, asignados: "0", pendientes: "0", asesor_nombre: null, last_activity: new Date().toISOString() }] };
      }
      if (sql.includes("FROM tramite t LEFT JOIN usuario advisor")) {
        return { rows: [{ id: 22, estado: "Pendiente", etapa_actual: "Documentos", progreso: 40, created_at: new Date().toISOString(), asesor_id: null, asesor_nombre: null }] };
      }
      return { rows: [] };
    });

    const response = await request(app)
      .get("/admin/users/4")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body.usuario).toMatchObject({ id: 4, rol: "cliente" });
    expect(response.body.tramite).toMatchObject({ id: 22, estado: "Pendiente", progreso: 40 });
  });

  test("returns 404 when the requested user does not exist", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("FROM usuario u") && sql.includes("WHERE u.id_usuario = $1")) return { rows: [] };
      return { rows: [] };
    });

    await request(app)
      .get("/admin/users/999")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(404);
  });

  test("hashes the password when an admin creates a user", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("INSERT INTO usuario")) return { rows: [{ ...client, id_usuario: 20 }] };
      return { rows: [] };
    });

    await request(app)
      .post("/admin/users")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ nombre: "Nuevo Cliente", correo: "nuevo@test.dev", contrasena: "clave123", rol: "cliente" })
      .expect(201);

    const insertCall = pool.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO usuario"));
    const storedPassword = insertCall[1][2];
    expect(storedPassword).not.toBe("clave123");
    expect(storedPassword).toMatch(/^\$2[aby]\$/);
    expect(bcrypt.compareSync("clave123", storedPassword)).toBe(true);
  });

  test("hashes the password when an admin creates an advisor", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("INSERT INTO usuario")) return { rows: [{ ...client, id_usuario: 21, rol: "asesor" }] };
      return { rows: [] };
    });

    await request(app)
      .post("/admin/advisors")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ nombre: "Nuevo Asesor", correo: "asesor@test.dev", contrasena: "clave123" })
      .expect(201);

    const insertCall = pool.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO usuario"));
    const storedPassword = insertCall[1][2];
    expect(storedPassword).not.toBe("clave123");
    expect(storedPassword).toMatch(/^\$2[aby]\$/);
  });

  test("updates a user's editable profile fields", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("UPDATE usuario SET")) return { rows: [{ ...client, nombre: "Cliente Editado", correo: "nuevo@test.dev" }] };
      return { rows: [] };
    });

    const response = await request(app)
      .patch("/admin/users/4")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ nombre: "Cliente Editado", correo: "nuevo@test.dev", telefono: "12345678", ciudad: "Ciudad", pais: "Guatemala" })
      .expect(200);

    expect(response.body.usuario).toMatchObject({ nombre: "Cliente Editado", correo: "nuevo@test.dev" });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE usuario SET"),
      ["Cliente Editado", "nuevo@test.dev", "12345678", "Ciudad", "Guatemala", null, null, null, null, 4]
    );
  });

  test("rejects an invalid role on user edit", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      return { rows: [] };
    });

    await request(app)
      .patch("/admin/users/4")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ rol: "superadmin" })
      .expect(400);
  });

  test("blocks an admin from deactivating their own account", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      return { rows: [] };
    });

    const response = await request(app)
      .patch("/admin/users/1")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ activo: false })
      .expect(400);

    expect(response.body.error).toBe("No puedes desactivar tu propia cuenta");
  });

  test("blocks an admin from changing their own role", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      return { rows: [] };
    });

    const response = await request(app)
      .patch("/admin/users/1")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ rol: "cliente" })
      .expect(400);

    expect(response.body.error).toBe("No puedes cambiar tu propio rol");
  });

  test("blocks changing an advisor's role away from asesor while cases are assigned", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("SELECT rol FROM usuario WHERE id_usuario")) return { rows: [{ rol: "asesor" }] };
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("SELECT COUNT(*) FROM tramite WHERE id_asesor")) return { rows: [{ count: "2" }] };
      return { rows: [] };
    });

    const response = await request(app)
      .patch("/admin/users/7")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ rol: "cliente" })
      .expect(409);

    expect(response.body.error).toBe("No puedes cambiar el rol: el asesor tiene trámites asignados");
    expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE usuario SET"), expect.anything());
  });

  test("allows changing an advisor's role away from asesor once they have no assigned cases", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("SELECT rol FROM usuario WHERE id_usuario")) return { rows: [{ rol: "asesor" }] };
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("SELECT COUNT(*) FROM tramite WHERE id_asesor")) return { rows: [{ count: "0" }] };
      if (sql.includes("UPDATE usuario SET")) return { rows: [{ id_usuario: 7, correo: "asesor@test.dev", rol: "cliente" }] };
      return { rows: [] };
    });

    await request(app)
      .patch("/admin/users/7")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ rol: "cliente" })
      .expect(200);
  });

  test("assigns an unassigned real process to an active advisor", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario") && !sql.includes("rol = 'asesor'")) return { rows: [admin] };
      if (sql.includes("rol = 'asesor' AND activo")) return { rows: [{ id_usuario: 7, nombre: "Laura" }] };
      if (sql.includes("SELECT id_tramite, id_usuario, id_asesor FROM tramite")) return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: null }] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: 7 }] };
      return { rows: [] };
    });

    await request(app)
      .post("/admin/assignments")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ tramiteId: 22, asesorId: 7 })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE tramite SET id_asesor"),
      [7, 22]
    );
  });

  test("notifies the applicant when an assignment is created", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario") && !sql.includes("rol = 'asesor'")) return { rows: [admin] };
      if (sql.includes("rol = 'asesor' AND activo")) return { rows: [{ id_usuario: 7, nombre: "Laura" }] };
      if (sql.includes("SELECT id_tramite, id_usuario, id_asesor FROM tramite")) return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: null }] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: 7 }] };
      if (sql.includes("INSERT INTO admin_activity")) return { rows: [{ id: 12 }] };
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 93 }] };
      return { rows: [] };
    });

    await request(app)
      .post("/admin/assignments")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ tramiteId: 22, asesorId: 7 })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [
        4,
        "Asesor asignado",
        "Se te asigno un asesor para acompanar tu tramite.",
        "info",
        "tramite-22-asesor",
      ]
    );
  });

  test("records process history when an assignment is created", async () => {
    const { app, pool } = createApp(async (sql, values = []) => {
      if (sql.includes("FROM usuario WHERE id_usuario") && !sql.includes("rol = 'asesor'")) return { rows: [admin] };
      if (sql.includes("rol = 'asesor' AND activo")) return { rows: [{ id_usuario: 7, nombre: "Laura" }] };
      if (sql.includes("SELECT id_tramite, id_usuario, id_asesor FROM tramite")) return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: null }] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 22, id_usuario: 4, id_asesor: 7 }] };
      if (sql.includes("INSERT INTO process_change_history")) {
        return { rows: [{ id: 1, process_id: values[0], field_name: values[1], old_value: values[2], new_value: values[3], changed_by: values[4], changed_at: "2026-08-10T10:00:00.000Z" }] };
      }
      return { rows: [] };
    });

    await request(app)
      .post("/admin/assignments")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ tramiteId: 22, asesorId: 7 })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO process_change_history"),
      [22, "id_asesor", null, "7", 1]
    );
  });

  test("persists DS-160 review state and feedback", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("UPDATE formulario_ds160")) return { rows: [{ id_formulario: 31 }] };
      return { rows: [] };
    });

    await request(app)
      .put("/admin/ds160/31")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "correccion", feedback: "Completa el historial." })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE formulario_ds160"),
      ["correccion", "Completa el historial.", 31]
    );
  });

  test("stores and returns global settings without seeded business records", async () => {
    const settings = { id: 1, nombre_comercial: "VisaGuide", razon_social: "Agencia", sitio_web: "https://visaguide.test", idioma: "es", zona_horaria: "America/Guatemala" };
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("INSERT INTO admin_settings")) return { rows: [settings] };
      return { rows: [] };
    });

    const response = await request(app)
      .put("/admin/settings")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send(settings)
      .expect(200);

    expect(response.body.configuracion).toMatchObject(settings);
  });

  test("saves the automatic notifications toggle with the rest of the settings", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("INSERT INTO admin_settings")) return { rows: [{ id: 1, notificaciones_automaticas: false }] };
      return { rows: [] };
    });

    await request(app)
      .put("/admin/settings")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ nombre_comercial: "VisaGuide", notificaciones_automaticas: false })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO admin_settings"),
      ["VisaGuide", "", "", "es", "America/Guatemala", false]
    );
  });

  test("lists the lock status of users blocked by failed logins", async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("FROM usuario u")) {
        return { rows: [
          { ...client, bloqueado_hasta: lockedUntil },
          { ...client, id_usuario: 5, correo: "otro@test.dev", bloqueado_hasta: new Date(Date.now() - 60 * 1000) },
        ] };
      }
      return { rows: [] };
    });

    const response = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body.usuarios[0]).toMatchObject({ bloqueado: true, bloqueadoHasta: lockedUntil.toISOString() });
    expect(response.body.usuarios[1]).toMatchObject({ bloqueado: false, bloqueadoHasta: null });
  });

  test("lets an admin unlock an account blocked by failed logins", async () => {
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("UPDATE usuario SET bloqueado_hasta = NULL")) return { rows: [{ ...client, bloqueado_hasta: null }] };
      return { rows: [] };
    });

    const response = await request(app)
      .post("/admin/users/4/unlock")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body.usuario).toMatchObject({ id: 4, bloqueado: false });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE usuario SET bloqueado_hasta = NULL"), [4]);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO admin_activity"),
      [1, "Cuenta desbloqueada", "client@test.dev"]
    );
  });

  test("validates the user when unlocking an account", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      return { rows: [] };
    });
    const auth = `Bearer ${issueSessionToken(admin)}`;

    await request(app).post("/admin/users/abc/unlock").set("Authorization", auth).expect(400);
    await request(app).post("/admin/users/999/unlock").set("Authorization", auth).expect(404);
  });

  test("only admins can unlock accounts", async () => {
    const { app } = createApp(async () => ({ rows: [client] }));
    await request(app).post("/admin/users/4/unlock").expect(401);
    await request(app)
      .post("/admin/users/4/unlock")
      .set("Authorization", `Bearer ${issueSessionToken(client)}`)
      .expect(403);
  });
});
