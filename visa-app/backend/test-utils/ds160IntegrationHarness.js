const express = require("express");
const createDs160Routes = require("../routes/ds160Routes");
const { createSessionMiddleware, issueSessionToken } = require("../auth");

const normalize = (sql) => String(sql).replace(/\s+/g, " ").trim();

function createInMemoryDs160Db() {
  const state = { users: [], tramites: [], formularios: [], nextFormularioId: 1 };

  async function query(sql, values = []) {
    const text = normalize(sql);

    if (text.includes("FROM usuario WHERE id_usuario = $1")) {
      const user = state.users.find((row) => row.id_usuario === values[0]);
      return { rows: user ? [{ ...user }] : [] };
    }

    if (text.startsWith("SELECT * FROM formulario_ds160 WHERE id_usuario = $1")) {
      const formulario = state.formularios.find((row) => row.id_usuario === values[0]);
      return { rows: formulario ? [{ ...formulario }] : [] };
    }

    if (text.startsWith("SELECT id_formulario FROM formulario_ds160 WHERE id_usuario = $1")) {
      const formulario = state.formularios.find((row) => row.id_usuario === values[0]);
      return { rows: formulario ? [{ id_formulario: formulario.id_formulario }] : [] };
    }

    if (text.startsWith("INSERT INTO formulario_ds160")) {
      const [userId, datos, seccionActual, completado] = values;
      const formulario = {
        id_formulario: state.nextFormularioId++,
        id_usuario: userId,
        datos: JSON.parse(datos),
        seccion_actual: seccionActual,
        completado,
        updated_at: new Date(),
      };
      state.formularios.push(formulario);
      return { rows: [{ ...formulario }] };
    }

    if (text.startsWith("UPDATE formulario_ds160")) {
      const [datos, seccionActual, completado, userId] = values;
      const formulario = state.formularios.find((row) => row.id_usuario === userId);
      Object.assign(formulario, {
        datos: JSON.parse(datos),
        seccion_actual: seccionActual,
        completado,
        updated_at: new Date(),
      });
      return { rows: [{ ...formulario }] };
    }

    if (text.startsWith("SELECT id_tramite, progreso FROM tramite WHERE id_usuario = $1")) {
      const tramite = state.tramites.find((row) => row.id_usuario === values[0]);
      return { rows: tramite ? [{ id_tramite: tramite.id_tramite, progreso: tramite.progreso }] : [] };
    }

    if (text.startsWith("UPDATE tramite") && text.includes("SET etapa_actual = 'Pago de visa'")) {
      const tramite = state.tramites.find((row) => row.id_usuario === values[0]);
      if (tramite) {
        Object.assign(tramite, {
          etapa_actual: "Pago de visa",
          progreso: 34,
          siguiente_paso: "Realizar el pago de la tarifa de visa",
          mensaje: "Formulario DS-160 completado. El siguiente paso es realizar el pago.",
        });
      }
      return { rows: [] };
    }

    throw new Error(`Consulta no soportada por la base en memoria: ${text}`);
  }

  function addUser({ id, correo, nombre, rol = "cliente", activo = true }) {
    const user = { id_usuario: id, correo, nombre: nombre || correo, perfil: null, rol, activo, email_verificado: true };
    state.users.push(user);
    return { user, token: issueSessionToken(user) };
  }

  function addTramite({ userId, progreso = 0 }) {
    const tramite = { id_tramite: state.tramites.length + 1, id_usuario: userId, progreso };
    state.tramites.push(tramite);
    return tramite;
  }

  return { state, addUser, addTramite, pool: { query: jest.fn(query) } };
}

function createDs160IntegrationApp() {
  const db = createInMemoryDs160Db();
  const activityLogService = { logActivity: jest.fn(() => Promise.resolve()) };
  const notificaciones = [];
  const notificacionService = {
    crearNotificacion: jest.fn(async (notificacion) => {
      notificaciones.push(notificacion);
    }),
  };
  const requireSession = createSessionMiddleware(db.pool);

  const app = express();
  app.use(express.json());
  app.use("/", createDs160Routes(db.pool, { activityLogService, notificacionService, requireSession }));

  return { app, ...db, activityLogService, notificaciones, notificacionService };
}

module.exports = { createDs160IntegrationApp };
