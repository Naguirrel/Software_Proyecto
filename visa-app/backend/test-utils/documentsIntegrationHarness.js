const express = require("express");
const createDocumentRoutes = require("../routes/documentRoutes");
const createAdminDocumentRoutes = require("../routes/adminDocumentRoutes");
const upload = require("../upload");
const { createRoleMiddleware, createSessionMiddleware, issueSessionToken } = require("../auth");

const normalize = (sql) => String(sql).replace(/\s+/g, " ").trim();

function createInMemoryDocumentsDb() {
  const state = { users: [], documentos: [], nextDocumentId: 1, clock: 0 };
  const tick = () => new Date(Date.UTC(2026, 0, 1) + state.clock++ * 1000);

  async function query(sql, values = []) {
    const text = normalize(sql);

    if (text.includes("FROM usuario WHERE id_usuario = $1")) {
      const user = state.users.find((row) => row.id_usuario === values[0]);
      return { rows: user ? [{ ...user }] : [] };
    }

    if (text.startsWith("SELECT id, storage_key FROM documentos")) {
      const found = state.documentos.find((row) => row.usuario_id === values[0] && row.documento_key === values[1]);
      return { rows: found ? [{ id: found.id, storage_key: found.storage_key }] : [] };
    }

    if (text.startsWith("UPDATE documentos SET nombre = $1")) {
      const [nombre, tipo, archivoUrl, storageKey, id] = values;
      const documento = state.documentos.find((row) => row.id === id);
      Object.assign(documento, {
        nombre,
        tipo,
        archivo_url: archivoUrl,
        storage_key: storageKey,
        estado: "review",
        feedback: null,
        actualizado_en: tick(),
      });
      return { rows: [{ ...documento }] };
    }

    if (text.startsWith("INSERT INTO documentos")) {
      const [nombre, tipo, archivoUrl, usuarioId, documentoKey, storageKey] = values;
      const now = tick();
      const documento = {
        id: state.nextDocumentId++,
        nombre,
        tipo,
        archivo_url: archivoUrl,
        usuario_id: usuarioId,
        documento_key: documentoKey,
        estado: "review",
        feedback: null,
        storage_key: storageKey,
        creado_en: now,
        actualizado_en: now,
      };
      state.documentos.push(documento);
      return { rows: [{ ...documento }] };
    }

    if (text.startsWith("SELECT id, nombre, tipo, archivo_url, usuario_id") && text.includes("FROM documentos WHERE usuario_id = $1")) {
      const rows = state.documentos
        .filter((row) => row.usuario_id === values[0])
        .sort((a, b) => b.actualizado_en - a.actualizado_en)
        .map((row) => ({ ...row }));
      return { rows };
    }

    if (text.startsWith("SELECT * FROM documentos WHERE id = $1")) {
      const documento = state.documentos.find((row) => row.id === values[0]);
      return { rows: documento ? [{ ...documento }] : [] };
    }

    if (text.startsWith("DELETE FROM documentos")) {
      const index = state.documentos.findIndex((row) => row.id === values[0] && row.usuario_id === values[1]);
      if (index === -1) return { rows: [] };
      const [removed] = state.documentos.splice(index, 1);
      return { rows: [{ id: removed.id, storage_key: removed.storage_key }] };
    }

    if (text.includes("FROM documentos d LEFT JOIN usuario u")) {
      const rows = state.documentos
        .slice()
        .sort((a, b) => b.actualizado_en - a.actualizado_en)
        .map(withOwner);
      return { rows };
    }

    if (text.startsWith("WITH updated AS") && text.includes("UPDATE documentos")) {
      const documento = state.documentos.find((row) => row.id === values[values.length - 1]);
      if (!documento) return { rows: [] };
      const estadoParam = text.match(/estado = \$(\d+)/);
      const feedbackParam = text.match(/feedback = \$(\d+)/);
      if (estadoParam) documento.estado = values[Number(estadoParam[1]) - 1];
      if (feedbackParam) documento.feedback = values[Number(feedbackParam[1]) - 1];
      documento.actualizado_en = tick();
      return { rows: [withOwner(documento)] };
    }

    throw new Error(`Consulta no soportada por la base en memoria: ${text}`);
  }

  function withOwner(documento) {
    const owner = state.users.find((row) => row.id_usuario === documento.usuario_id);
    return {
      ...documento,
      usuario_nombre: owner?.nombre,
      usuario_correo: owner?.correo,
      asesor_id: null,
      asesor_nombre: null,
    };
  }

  function addUser({ id, rol = "cliente", nombre, correo }) {
    const user = {
      id_usuario: id,
      nombre: nombre || `Usuario ${id}`,
      correo: correo || `usuario${id}@example.com`,
      perfil: null,
      rol,
      activo: true,
      email_verificado: true,
    };
    state.users.push(user);
    return { user, token: issueSessionToken(user) };
  }

  return { state, addUser, pool: { query: jest.fn(query) } };
}

function createDocumentsIntegrationApp() {
  const db = createInMemoryDocumentsDb();
  const requireSession = createSessionMiddleware(db.pool);
  const requireAdmin = createRoleMiddleware(db.pool, ["admin"]);
  const activityLogService = { logActivity: jest.fn(() => Promise.resolve()) };
  const notificaciones = [];
  const notificacionService = {
    crearNotificacion: jest.fn(async (notificacion) => {
      notificaciones.push(notificacion);
    }),
  };

  const app = express();
  app.use(express.json());
  app.use("/", createDocumentRoutes(db.pool, {
    documentSchemaReady: Promise.resolve(),
    activityLogService,
    requireSession,
  }));
  app.use("/admin/documents", createAdminDocumentRoutes(db.pool, {
    requireAdmin,
    schemaReady: Promise.resolve(),
    notificacionService,
    activityLogService,
  }));
  app.use(upload.handleUploadError);

  return { app, ...db, activityLogService, notificaciones, notificacionService };
}

const PDF_CONTENT = Buffer.from("%PDF-1.4 contenido de prueba");

module.exports = { createDocumentsIntegrationApp, PDF_CONTENT };
