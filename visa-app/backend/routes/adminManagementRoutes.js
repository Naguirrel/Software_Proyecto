const express = require("express");
const bcrypt = require("bcrypt");
const createProcessChangeHistoryService = require("../services/processChangeHistoryService");
const { parseAdminSearch, buildDashboardCohort } = require("../services/adminSearchFilter");
const createActivityLogService = require("../services/activityLogService");
const createEmailReminderService = require("../services/emailReminderService");

const SALT_ROUNDS = 10;
const VALID_ROLES = new Set(["cliente", "asesor", "admin"]);
const VALID_DS160_STATES = new Set(["en_progreso", "por_revisar", "correccion", "aprobado"]);

function number(value) { return Number(value) || 0; }
function activeLockUntil(row) {
  if (!row.bloqueado_hasta) return null;
  const lockedUntil = new Date(row.bloqueado_hasta);
  return lockedUntil > new Date() ? lockedUntil.toISOString() : null;
}
function presentUser(row) {
  const bloqueadoHasta = activeLockUntil(row);
  return {
    id: row.id_usuario,
    nombre: row.nombre,
    correo: row.correo,
    rol: row.rol,
    perfil: row.perfil || null,
    activo: row.activo !== false,
    bloqueado: Boolean(bloqueadoHasta),
    bloqueadoHasta,
    telefono: row.telefono || "",
    ciudad: row.ciudad || "",
    pais: row.pais || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    capacidad: number(row.capacidad_asesor) || 50,
    disponible: row.disponible_asesor !== false,
    asignados: number(row.asignados),
    pendientes: number(row.pendientes),
    asesor: row.asesor_nombre || null,
    asesorId: row.asesor_id || null,
    actividad: row.last_activity || row.updated_at || null,
  };
}

