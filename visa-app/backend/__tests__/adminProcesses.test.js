const express = require("express");
const request = require("supertest");
const { createRoleMiddleware, issueSessionToken } = require("../auth");
const createAdminProcessRoutes = require("../routes/adminProcessRoutes");
const createNotificacionService = require("../services/notificacionService");

describe("admin process management", () => {
  const admin = { id_usuario: 1, correo: "admin@test.dev", rol: "admin" };
  const client = { id_usuario: 4, correo: "cliente@test.dev", rol: "cliente" };

  function createApp(query) {
    const pool = { query: jest.fn(query) };
    const app = express();
    app.use(express.json());
    app.use("/admin/processes", createAdminProcessRoutes(pool, {
      requireAdmin: createRoleMiddleware(pool, ["admin"]),
      schemaReady: Promise.resolve(),
      notificacionService: createNotificacionService(pool),
    }));
    return { app, pool };
  }

  test("rejects unauthenticated and client requests", async () => {
    const { app } = createApp(async () => ({ rows: [client] }));
    await request(app).get("/admin/processes").expect(401);
    await request(app)
      .get("/admin/processes")
      .set("Authorization", `Bearer ${issueSessionToken(client)}`)
      .expect(403);
  });

  test("returns real processes and advisors to an admin", async () => {
    const processRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      progreso: 17,
      siguiente_paso: "Completar formulario",
      mensaje: "",
      id_asesor: null,
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovación B1/B2",
    };
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("FROM tramite")) return { rows: [processRow] };
      if (sql.includes("WHERE rol = 'asesor'")) return { rows: [{ id: 5, nombre: "Laura Vásquez", correo: "laura@visaguide.com" }] };
      return { rows: [] };
    });

    const response = await request(app)
      .get("/admin/processes")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body.tramites[0]).toMatchObject({
      id: 21,
      etapaActual: "Formulario DS-160",
      solicitante: { nombre: "Carlos Mendoza", perfil: "Renovación B1/B2" },
      asesor: null,
    });
    expect(response.body.asesores).toHaveLength(1);
  });

  test("returns a consolidated request detail to an admin", async () => {
    const processRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      progreso: 17,
      siguiente_paso: "Completar formulario",
      mensaje: "",
      id_asesor: 5,
      created_at: "2026-08-01T10:00:00.000Z",
      updated_at: "2026-08-02T10:00:00.000Z",
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovacion B1/B2",
      solicitante_telefono: "+502 5555 5555",
      solicitante_ciudad: "Ciudad de Guatemala",
      solicitante_pais: "Guatemala",
      solicitante_created_at: "2026-07-20T10:00:00.000Z",
      asesor_nombre: "Laura Vasquez",
      asesor_correo: "laura@visaguide.com",
    };
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("WHERE t.id_tramite = $1")) return { rows: [processRow] };
      if (sql.includes("FROM formulario_ds160")) {
        return {
          rows: [{
            id_formulario: 31,
            datos: { nombres: "Carlos", apellidos: "Mendoza", numeroPasaporte: "A123456" },
            seccion_actual: 4,
            completado: false,
            estado_revision: "en_progreso",
            feedback_revision: null,
            updated_at: "2026-08-03T10:00:00.000Z",
          }],
        };
      }
      if (sql.includes("FROM documentos")) {
        return {
          rows: [{
            id: 41,
            nombre: "pasaporte.pdf",
            tipo: "application/pdf",
            archivo_url: "https://files.example/passport.pdf",
            documento_key: "passport",
            estado: "approved",
            feedback: "Correcto",
            storage_key: "local/passport.pdf",
            creado_en: "2026-08-02T10:00:00.000Z",
            actualizado_en: "2026-08-02T11:00:00.000Z",
          }],
        };
      }
      if (sql.includes("FROM interview_sessions")) {
        return {
          rows: [{
            id: 51,
            user_id: 8,
            user_name: "Carlos Mendoza",
            user_email: "carlos@example.com",
            status: "reviewed",
            responses: [{ id: "q1", text: "Motivo de viaje", recorded: true, audio: { key: "audio/q1.webm" } }],
            feedback: "Buena preparacion",
            rating: 4,
            created_at: "2026-08-04T10:00:00.000Z",
            reviewed_at: "2026-08-05T10:00:00.000Z",
          }],
        };
      }
      if (sql.includes("FROM notificaciones")) {
        return {
          rows: [{
            id: 61,
            titulo: "Documento aprobado",
            mensaje: "Tu documento fue aprobado.",
            tipo: "documento",
            leido: false,
            etapa_relacionada: "documento-41",
            created_at: "2026-08-06T10:00:00.000Z",
          }],
        };
      }
      return { rows: [] };
    });

    const response = await request(app)
      .get("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body.tramite).toMatchObject({
      id: 21,
      etapaActual: "Formulario DS-160",
      asesor: { id: 5, nombre: "Laura Vasquez" },
    });
    expect(response.body.solicitante).toMatchObject({
      id: 8,
      correo: "carlos@example.com",
      ciudad: "Ciudad de Guatemala",
    });
    expect(response.body.ds160).toMatchObject({
      id: 31,
      progreso: 40,
      resumen: expect.arrayContaining([
        { key: "nombres", label: "Nombres", value: "Carlos" },
        { key: "numeroPasaporte", label: "Pasaporte", value: "A123456" },
      ]),
    });
    expect(response.body.documentos[0]).toMatchObject({
      id: 41,
      archivo_url: "/documentos/41/archivo",
      feedback: "Correcto",
    });
    expect(response.body.entrevistas[0].responses[0].audio.url).toBe("/interview-sessions/51/audio/q1");
    expect(response.body.notificaciones[0]).toMatchObject({
      id: 61,
      leido: false,
      tipo: "documento",
    });
  });

  test("returns 404 when request detail does not exist", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("WHERE t.id_tramite = $1")) return { rows: [] };
      return { rows: [] };
    });

    const response = await request(app)
      .get("/admin/processes/999")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(404);

    expect(response.body).toEqual({ error: "TrÃ¡mite no encontrado" });
  });

  test("assigns an advisor and updates status and stage", async () => {
    const refreshedRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "Pendiente",
      etapa_actual: "Cita consular",
      progreso: 51,
      siguiente_paso: "Completar formulario",
      mensaje: "",
      id_asesor: 5,
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovación B1/B2",
      asesor_nombre: "Laura Vásquez",
      asesor_correo: "laura@visaguide.com",
    };
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario") && !sql.includes("rol = 'asesor'")) return { rows: [admin] };
      if (sql.includes("rol = 'asesor'")) return { rows: [{ id_usuario: 5 }] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("FROM tramite")) return { rows: [refreshedRow] };
      return { rows: [] };
    });

    const response = await request(app)
      .put("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "Pendiente", etapaActual: "Cita consular", asesorId: 5 })
      .expect(200);

    expect(response.body.tramite).toMatchObject({
      estado: "Pendiente",
      etapaActual: "Cita consular",
      progreso: 51,
      asesor: { id: 5, nombre: "Laura Vásquez" },
    });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE tramite"),
      ["Pendiente", "Cita consular", 51, 5, 21]
    );
  });

  test("records history when an admin changes process status", async () => {
    const currentRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      id_asesor: null,
    };
    const refreshedRow = {
      ...currentRow,
      estado: "Pendiente",
      progreso: 17,
      siguiente_paso: "Completar formulario",
      mensaje: "",
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovacion B1/B2",
    };
    const { app, pool } = createApp(async (sql, values = []) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("SELECT id_tramite, id_usuario, estado")) return { rows: [currentRow] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("JOIN usuario applicant")) return { rows: [refreshedRow] };
      if (sql.includes("INSERT INTO process_change_history")) {
        return { rows: [{ id: 1, process_id: values[0], field_name: values[1], old_value: values[2], new_value: values[3], changed_by: values[4], changed_at: "2026-08-10T10:00:00.000Z" }] };
      }
      return { rows: [] };
    });

    await request(app)
      .put("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "Pendiente", etapaActual: "Formulario DS-160", asesorId: null })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO process_change_history"),
      [21, "estado", "En proceso", "Pendiente", 1]
    );
  });

  test("records history when an admin changes process stage", async () => {
    const currentRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      id_asesor: null,
    };
    const refreshedRow = {
      ...currentRow,
      etapa_actual: "Cita consular",
      progreso: 51,
      siguiente_paso: "Programar cita",
      mensaje: "",
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovacion B1/B2",
    };
    const { app, pool } = createApp(async (sql, values = []) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("SELECT id_tramite, id_usuario, estado")) return { rows: [currentRow] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("JOIN usuario applicant")) return { rows: [refreshedRow] };
      if (sql.includes("SELECT id FROM notificaciones")) return { rows: [] };
      if (sql.includes("INSERT INTO process_change_history")) {
        return { rows: [{ id: 2, process_id: values[0], field_name: values[1], old_value: values[2], new_value: values[3], changed_by: values[4], changed_at: "2026-08-10T10:00:00.000Z" }] };
      }
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 91 }] };
      return { rows: [] };
    });

    await request(app)
      .put("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "En proceso", etapaActual: "Cita consular", asesorId: null })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO process_change_history"),
      [21, "etapa_actual", "Formulario DS-160", "Cita consular", 1]
    );
  });

  test("records history when an admin changes the assigned advisor", async () => {
    const currentRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      id_asesor: null,
    };
    const refreshedRow = {
      ...currentRow,
      id_asesor: 5,
      progreso: 17,
      siguiente_paso: "Completar formulario",
      mensaje: "",
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovacion B1/B2",
      asesor_nombre: "Laura Vasquez",
      asesor_correo: "laura@visaguide.com",
    };
    const { app, pool } = createApp(async (sql, values = []) => {
      if (sql.includes("FROM usuario WHERE id_usuario") && !sql.includes("rol = 'asesor'")) return { rows: [admin] };
      if (sql.includes("SELECT id_tramite, id_usuario, estado")) return { rows: [currentRow] };
      if (sql.includes("rol = 'asesor'")) return { rows: [{ id_usuario: 5 }] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("JOIN usuario applicant")) return { rows: [refreshedRow] };
      if (sql.includes("INSERT INTO process_change_history")) {
        return { rows: [{ id: 3, process_id: values[0], field_name: values[1], old_value: values[2], new_value: values[3], changed_by: values[4], changed_at: "2026-08-10T10:00:00.000Z" }] };
      }
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 92 }] };
      return { rows: [] };
    });

    await request(app)
      .put("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "En proceso", etapaActual: "Formulario DS-160", asesorId: 5 })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO process_change_history"),
      [21, "id_asesor", null, "5", 1]
    );
  });

  test("does not record duplicated history when values do not change", async () => {
    const currentRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      id_asesor: null,
    };
    const refreshedRow = {
      ...currentRow,
      progreso: 17,
      siguiente_paso: "Completar formulario",
      mensaje: "",
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovacion B1/B2",
    };
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("SELECT id_tramite, id_usuario, estado")) return { rows: [currentRow] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("JOIN usuario applicant")) return { rows: [refreshedRow] };
      return { rows: [] };
    });

    await request(app)
      .put("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "En proceso", etapaActual: "Formulario DS-160", asesorId: null })
      .expect(200);

    expect(pool.query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO process_change_history"),
      expect.anything()
    );
  });

  test("returns process history records to an admin", async () => {
    const { app } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("SELECT id_tramite") && sql.includes("FROM tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("FROM process_change_history h")) {
        return {
          rows: [{
            id: 7,
            process_id: 21,
            field_name: "estado",
            old_value: "En proceso",
            new_value: "Pendiente",
            changed_by: 1,
            changed_by_nombre: "Admin",
            changed_by_correo: "admin@test.dev",
            changed_at: "2026-08-10T10:00:00.000Z",
          }],
        };
      }
      return { rows: [] };
    });

    const response = await request(app)
      .get("/admin/processes/21/history")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .expect(200);

    expect(response.body.history).toEqual([{
      id: 7,
      processId: 21,
      fieldName: "estado",
      oldValue: "En proceso",
      newValue: "Pendiente",
      changedBy: { id: 1, nombre: "Admin", correo: "admin@test.dev" },
      changedAt: "2026-08-10T10:00:00.000Z",
    }]);
  });

  test("notifies the applicant when an admin changes process status", async () => {
    const currentRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      id_asesor: null,
    };
    const refreshedRow = {
      ...currentRow,
      estado: "Pendiente",
      progreso: 17,
      siguiente_paso: "Completar formulario",
      mensaje: "",
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovacion B1/B2",
    };
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("SELECT id_tramite, id_usuario, estado")) return { rows: [currentRow] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("JOIN usuario applicant")) return { rows: [refreshedRow] };
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 90 }] };
      return { rows: [] };
    });

    await request(app)
      .put("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "Pendiente", etapaActual: "Formulario DS-160", asesorId: null })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [
        8,
        "Estado de tramite actualizado",
        "Tu tramite cambio a Pendiente.",
        "info",
        "tramite-21-estado-Pendiente",
        "baja",
      ]
    );
  });

  test("notifies the applicant when an admin changes process stage without duplicating stage alerts", async () => {
    const currentRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      id_asesor: null,
    };
    const refreshedRow = {
      ...currentRow,
      etapa_actual: "Cita consular",
      progreso: 51,
      siguiente_paso: "Programar cita",
      mensaje: "",
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovacion B1/B2",
    };
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario")) return { rows: [admin] };
      if (sql.includes("SELECT id_tramite, id_usuario, estado")) return { rows: [currentRow] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("JOIN usuario applicant")) return { rows: [refreshedRow] };
      if (sql.includes("SELECT id FROM notificaciones")) return { rows: [] };
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 91 }] };
      return { rows: [] };
    });

    await request(app)
      .put("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "En proceso", etapaActual: "Cita consular", asesorId: null })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id FROM notificaciones"),
      [8, "Cita consular"]
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [
        8,
        "Nueva etapa: Cita consular",
        "Tu tramite avanzo a la etapa: Cita consular.",
        "etapa",
        "Cita consular",
        "baja",
      ]
    );
  });

  test("notifies the applicant when an advisor is assigned from process management", async () => {
    const currentRow = {
      id_tramite: 21,
      id_usuario: 8,
      estado: "En proceso",
      etapa_actual: "Formulario DS-160",
      id_asesor: null,
    };
    const refreshedRow = {
      ...currentRow,
      id_asesor: 5,
      progreso: 17,
      siguiente_paso: "Completar formulario",
      mensaje: "",
      solicitante_nombre: "Carlos Mendoza",
      solicitante_correo: "carlos@example.com",
      solicitante_perfil: "Renovacion B1/B2",
      asesor_nombre: "Laura Vasquez",
      asesor_correo: "laura@visaguide.com",
    };
    const { app, pool } = createApp(async (sql) => {
      if (sql.includes("FROM usuario WHERE id_usuario") && !sql.includes("rol = 'asesor'")) return { rows: [admin] };
      if (sql.includes("SELECT id_tramite, id_usuario, estado")) return { rows: [currentRow] };
      if (sql.includes("rol = 'asesor'")) return { rows: [{ id_usuario: 5 }] };
      if (sql.includes("UPDATE tramite")) return { rows: [{ id_tramite: 21 }] };
      if (sql.includes("JOIN usuario applicant")) return { rows: [refreshedRow] };
      if (sql.includes("INSERT INTO notificaciones")) return { rows: [{ id: 92 }] };
      return { rows: [] };
    });

    await request(app)
      .put("/admin/processes/21")
      .set("Authorization", `Bearer ${issueSessionToken(admin)}`)
      .send({ estado: "En proceso", etapaActual: "Formulario DS-160", asesorId: 5 })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notificaciones"),
      [
        8,
        "Asesor asignado",
        "Se te asigno un asesor para acompanar tu tramite.",
        "info",
        "tramite-21-asesor",
        "normal",
      ]
    );
  });
});
