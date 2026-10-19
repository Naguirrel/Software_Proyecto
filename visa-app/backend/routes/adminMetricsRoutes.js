const express = require("express");
const { parseAdminSearch, buildAdminCohort } = require("../services/adminSearchFilter");
const { buildAdminProcessWorkbook } = require("../services/adminExcelReport");
const { sendErrorResponse } = require("../middleware/errorResponse");

const ALLOWED_PERIODS = new Set([30, 90, 365]);

function parseDate(value, field) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error(`${field} debe usar el formato YYYY-MM-DD`);
    error.statusCode = 400;
    throw error;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    const error = new Error(`${field} no es una fecha válida`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function buildDateFilter(query, column = "created_at") {
  const from = parseDate(query.from, "from");
  const to = parseDate(query.to, "to");
  if (from && to && from > to) {
    const error = new Error("La fecha inicial no puede ser posterior a la fecha final");
    error.statusCode = 400;
    throw error;
  }

  if (from || to) {
    const conditions = [];
    const values = [];
    if (from) {
      values.push(from);
      conditions.push(`${column} >= $${values.length}::date`);
    }
    if (to) {
      values.push(to);
      conditions.push(`${column} < ($${values.length}::date + INTERVAL '1 day')`);
    }
    return { clause: conditions.join(" AND "), values, from, to, days: null };
  }

  const days = ALLOWED_PERIODS.has(Number(query.days)) ? Number(query.days) : null;
  return {
    clause: days ? `${column} >= CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day')` : "",
    values: days ? [days] : [],
    from: null,
    to: null,
    days,
  };
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildProcessCsv(rows) {
  const headers = ["ID", "Solicitante", "Correo", "Perfil", "Estado", "Etapa", "Progreso", "Asesor", "Fecha de creación", "Última actualización"];
  const lines = rows.map((row) => [
    row.id_tramite,
    row.solicitante,
    row.correo,
    row.perfil,
    row.estado,
    row.etapa_actual,
    row.progreso,
    row.asesor || "Sin asignar",
    row.created_at ? new Date(row.created_at).toISOString() : "",
    row.updated_at ? new Date(row.updated_at).toISOString() : "",
  ].map(csvCell).join(","));
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${lines.join("\r\n")}`;
}

async function getFilteredProcesses(pool, query) {
  const search = parseAdminSearch(query);
  const filter = buildAdminCohort(search);
  const result = await pool.query(`
    ${filter.cte}
    SELECT t.id_tramite, applicant.nombre AS solicitante, applicant.correo,
      applicant.perfil, t.estado, t.etapa_actual, t.progreso,
      advisor.nombre AS asesor, t.created_at, t.updated_at
    FROM filtered_processes t
    JOIN usuario applicant ON applicant.id_usuario = t.id_usuario
    LEFT JOIN usuario advisor ON advisor.id_usuario = t.id_asesor
    ORDER BY t.created_at DESC, t.id_tramite DESC
  `, filter.values);
  return { rows: result.rows, filter: search };
}

module.exports = function createAdminMetricsRoutes(pool, { requireAdmin }) {
  const router = express.Router();

  router.get("/overview", requireAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM usuario) AS usuarios_total,
          (SELECT COUNT(*) FROM usuario WHERE COALESCE(rol, 'cliente') = 'cliente') AS clientes,
          (SELECT COUNT(*) FROM usuario WHERE rol = 'asesor') AS asesores,
          (SELECT COUNT(*) FROM documentos WHERE estado = 'review') AS documentos_pendientes,
          (SELECT COUNT(*) FROM tramite WHERE estado = 'En proceso') AS tramites_activos,
          (SELECT COUNT(*) FROM formulario_ds160 WHERE completado = false) AS ds160_pendientes,
          (SELECT COUNT(*) FROM interview_sessions WHERE status = 'pending') AS entrevistas_pendientes
      `);
      const row = result.rows[0] || {};
      res.json(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value) || 0])));
    } catch (error) {
      console.error("ERROR ADMIN METRICS OVERVIEW:", error);
      res.status(500).json({ error: "No fue posible cargar los indicadores" });
    }
  });

  router.get("/processes", requireAdmin, async (req, res) => {
    try {
      const search = parseAdminSearch(req.query);
      const cohort = buildAdminCohort(search);
      const filter = { ...search, values: cohort.values };
      const where = "WHERE id_tramite IN (SELECT id_tramite FROM filtered_processes)";
      const advisorFilter = { clause: "t.id_tramite IN (SELECT id_tramite FROM filtered_processes)", values: cohort.values };
      const monthlyFilter = advisorFilter;
      const documentFilter = { clause: search.active ? "d.usuario_id IN (SELECT id_usuario FROM filtered_processes)" : "", values: cohort.values };
      const query = (sql, values) => pool.query(`${cohort.cte} ${sql}`, values);
      const [statusResult, stageResult, summaryResult, advisorResult, monthlyResult, documentResult] = await Promise.all([
        query(`SELECT estado AS label, COUNT(*) AS total FROM tramite ${where} GROUP BY estado ORDER BY estado`, filter.values),
        query(`SELECT etapa_actual AS label, COUNT(*) AS total FROM tramite ${where} GROUP BY etapa_actual ORDER BY etapa_actual`, filter.values),
        query(`
          SELECT
            COUNT(*) AS total,
            COALESCE(AVG(progreso), 0) AS progreso_promedio,
            COUNT(*) FILTER (WHERE estado = 'Aprobado' OR progreso >= 100) AS completados,
            COUNT(*) FILTER (WHERE id_asesor IS NULL) AS sin_asignar,
            COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
              FILTER (WHERE estado = 'Aprobado' OR progreso >= 100), 0) AS tiempo_promedio_dias,
            (SELECT COUNT(*) FROM documentos WHERE estado IN ('pending', 'review')
              ${search.active ? "AND usuario_id IN (SELECT id_usuario FROM filtered_processes)" : ""}) +
              (SELECT COUNT(*) FROM formulario_ds160 WHERE estado_revision = 'por_revisar'
              ${search.active ? "AND id_usuario IN (SELECT id_usuario FROM filtered_processes)" : ""}) AS revisiones_pendientes
          FROM tramite
          ${where}
        `, filter.values),
        query(`
          SELECT
            advisor.id_usuario AS id,
            advisor.nombre,
            COUNT(t.id_tramite) AS asignados,
            COUNT(t.id_tramite) FILTER (
              WHERE t.estado IN ('Pendiente', 'En proceso')
            ) AS pendientes
          FROM usuario advisor
          LEFT JOIN tramite t ON t.id_asesor = advisor.id_usuario
            ${advisorFilter.clause ? `AND ${advisorFilter.clause}` : ""}
          WHERE advisor.rol = 'asesor'
            ${search.active ? "AND advisor.id_usuario IN (SELECT id_asesor FROM filtered_processes)" : ""}
          GROUP BY advisor.id_usuario, advisor.nombre
          ORDER BY asignados DESC, advisor.nombre ASC
          LIMIT 6
        `, advisorFilter.values),
        query(`, months AS (
          SELECT generate_series(
            COALESCE((SELECT date_trunc('month', MIN(created_at)) FROM filtered_processes), date_trunc('month', CURRENT_DATE)),
            COALESCE((SELECT date_trunc('month', MAX(created_at)) FROM filtered_processes), date_trunc('month', CURRENT_DATE)),
            INTERVAL '1 month'
          ) AS month
        )
        SELECT TO_CHAR(months.month, 'YYYY-MM') AS label, COUNT(t.id_tramite) AS total
        FROM months
        LEFT JOIN tramite t ON date_trunc('month', t.created_at) = months.month
          ${monthlyFilter.clause ? `AND ${monthlyFilter.clause}` : ""}
        GROUP BY months.month ORDER BY months.month`, monthlyFilter.values),
        query(`SELECT d.estado AS label, COUNT(*) AS total
          FROM documentos d ${documentFilter.clause ? `WHERE ${documentFilter.clause}` : ""}
          GROUP BY d.estado ORDER BY d.estado`, documentFilter.values),
      ]);
      const normalize = ({ label, total }) => ({ label, total: Number(total) || 0 });
      const summary = summaryResult.rows[0] || {};
      const total = Number(summary.total) || 0;
      const completed = Number(summary.completados) || 0;
      res.json({
        porEstado: statusResult.rows.map(normalize),
        porEtapa: stageResult.rows.map(normalize),
        nuevasSolicitudes: monthlyResult.rows.map(normalize),
        documentosPorEstado: documentResult.rows.map(normalize),
        totalTramites: total,
        totalActivas: Math.max(0, total - completed),
        progresoPromedio: Number(summary.progreso_promedio) || 0,
        completados: completed,
        sinAsignar: Number(summary.sin_asignar) || 0,
        tiempoPromedioDias: Number(summary.tiempo_promedio_dias) || 0,
        revisionesPendientes: Number(summary.revisiones_pendientes) || 0,
        tasaExito: total ? Math.round((completed / total) * 100) : 0,
        periodo: { days: filter.days, from: filter.from || null, to: filter.to || null },
        cargaAsesores: advisorResult.rows.map((row) => ({
          id: row.id,
          nombre: row.nombre,
          asignados: Number(row.asignados) || 0,
          pendientes: Number(row.pendientes) || 0,
        })),
      });
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible cargar los reportes",
        context: "admin_metrics.processes",
      });
    }
  });

  router.get("/processes.csv", requireAdmin, async (req, res) => {
    try {
      const { rows } = await getFilteredProcesses(pool, req.query);

      const filename = `visaguide-reporte-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buildProcessCsv(rows));
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible exportar el reporte",
        context: "admin_metrics.csv",
      });
    }
  });

  router.get("/processes.xlsx", requireAdmin, async (req, res) => {
    try {
      const { rows, filter } = await getFilteredProcesses(pool, req.query);
      const cohort = buildAdminCohort(filter);
      const documents = await pool.query(`${cohort.cte}
        SELECT d.estado AS label, COUNT(*) AS total
        FROM documentos d
        WHERE d.usuario_id IN (SELECT id_usuario FROM filtered_processes)
        GROUP BY d.estado
        ORDER BY d.estado`, cohort.values);
      const workbook = await buildAdminProcessWorkbook(rows, filter, { documentsByStatus: documents.rows });
      const filename = `visaguide-reporte-${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", workbook.length);
      return res.send(workbook);
    } catch (error) {
      return sendErrorResponse(req, res, error, {
        fallback: "No fue posible exportar el reporte de Excel",
        context: "admin_metrics.xlsx",
      });
    }
  });

  return router;
};

module.exports.buildDateFilter = buildDateFilter;
module.exports.buildProcessCsv = buildProcessCsv;