module.exports = function createAdminManagementRoutes(pool, { requireAdmin, schemaReady, notificacionService, activityLogService, emailReminderService }) {
  const router = express.Router();
  const processHistoryService = createProcessChangeHistoryService(pool);
  const activeActivityLogService = activityLogService || createActivityLogService(pool);
  const activeEmailReminderService = emailReminderService || createEmailReminderService(pool);
  router.use(requireAdmin);

  async function logActivity(actorId, action, detail = "") {
    try {
      await pool.query(
        "INSERT INTO admin_activity (actor_id, accion, detalle) VALUES ($1, $2, $3)",
        [actorId, action, detail]
      );
    } catch (error) {
      console.error("ERROR ADMIN ACTIVITY:", error);
    }
  }

  router.get("/activity-logs", async (req, res) => {
    try {
      const result = await activeActivityLogService.listLogs({
        page: req.query.page,
        limit: req.query.limit,
        userId: req.query.userId,
        action: req.query.action,
        role: req.query.role,
        from: req.query.from,
        to: req.query.to,
      });
      return res.json(result);
    } catch (error) {
      console.error("ERROR ADMIN ACTIVITY LOGS:", error);
      return res.status(500).json({ error: "No fue posible cargar los logs de actividad" });
    }
  });

  router.post("/email-reminders/run", async (req, res) => {
    const summary = {
      encontrados: 0,
      enviados: 0,
      dryRun: 0,
      omitidosDuplicado: 0,
      errores: 0,
      detalles: [],
    };

    try {
      const candidates = await activeEmailReminderService.listReminderCandidates();
      summary.encontrados = candidates.length;

      for (const candidate of candidates) {
        try {
          const result = await activeEmailReminderService.sendReminder(candidate);
          if (result.status === "sent") summary.enviados += 1;
          if (result.status === "dry_run") summary.dryRun += 1;
          if (result.status === "skipped" && result.reason === "duplicate") summary.omitidosDuplicado += 1;
          if (result.status === "failed") summary.errores += 1;
          summary.detalles.push({
            reminderType: candidate.reminder_type,
            entityType: candidate.entity_type,
            entityId: candidate.entity_id,
            recipientEmail: candidate.recipient_email,
            status: result.status,
            reason: result.reason || "",
            error: result.error || "",
          });
        } catch (error) {
          summary.errores += 1;
          summary.detalles.push({
            reminderType: candidate.reminder_type,
            entityType: candidate.entity_type,
            entityId: candidate.entity_id,
            recipientEmail: candidate.recipient_email,
            status: "failed",
            error: error.message || "No fue posible ejecutar el recordatorio",
          });
        }
      }

      await activeActivityLogService.logActivity({
        req,
        actor: req.auth,
        adminId: req.auth?.id_usuario,
        userEmail: req.auth?.correo,
        role: req.auth?.rol || "admin",
        action: "email_reminders.run",
        entityType: "email_reminders",
        description: "Ejecución de recordatorios por email",
        metadata: {
          encontrados: summary.encontrados,
          enviados: summary.enviados,
          dryRun: summary.dryRun,
          omitidosDuplicado: summary.omitidosDuplicado,
          errores: summary.errores,
        },
      });

      return res.json(summary);
    } catch (error) {
      console.error("ERROR RUN EMAIL REMINDERS:", error);
      return res.status(500).json({ error: "No fue posible ejecutar los recordatorios por email" });
    }
  });

  router.get("/dashboard", async (req, res) => {
    try {
      const filter = parseAdminSearch(req.query);
      const cohort = filter.active ? buildDashboardCohort(filter) : null;
      const query = (sql) => cohort ? pool.query(`${cohort.cte} ${sql}`, cohort.values) : pool.query(sql);
      await schemaReady;
      const [summary, workload, activity, attention] = await Promise.all([
        query(`SELECT
          (SELECT COUNT(*) FROM tramite WHERE estado NOT IN ('Completado', 'Aprobado')) AS solicitudes_activas,
          (SELECT COUNT(*) FROM tramite WHERE id_asesor IS NULL) AS sin_asignar,
          (SELECT COUNT(*) FROM usuario WHERE rol = 'asesor' AND activo = TRUE) AS asesores_activos,
          (SELECT COUNT(*) FROM formulario_ds160 WHERE estado_revision IN ('en_progreso', 'por_revisar')) AS ds160_pendientes,
          (SELECT COUNT(*) FROM documentos WHERE estado IN ('pending', 'review')) AS documentos_pendientes,
          (SELECT COUNT(*) FROM interview_sessions WHERE status = 'pending') AS entrevistas_pendientes,
          (SELECT COUNT(*) FROM usuario WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS usuarios_nuevos_30d,
          (SELECT COUNT(*) FROM tramite WHERE estado IN ('Completado', 'Aprobado') OR progreso >= 100) AS solicitudes_completadas,
          (SELECT COALESCE(AVG(progreso), 0) FROM tramite) AS progreso_promedio,
          (SELECT COUNT(*) FROM tramite) AS solicitudes_total`),
        query(`SELECT u.id_usuario AS id, u.nombre,
          COUNT(t.id_tramite) AS asignados,
          COUNT(t.id_tramite) FILTER (WHERE t.estado IN ('Pendiente','En proceso')) AS pendientes
          FROM usuario u LEFT JOIN tramite t ON t.id_asesor = u.id_usuario
          WHERE u.rol = 'asesor' AND u.activo = TRUE
          GROUP BY u.id_usuario, u.nombre ORDER BY asignados DESC, u.nombre LIMIT 4`),
        query(`SELECT actividad.id, actividad.accion, actividad.detalle,
            actividad.created_at, actividad.actor, actividad.tipo, actividad.destino
          FROM (
            SELECT CONCAT('admin-', a.id) AS id, a.accion, a.detalle, a.created_at,
              u.nombre AS actor, 'administracion' AS tipo, '/admin/users' AS destino
            FROM admin_activity a LEFT JOIN usuario u ON u.id_usuario = a.actor_id
            UNION ALL
            SELECT CONCAT('usuario-', u.id_usuario), 'Nuevo usuario registrado',
              u.correo, u.created_at, u.nombre, 'usuario', CONCAT('/admin/users/', u.id_usuario)
            FROM usuario u
            UNION ALL
            SELECT CONCAT('documento-', d.id), 'Documento recibido', d.nombre,
              d.creado_en, u.nombre, 'documento', '/admin/documents'
            FROM documentos d JOIN usuario u ON u.id_usuario = d.usuario_id
            UNION ALL
            SELECT CONCAT('entrevista-', i.id), 'Entrevista registrada',
              COALESCE(i.user_email, ''), i.created_at, i.user_name, 'entrevista', '/admin/interviews'
            FROM interview_sessions i
          ) actividad
          ORDER BY actividad.created_at DESC LIMIT 10`),
        query(`SELECT t.id_tramite AS id, t.estado, t.etapa_actual,
          applicant.nombre, applicant.correo, applicant.perfil,
          advisor.nombre AS asesor
          FROM tramite t JOIN usuario applicant ON applicant.id_usuario = t.id_usuario
          LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
          WHERE t.id_asesor IS NULL OR t.estado = 'Pendiente'
          ORDER BY t.id_asesor NULLS FIRST, t.id_tramite DESC LIMIT 8`),
      ]);
      const row = summary.rows[0] || {};
      const total = number(row.solicitudes_total);
      const completed = number(row.solicitudes_completadas);
      res.json({
        resumen: {
          solicitudesActivas: number(row.solicitudes_activas),
          sinAsignar: number(row.sin_asignar),
          asesoresActivos: number(row.asesores_activos),
          ds160Pendientes: number(row.ds160_pendientes),
          documentosPendientes: number(row.documentos_pendientes),
          entrevistasPendientes: number(row.entrevistas_pendientes),
          usuariosNuevos30d: number(row.usuarios_nuevos_30d),
          solicitudesCompletadas: completed,
          progresoPromedio: Math.round(number(row.progreso_promedio)),
          tasaCompletitud: total ? Math.round((completed / total) * 100) : 0,
        },
        cargaAsesores: workload.rows.map((item) => ({ ...item, asignados: number(item.asignados), pendientes: number(item.pendientes) })),
        actividad: activity.rows,
        pendientes: [
          { id: "asignaciones", label: "Solicitudes sin asignar", total: number(row.sin_asignar), destino: "/admin/assignments" },
          { id: "ds160", label: "DS-160 por revisar", total: number(row.ds160_pendientes), destino: "/admin/ds160" },
          { id: "documentos", label: "Documentos por revisar", total: number(row.documentos_pendientes), destino: "/admin/documents" },
          { id: "entrevistas", label: "Entrevistas pendientes", total: number(row.entrevistas_pendientes), destino: "/admin/interviews" },
        ],
        atencion: attention.rows,
      });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error("ERROR ADMIN DASHBOARD:", error);
      res.status(500).json({ error: "No fue posible cargar el panel administrativo" });
    }
  });

  router.get("/users", async (_req, res) => {
    try {
      await schemaReady;
      const result = await pool.query(`SELECT u.*,
        (SELECT COUNT(*) FROM tramite assigned WHERE assigned.id_asesor = u.id_usuario) AS asignados,
        (SELECT COUNT(*) FROM tramite assigned WHERE assigned.id_asesor = u.id_usuario
          AND assigned.estado IN ('Pendiente','En proceso')) AS pendientes,
        advisor.nombre AS asesor_nombre, advisor.id_usuario AS asesor_id,
        COALESCE(client_process.updated_at, u.updated_at) AS last_activity
        FROM usuario u
        LEFT JOIN tramite client_process ON client_process.id_usuario = u.id_usuario
        LEFT JOIN usuario advisor ON advisor.id_usuario = client_process.id_asesor
        ORDER BY u.created_at DESC, u.id_usuario DESC`);
      res.json({ usuarios: result.rows.map(presentUser) });
    } catch (error) {
      console.error("ERROR ADMIN USERS:", error);
      res.status(500).json({ error: "No fue posible cargar los usuarios" });
    }
  });

  router.get("/users/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Usuario inválido" });
    try {
      await schemaReady;
      const userResult = await pool.query(`SELECT u.*,
        (SELECT COUNT(*) FROM tramite assigned WHERE assigned.id_asesor = u.id_usuario) AS asignados,
        (SELECT COUNT(*) FROM tramite assigned WHERE assigned.id_asesor = u.id_usuario
          AND assigned.estado IN ('Pendiente','En proceso')) AS pendientes,
        advisor.nombre AS asesor_nombre, advisor.id_usuario AS asesor_id,
        COALESCE(client_process.updated_at, u.updated_at) AS last_activity
        FROM usuario u
        LEFT JOIN tramite client_process ON client_process.id_usuario = u.id_usuario
        LEFT JOIN usuario advisor ON advisor.id_usuario = client_process.id_asesor
        WHERE u.id_usuario = $1`, [id]);
      const userRow = userResult.rows[0];
      if (!userRow) return res.status(404).json({ error: "Usuario no encontrado" });

      let tramite = null;
      let casos = [];
      let actividad = [];

      if (userRow.rol === "cliente") {
        const tramiteResult = await pool.query(`SELECT t.id_tramite AS id, t.estado, t.etapa_actual,
          t.progreso, t.created_at, advisor.id_usuario AS asesor_id, advisor.nombre AS asesor_nombre
          FROM tramite t LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
          WHERE t.id_usuario = $1 LIMIT 1`, [id]);
        const row = tramiteResult.rows[0];
        tramite = row ? {
          id: row.id,
          estado: row.estado,
          etapaActual: row.etapa_actual,
          progreso: number(row.progreso),
          createdAt: row.created_at,
          asesor: row.asesor_id ? { id: row.asesor_id, nombre: row.asesor_nombre } : null,
        } : null;
      } else if (userRow.rol === "asesor") {
        const casosResult = await pool.query(`SELECT t.id_tramite AS id, t.estado, t.etapa_actual,
          applicant.nombre, applicant.correo
          FROM tramite t JOIN usuario applicant ON applicant.id_usuario = t.id_usuario
          WHERE t.id_asesor = $1 ORDER BY t.id_tramite DESC`, [id]);
        casos = casosResult.rows;
      } else if (userRow.rol === "admin") {
        const activityResult = await pool.query(`SELECT id, accion, detalle, created_at
          FROM admin_activity WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 10`, [id]);
        actividad = activityResult.rows;
      }

      res.json({ usuario: presentUser(userRow), tramite, casos, actividad });
    } catch (error) {
      console.error("ERROR ADMIN USER DETAIL:", error);
      res.status(500).json({ error: "No fue posible cargar el detalle del usuario" });
    }
  });

  router.post("/users", async (req, res) => {
    const { nombre, correo, contrasena, rol = "cliente" } = req.body || {};
    if (!nombre?.trim() || !correo?.trim() || !contrasena) return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });
    if (!VALID_ROLES.has(rol)) return res.status(400).json({ error: "Rol inválido" });
    try {
      await schemaReady;
      const contrasenaHash = await bcrypt.hash(contrasena, SALT_ROUNDS);
      const result = await pool.query(`INSERT INTO usuario (nombre, correo, contrasena, rol)
        VALUES ($1, $2, $3, $4) RETURNING *`, [nombre.trim(), correo.trim().toLowerCase(), contrasenaHash, rol]);
      await logActivity(req.auth.id_usuario, "Usuario creado", `${nombre.trim()} · ${rol}`);
      res.status(201).json({ usuario: presentUser(result.rows[0]) });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "El correo ya está registrado" });
      console.error("ERROR CREATE ADMIN USER:", error);
      res.status(500).json({ error: "No fue posible crear el usuario" });
    }
  });

  router.patch("/users/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { activo, disponible, capacidad, nombre, correo, telefono, ciudad, pais, rol } = req.body || {};
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Usuario inválido" });
    if (rol !== undefined && !VALID_ROLES.has(rol)) return res.status(400).json({ error: "Rol inválido" });
    if (id === req.auth.id_usuario) {
      if (activo === false) return res.status(400).json({ error: "No puedes desactivar tu propia cuenta" });
      if (rol !== undefined && rol !== req.auth.rol) return res.status(400).json({ error: "No puedes cambiar tu propio rol" });
    }
    try {
      await schemaReady;
      if (rol !== undefined) {
        const currentResult = await pool.query("SELECT rol FROM usuario WHERE id_usuario = $1", [id]);
        const currentUser = currentResult.rows[0];
        if (!currentUser) return res.status(404).json({ error: "Usuario no encontrado" });
        if (currentUser.rol === "asesor" && rol !== "asesor") {
          const casesResult = await pool.query("SELECT COUNT(*) FROM tramite WHERE id_asesor = $1", [id]);
          if (Number(casesResult.rows[0].count) > 0) {
            return res.status(409).json({ error: "No puedes cambiar el rol: el asesor tiene trámites asignados" });
          }
        }
      }
      const result = await pool.query(`UPDATE usuario SET
        nombre = COALESCE($1, nombre),
        correo = COALESCE($2, correo),
        telefono = COALESCE($3, telefono),
        ciudad = COALESCE($4, ciudad),
        pais = COALESCE($5, pais),
        rol = COALESCE($6, rol),
        activo = COALESCE($7, activo),
        disponible_asesor = COALESCE($8, disponible_asesor),
        capacidad_asesor = COALESCE($9, capacidad_asesor),
        updated_at = CURRENT_TIMESTAMP
        WHERE id_usuario = $10 RETURNING *`,
      [
        nombre?.trim() || null,
        correo?.trim().toLowerCase() || null,
        telefono !== undefined ? telefono : null,
        ciudad !== undefined ? ciudad : null,
        pais !== undefined ? pais : null,
        rol || null,
        typeof activo === "boolean" ? activo : null,
        typeof disponible === "boolean" ? disponible : null,
        capacidad ? number(capacidad) : null,
        id,
      ]);
      if (!result.rows.length) return res.status(404).json({ error: "Usuario no encontrado" });
      await logActivity(req.auth.id_usuario, "Usuario actualizado", result.rows[0].correo);
      res.json({ usuario: presentUser(result.rows[0]) });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "El correo ya está registrado" });
      console.error("ERROR UPDATE ADMIN USER:", error);
      res.status(500).json({ error: "No fue posible actualizar el usuario" });
    }
  });

  router.post("/users/:id/unlock", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Usuario inválido" });
    try {
      await schemaReady;
      const result = await pool.query(
        `UPDATE usuario SET bloqueado_hasta = NULL, intentos_reset_en = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id_usuario = $1 RETURNING *`,
        [id]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Usuario no encontrado" });
      await logActivity(req.auth.id_usuario, "Cuenta desbloqueada", result.rows[0].correo);
      res.json({ usuario: presentUser(result.rows[0]) });
    } catch (error) {
      console.error("ERROR UNLOCK ADMIN USER:", error);
      res.status(500).json({ error: "No fue posible desbloquear la cuenta" });
    }
  });

  router.get("/advisors", async (_req, res) => {
    try {
      await schemaReady;
      const result = await pool.query(`SELECT u.*,
        COUNT(t.id_tramite) AS asignados,
        COUNT(t.id_tramite) FILTER (WHERE t.estado IN ('Pendiente','En proceso')) AS pendientes
        FROM usuario u LEFT JOIN tramite t ON t.id_asesor = u.id_usuario
        WHERE u.rol = 'asesor' GROUP BY u.id_usuario ORDER BY u.nombre`);
      res.json({ asesores: result.rows.map(presentUser) });
    } catch (error) {
      console.error("ERROR ADMIN ADVISORS:", error);
      res.status(500).json({ error: "No fue posible cargar los asesores" });
    }
  });

  router.post("/advisors", async (req, res) => {
    const { nombre, correo, contrasena } = req.body || {};
    if (!nombre?.trim() || !correo?.trim() || !contrasena) {
      return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });
    }
    try {
      await schemaReady;
      const contrasenaHash = await bcrypt.hash(contrasena, SALT_ROUNDS);
      const result = await pool.query(`INSERT INTO usuario (nombre, correo, contrasena, rol)
        VALUES ($1, $2, $3, 'asesor') RETURNING *`,
      [nombre.trim(), correo.trim().toLowerCase(), contrasenaHash]);
      await logActivity(req.auth.id_usuario, "Asesor creado", nombre.trim());
      res.status(201).json({ asesor: presentUser(result.rows[0]) });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "El correo ya está registrado" });
      console.error("ERROR CREATE ADMIN ADVISOR:", error);
      res.status(500).json({ error: "No fue posible crear el asesor" });
    }
  });

  router.get("/assignments", async (_req, res) => {
    try {
      await schemaReady;
      const [cases, advisors] = await Promise.all([
        pool.query(`SELECT t.id_tramite AS id, t.estado, t.etapa_actual, t.progreso, t.created_at,
          u.nombre, u.correo, u.perfil FROM tramite t JOIN usuario u ON u.id_usuario = t.id_usuario
          WHERE t.id_asesor IS NULL ORDER BY t.id_tramite DESC`),
        pool.query(`SELECT u.id_usuario AS id, u.nombre, u.correo, u.capacidad_asesor AS capacidad,
          u.disponible_asesor AS disponible, COUNT(t.id_tramite) AS asignados
          FROM usuario u LEFT JOIN tramite t ON t.id_asesor = u.id_usuario
          WHERE u.rol = 'asesor' AND u.activo = TRUE GROUP BY u.id_usuario ORDER BY u.nombre`),
      ]);
      res.json({ casos: cases.rows, asesores: advisors.rows.map((item) => ({ ...item, capacidad: number(item.capacidad) || 50, asignados: number(item.asignados) })) });
    } catch (error) {
      console.error("ERROR ADMIN ASSIGNMENTS:", error);
      res.status(500).json({ error: "No fue posible cargar las asignaciones" });
    }
  });

  router.post("/assignments", async (req, res) => {
    const tramiteId = number(req.body?.tramiteId);
    const asesorId = number(req.body?.asesorId);
    if (!tramiteId || !asesorId) return res.status(400).json({ error: "Trámite y asesor son obligatorios" });
    try {
      await schemaReady;
      const advisor = await pool.query("SELECT id_usuario, nombre FROM usuario WHERE id_usuario = $1 AND rol = 'asesor' AND activo = TRUE", [asesorId]);
      if (!advisor.rows.length) return res.status(400).json({ error: "Asesor no disponible" });
      const currentResult = await pool.query(
        "SELECT id_tramite, id_usuario, id_asesor FROM tramite WHERE id_tramite = $1 LIMIT 1",
        [tramiteId]
      );
      const currentProcess = currentResult.rows[0];
      if (!currentProcess || currentProcess.id_asesor !== null) {
        return res.status(409).json({ error: "El trámite ya fue asignado o no existe" });
      }

      const result = await pool.query("UPDATE tramite SET id_asesor = $1, updated_at = CURRENT_TIMESTAMP WHERE id_tramite = $2 AND id_asesor IS NULL RETURNING id_tramite, id_usuario, id_asesor", [asesorId, tramiteId]);
      if (!result.rows.length) return res.status(409).json({ error: "El trámite ya fue asignado o no existe" });
      await processHistoryService.recordChanges({
        processId: tramiteId,
        changedBy: req.auth?.id_usuario || null,
        changes: [
          processHistoryService.buildChange("id_asesor", currentProcess.id_asesor, result.rows[0].id_asesor),
        ],
      });
      await logActivity(req.auth.id_usuario, "Solicitud asignada", `Trámite ${tramiteId} → ${advisor.rows[0].nombre}`);
      await activeActivityLogService.logActivity({
        req,
        actor: req.auth,
        userId: result.rows[0].id_usuario,
        adminId: req.auth?.id_usuario,
        userEmail: req.auth?.correo,
        role: req.auth?.rol || "admin",
        action: "advisor.assigned",
        entityType: "tramite",
        entityId: tramiteId,
        description: "Asesor asignado a trámite",
        metadata: {
          asesorId,
          asesorNombre: advisor.rows[0].nombre,
        },
      });
      if (notificacionService && result.rows[0].id_usuario) {
        try {
          await notificacionService.crearNotificacion({
            userId: result.rows[0].id_usuario,
            titulo: "Asesor asignado",
            mensaje: "Se te asigno un asesor para acompanar tu tramite.",
            tipo: "info",
            etapaRelacionada: `tramite-${tramiteId}-asesor`,
          });
        } catch (notificationError) {
          console.error("ERROR ADMIN ASSIGNMENT NOTIFICATION:", notificationError);
        }
      }
      res.json({ message: "Solicitud asignada correctamente" });
    } catch (error) {
      console.error("ERROR CREATE ASSIGNMENT:", error);
      res.status(500).json({ error: "No fue posible asignar la solicitud" });
    }
  });

  router.get("/ds160", async (_req, res) => {
    try {
      await schemaReady;
      const result = await pool.query(`SELECT f.id_formulario AS id, f.id_usuario, f.seccion_actual,
        f.completado, f.estado_revision, f.feedback_revision, f.created_at, f.updated_at,
        u.nombre, u.correo, u.perfil, advisor.id_usuario AS asesor_id, advisor.nombre AS asesor
        FROM formulario_ds160 f JOIN usuario u ON u.id_usuario = f.id_usuario
        LEFT JOIN usuario advisor ON advisor.id_usuario = f.id_asesor
        ORDER BY f.updated_at DESC, f.id_formulario DESC`);
      res.json({ formularios: result.rows.map((row) => ({ ...row, progreso: row.completado ? 100 : Math.min(100, Math.round(number(row.seccion_actual) / 6 * 100)) })) });
    } catch (error) {
      console.error("ERROR ADMIN DS160:", error.message, error.stack);
      res.status(500).json({ error: "No fue posible cargar los formularios. Intente nuevamente." });
    }
  });

  router.put("/ds160/:id", async (req, res) => {
    const id = number(req.params.id);
    const { estado, feedback = "" } = req.body || {};
    if (!id || !VALID_DS160_STATES.has(estado)) return res.status(400).json({ error: "Formulario o estado inválido" });
    try {
      await schemaReady;
      const result = await pool.query(`UPDATE formulario_ds160 SET estado_revision = $1,
        feedback_revision = $2, updated_at = CURRENT_TIMESTAMP WHERE id_formulario = $3 RETURNING id_formulario`,
      [estado, String(feedback).trim() || null, id]);
      if (!result.rows.length) return res.status(404).json({ error: "Formulario no encontrado" });
      await logActivity(req.auth.id_usuario, "DS-160 revisado", `Formulario ${id} · ${estado}`);
      res.json({ message: "Formulario actualizado correctamente" });
    } catch (error) {
      console.error("ERROR UPDATE ADMIN DS160:", error);
      res.status(500).json({ error: "No fue posible actualizar el formulario" });
    }
  });

  router.get("/profile", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM usuario WHERE id_usuario = $1", [req.auth.id_usuario]);
      if (!result.rows.length) return res.status(404).json({ error: "Perfil no encontrado" });
      res.json({ usuario: presentUser(result.rows[0]) });
    } catch (error) {
      res.status(500).json({ error: "No fue posible cargar el perfil" });
    }
  });

  router.put("/profile", async (req, res) => {
    const { nombre, telefono = "", ciudad = "", pais = "" } = req.body || {};
    if (!nombre?.trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
    try {
      const result = await pool.query(`UPDATE usuario SET nombre = $1, telefono = $2, ciudad = $3,
        pais = $4, updated_at = CURRENT_TIMESTAMP WHERE id_usuario = $5 RETURNING *`,
      [nombre.trim(), telefono.trim(), ciudad.trim(), pais.trim(), req.auth.id_usuario]);
      await logActivity(req.auth.id_usuario, "Perfil actualizado", result.rows[0].correo);
      res.json({ usuario: presentUser(result.rows[0]) });
    } catch (error) {
      res.status(500).json({ error: "No fue posible actualizar el perfil" });
    }
  });

  router.get("/settings", async (_req, res) => {
    try {
      await schemaReady;
      const result = await pool.query("SELECT * FROM admin_settings WHERE id = 1");
      res.json({ configuracion: result.rows[0] || null });
    } catch (error) {
      res.status(500).json({ error: "No fue posible cargar la configuración" });
    }
  });

  router.put("/settings", async (req, res) => {
    const data = req.body || {};
    try {
      await schemaReady;
      const result = await pool.query(`INSERT INTO admin_settings
        (id, nombre_comercial, razon_social, sitio_web, idioma, zona_horaria, notificaciones_automaticas)
        VALUES (1, $1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET nombre_comercial = EXCLUDED.nombre_comercial,
          razon_social = EXCLUDED.razon_social, sitio_web = EXCLUDED.sitio_web,
          idioma = EXCLUDED.idioma, zona_horaria = EXCLUDED.zona_horaria,
          notificaciones_automaticas = EXCLUDED.notificaciones_automaticas,
          updated_at = CURRENT_TIMESTAMP RETURNING *`,
      [
        data.nombre_comercial || "",
        data.razon_social || "",
        data.sitio_web || "",
        data.idioma || "es",
        data.zona_horaria || "America/Guatemala",
        typeof data.notificaciones_automaticas === "boolean" ? data.notificaciones_automaticas : true,
      ]);
      await logActivity(req.auth.id_usuario, "Configuración actualizada", "Datos generales");
      res.json({ configuracion: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: "No fue posible guardar la configuración" });
    }
  });

  return router;
};
