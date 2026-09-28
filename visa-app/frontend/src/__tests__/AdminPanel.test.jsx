import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const adminSession = {
  id: 1,
  nombre: "Admin General",
  correo: "admin@prueba.com",
  rol: "admin",
  token: "signed-admin-token",
};

function mockAdminSession() {
  localStorage.setItem("visaguide_session", JSON.stringify(adminSession));
  localStorage.setItem("correoUsuario", adminSession.correo);
  let adminDocumentStatus = "review";
  let adminDocumentFeedback = "Documento ilegible.";
  let adminQuestions = [
    { id: 10, question: "¿Cuál es el propósito de su viaje?", category: "Viaje", difficulty: "Fácil", is_required: true, activo: true, uso_count: 12 },
    { id: 11, question: "¿Quién financiará su viaje?", category: "Finanzas", difficulty: "Media", is_required: false, activo: false, uso_count: 4 },
  ];
  let managedProcess = {
    id: 21,
    estado: "En proceso",
    etapaActual: "Formulario DS-160",
    progreso: 17,
    siguientePaso: "Completar formulario",
    mensaje: "",
    solicitante: { id: 8, nombre: "Carlos Mendoza", correo: "carlos@example.com", perfil: "Renovación B1/B2" },
    asesor: null,
  };
  let processHistory = [
    {
      id: 1,
      processId: 21,
      fieldName: "estado",
      oldValue: "En proceso",
      newValue: "Pendiente",
      changedAt: "2026-08-10T10:00:00.000Z",
      changedBy: { id: 1, nombre: "Admin General", correo: "admin@prueba.com" },
    },
  ];
  let adminSettings = { nombre_comercial: "VisaGuide", razon_social: "", sitio_web: "", idioma: "es", zona_horaria: "America/Guatemala", notificaciones_automaticas: true };
  let adminUsers = [
    { id: 1, nombre: "Admin General", correo: "admin@prueba.com", rol: "admin", perfil: null, activo: true, telefono: "", ciudad: "", pais: "", asignados: 0, pendientes: 0, asesor: null, actividad: "2026-08-10T10:00:00.000Z" },
    { id: 4, nombre: "Cliente Prueba", correo: "cliente@example.com", rol: "cliente", perfil: "Turismo B1/B2", activo: true, telefono: "", ciudad: "", pais: "", asignados: 0, pendientes: 0, asesor: null, actividad: "2026-08-05T10:00:00.000Z" },
    { id: 7, nombre: "Laura Vásquez", correo: "laura@visaguide.com", rol: "asesor", perfil: null, activo: true, telefono: "", ciudad: "", pais: "", asignados: 3, pendientes: 1, asesor: null, actividad: "2026-08-06T10:00:00.000Z" },
  ];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    if (String(url).includes("/validar-sesion")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ valid: true, user: adminSession }),
      });
    }
    if (String(url).endsWith("/interview-sessions")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          sessions: [
            {
              id: 12,
              user_name: "Usuario Demo",
              user_email: "demo@example.com",
              status: "pending",
              responses: [
                {
                  id: "q1",
                  text: "Cual es el proposito de su viaje?",
                  recorded: true,
                  duration: 42,
                  audio: { url: "https://example.com/demo.mp3" },
                },
              ],
              created_at: "2026-08-01T10:00:00.000Z",
            },
          ],
        }),
      });
    }
    if (String(url).includes("/notificaciones/")) {
      return Promise.resolve({ ok: true, json: async () => ({ notificaciones: [], noLeidas: 0 }) });
    }
    if (String(url).endsWith("/admin/dashboard")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          resumen: { solicitudesActivas: 4, sinAsignar: 1, asesoresActivos: 2, ds160Pendientes: 6, documentosPendientes: 3, entrevistasPendientes: 2, usuariosNuevos30d: 5, solicitudesCompletadas: 8, progresoPromedio: 64, tasaCompletitud: 80 },
          cargaAsesores: [],
          actividad: [{ id: "usuario-8", accion: "Nuevo usuario registrado", detalle: "carlos@example.com", actor: "Carlos Mendoza", destino: "/admin/users/8", created_at: "2026-08-01T10:00:00.000Z" }],
          pendientes: [
            { id: "asignaciones", label: "Solicitudes sin asignar", total: 1, destino: "/admin/assignments" },
            { id: "ds160", label: "DS-160 por revisar", total: 6, destino: "/admin/ds160" },
            { id: "documentos", label: "Documentos por revisar", total: 3, destino: "/admin/documents" },
            { id: "entrevistas", label: "Entrevistas pendientes", total: 2, destino: "/admin/interviews" },
          ],
          atencion: [],
        }),
      });
    }
    if (String(url).endsWith("/admin/users") && (!options.method || options.method === "GET")) {
      return Promise.resolve({ ok: true, json: async () => ({ usuarios: adminUsers }) });
    }
    if (/\/admin\/users\/\d+$/.test(String(url)) && (!options.method || options.method === "GET")) {
      const id = Number(String(url).match(/\/admin\/users\/(\d+)$/)[1]);
      if (id === 8) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            usuario: { id: 8, nombre: "Carlos Mendoza", correo: "carlos@example.com", rol: "cliente", perfil: "Renovación B1/B2", activo: true, telefono: "", ciudad: "", pais: "", createdAt: "2026-07-20T10:00:00.000Z", actividad: "2026-08-01T10:00:00.000Z" },
            tramite: { id: 21, estado: managedProcess.estado, etapaActual: managedProcess.etapaActual, progreso: managedProcess.progreso, asesor: managedProcess.asesor },
            casos: [],
            actividad: [],
          }),
        });
      }
      const target = adminUsers.find((item) => item.id === id);
      if (!target) return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: "Usuario no encontrado" }) });
      return Promise.resolve({ ok: true, json: async () => ({ usuario: target, tramite: null, casos: [], actividad: [] }) });
    }
    if (/\/admin\/users\/\d+$/.test(String(url)) && options.method === "PATCH") {
      const id = Number(String(url).match(/\/admin\/users\/(\d+)$/)[1]);
      const payload = JSON.parse(options.body || "{}");
      const target = adminUsers.find((item) => item.id === id);
      if (!target) return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: "Usuario no encontrado" }) });
      if (id === adminSession.id && payload.activo === false) {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "No puedes desactivar tu propia cuenta" }) });
      }
      adminUsers = adminUsers.map((item) => item.id === id ? { ...item, ...payload } : item);
      return Promise.resolve({ ok: true, json: async () => ({ usuario: adminUsers.find((item) => item.id === id) }) });
    }
    if (String(url).endsWith("/admin/advisors")) {
      return Promise.resolve({ ok: true, json: async () => ({ asesores: [] }) });
    }
    if (String(url).endsWith("/admin/assignments")) {
      return Promise.resolve({ ok: true, json: async () => ({ casos: [], asesores: [] }) });
    }
    if (String(url).endsWith("/admin/ds160")) {
      return Promise.resolve({ ok: true, json: async () => ({ formularios: [{ id: 31, nombre: "Usuario Demo", correo: "demo@example.com", perfil: "Turismo B1/B2", progreso: 85, seccion_actual: 8, completado: false, estado_revision: "en_progreso", asesor: "Laura Vásquez" }] }) });
    }
    if (String(url).endsWith("/admin/ds160/31") && options.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({ formulario: { id: 31, estado_revision: JSON.parse(options.body).estado } }) });
    }
    if (String(url).endsWith("/admin/profile")) {
      return Promise.resolve({ ok: true, json: async () => ({ usuario: adminSession }) });
    }
    if (String(url).endsWith("/questions/admin")) {
      return Promise.resolve({ ok: true, json: async () => ({ questions: adminQuestions }) });
    }
    if (/\/questions\/\d+\/status$/.test(String(url)) && options.method === "PATCH") {
      const id = Number(String(url).match(/\/questions\/(\d+)\/status$/)?.[1]);
      const payload = JSON.parse(options.body || "{}");
      adminQuestions = adminQuestions.map((question) => question.id === id ? { ...question, activo: payload.activo } : question);
      return Promise.resolve({ ok: true, json: async () => ({ question: adminQuestions.find((question) => question.id === id) }) });
    }
    if (/\/questions\/\d+$/.test(String(url)) && options.method === "DELETE") {
      const id = Number(String(url).match(/\/questions\/(\d+)$/)?.[1]);
      adminQuestions = adminQuestions.filter((question) => question.id !== id);
      return Promise.resolve({ ok: true, json: async () => ({ message: "Pregunta eliminada correctamente" }) });
    }
    if (String(url).endsWith("/questions")) {
      return Promise.resolve({ ok: true, json: async () => ({ questions: [] }) });
    }
    if (String(url).endsWith("/admin/settings") && (!options.method || options.method === "GET")) {
      return Promise.resolve({ ok: true, json: async () => ({ configuracion: adminSettings }) });
    }
    if (String(url).endsWith("/admin/settings") && options.method === "PUT") {
      adminSettings = { ...adminSettings, ...JSON.parse(options.body || "{}") };
      return Promise.resolve({ ok: true, json: async () => ({ configuracion: adminSettings }) });
    }
    if (String(url).includes("/admin/activity-logs")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          logs: [{
            id: 1,
            userId: 4,
            adminId: null,
            userEmail: "cliente@example.com",
            role: "cliente",
            action: "user.login",
            entityType: "usuario",
            entityId: "4",
            description: "Login exitoso",
            metadata: { metodo: "password" },
            ipAddress: "127.0.0.1",
            userAgent: "Vitest",
            createdAt: "2026-09-01T10:00:00.000Z",
          }],
          page: 1,
          pages: 1,
          total: 1,
          limit: 50,
        }),
      });
    }
    if (String(url).endsWith("/admin/email-reminders/run") && options.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          encontrados: 2,
          enviados: 0,
          dryRun: 1,
          omitidosDuplicado: 1,
          errores: 0,
          detalles: [
            {
              reminderType: "pending_document",
              entityType: "documento",
              entityId: "41",
              recipientEmail: "demo@example.com",
              status: "dry_run",
              reason: "safe-mode",
              error: "",
            },
            {
              reminderType: "upcoming_interview",
              entityType: "tramite",
              entityId: "21",
              recipientEmail: "carlos@example.com",
              status: "skipped",
              reason: "duplicate",
              error: "",
            },
          ],
        }),
      });
    }
    if (String(url).endsWith("/documentos/41/archivo")) {
      return Promise.resolve({
        ok: true,
        blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      });
    }
    if (String(url).endsWith("/admin/documents")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          documentos: [
            {
              id: 41,
              nombre: "pasaporte.pdf",
              tipo: "application/pdf",
              documento_key: "Pasaporte",
              estado: adminDocumentStatus,
              feedback: adminDocumentFeedback,
              creado_en: "2026-08-01T10:00:00.000Z",
              archivo_url: "http://localhost:8080/documentos/41/archivo",
              usuario: {
                nombre: "Usuario Demo",
                correo: "demo@example.com",
              },
            },
          ],
        }),
      });
    }
    if (String(url).endsWith("/admin/documents/41/status")) {
      const payload = JSON.parse(options.body || "{}");
      if (Object.prototype.hasOwnProperty.call(payload, "status")) {
        adminDocumentStatus = payload.status;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "feedback")) {
        adminDocumentFeedback = payload.feedback.trim();
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          message: payload.status
            ? "Estado del documento actualizado correctamente"
            : "Observaciones del documento actualizadas correctamente",
          documento: {
            id: 41,
            nombre: "pasaporte.pdf",
            tipo: "application/pdf",
            documento_key: "Pasaporte",
            estado: adminDocumentStatus,
            feedback: adminDocumentFeedback,
            creado_en: "2026-08-01T10:00:00.000Z",
            actualizado_en: "2026-08-02T10:00:00.000Z",
            archivo_url: "http://localhost:8080/documentos/41/archivo",
            usuario: {
              nombre: "Usuario Demo",
              correo: "demo@example.com",
            },
          },
        }),
      });
    }
    if (String(url).endsWith("/admin/processes") && (!options.method || options.method === "GET")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          tramites: [managedProcess],
          asesores: [{ id: 5, nombre: "Laura Vásquez", correo: "laura@visaguide.com" }],
        }),
      });
    }
    if (String(url).endsWith("/admin/processes/21/history") && (!options.method || options.method === "GET")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ history: processHistory }),
      });
    }
    if (String(url).endsWith("/admin/processes/21") && (!options.method || options.method === "GET")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          tramite: {
            ...managedProcess,
            createdAt: "2026-08-01T10:00:00.000Z",
            updatedAt: "2026-08-02T10:00:00.000Z",
          },
          solicitante: {
            id: 8,
            nombre: "Carlos Mendoza",
            correo: "carlos@example.com",
            perfil: "RenovaciÃ³n B1/B2",
            ciudad: "Ciudad de Guatemala",
            pais: "Guatemala",
            createdAt: "2026-07-20T10:00:00.000Z",
          },
          ds160: {
            id: 31,
            seccionActual: 4,
            completado: false,
            progreso: 40,
            estadoRevision: "en_progreso",
            resumen: [
              { key: "nombres", label: "Nombres", value: "Carlos" },
              { key: "numeroPasaporte", label: "Pasaporte", value: "A123456" },
            ],
          },
          documentos: [
            {
              id: 41,
              nombre: "pasaporte.pdf",
              tipo: "application/pdf",
              documento_key: "Pasaporte",
              estado: adminDocumentStatus,
              feedback: adminDocumentFeedback,
              archivo_url: "/documentos/41/archivo",
              creado_en: "2026-08-01T10:00:00.000Z",
            },
          ],
          entrevistas: [
            {
              id: 12,
              user_id: 8,
              user_name: "Carlos Mendoza",
              user_email: "carlos@example.com",
              status: "reviewed",
              responses: [{ id: "q1", text: "Motivo de viaje", recorded: true }],
              feedback: "Buena preparacion",
              rating: 4,
              created_at: "2026-08-03T10:00:00.000Z",
              reviewed_at: "2026-08-04T10:00:00.000Z",
            },
          ],
          notificaciones: [
            {
              id: 61,
              titulo: "Documento aprobado",
              mensaje: "Tu documento fue aprobado.",
              tipo: "documento",
              leido: false,
              createdAt: "2026-08-05T10:00:00.000Z",
            },
          ],
        }),
      });
    }
    if (String(url).endsWith("/admin/processes/21") && options.method === "PUT") {
      const payload = JSON.parse(options.body || "{}");
      managedProcess = {
        ...managedProcess,
        estado: payload.estado,
        etapaActual: payload.etapaActual,
        asesor: payload.asesorId ? { id: Number(payload.asesorId), nombre: "Laura Vásquez", correo: "laura@visaguide.com" } : null,
      };
      processHistory = [
        {
          id: processHistory.length + 1,
          processId: 21,
          fieldName: "estado",
          oldValue: "En proceso",
          newValue: payload.estado,
          changedAt: "2026-08-10T10:00:00.000Z",
          changedBy: { id: 1, nombre: "Admin General", correo: "admin@prueba.com" },
        },
        ...processHistory,
      ];
      return Promise.resolve({ ok: true, json: async () => ({ tramite: managedProcess }) });
    }
    if (String(url).includes("/admin/metrics/processes.xlsx")) {
      return Promise.resolve({
        ok: true,
        blob: async () => new Blob(["xlsx"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      });
    }
    if (String(url).includes("/admin/metrics/processes")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          totalTramites: 5,
          progresoPromedio: 46.4,
          completados: 1,
          sinAsignar: 2,
          totalActivas: 4,
          tiempoPromedioDias: 14,
          revisionesPendientes: 3,
          tasaExito: 20,
          porEstado: [{ label: "En proceso", total: 3 }, { label: "Aprobado", total: 1 }],
          porEtapa: [{ label: "Documentos", total: 2 }, { label: "Formulario DS-160", total: 2 }],
          cargaAsesores: [{ id: 5, nombre: "Laura Vásquez", asignados: 3, pendientes: 2 }],
          nuevasSolicitudes: [{ label: "2026-03", total: 1 }, { label: "2026-04", total: 2 }, { label: "2026-05", total: 3 }],
          documentosPorEstado: [{ label: "approved", total: 3 }, { label: "review", total: 1 }],
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ tramites_activos: 4, asesores: 2, ds160_pendientes: 6 }),
    });
  });
}

describe("panel de administracion", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockAdminSession();
  });

  it("muestra el dashboard principal en /admin", async () => {
    window.history.pushState({}, "", "/admin");

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Panel de Administración Global" })).toBeInTheDocument();
    expect(await screen.findByText("Solicitudes activas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sin asignar" })).toBeInTheDocument();
    expect(screen.getByText("Asesores activos")).toBeInTheDocument();
    expect(screen.getByText("DS-160 pendientes")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Métricas adicionales" })).toBeInTheDocument();
    expect(screen.getByText("Documentos pendientes")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entrevistas pendientes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pendientes por atender" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Actividad reciente" })).toBeInTheDocument();
    expect(screen.getByText("Nuevo usuario registrado")).toBeInTheDocument();
    const topActions = screen.getByRole("group", { name: "Notificaciones y perfil administrativo" });
    expect(within(topActions).getByRole("button", { name: "Notificaciones" })).toBeInTheDocument();
    expect(within(topActions).getByRole("link", { name: /Abrir perfil de/ })).toHaveAttribute("href", "/admin/profile");
    const validationCalls = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes("/validar-sesion"));
    expect(validationCalls).toHaveLength(1);
  });

  it("permite activar y conservar el modo oscuro desde el panel", async () => {
    window.history.pushState({}, "", "/admin/reports");
    const user = userEvent.setup();

    render(<App />);

    const themeButton = await screen.findByRole("button", { name: "Activar modo oscuro" });
    await user.click(themeButton);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("vg-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Activar modo claro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("permite colapsar el sidebar de escritorio y conserva el estado", async () => {
    window.history.pushState({}, "", "/admin");
    const user = userEvent.setup();

    const { unmount } = render(<App />);

    await screen.findByRole("heading", { name: "Panel de Administración Global" });
    await user.click(screen.getByRole("button", { name: "Colapsar menu administrativo" }));

    expect(localStorage.getItem("vg-admin-sidebar-collapsed")).toBe("true");
    expect(document.querySelector(".admin-sidebar")).toHaveClass("admin-sidebar--collapsed");
    expect(screen.getByRole("button", { name: "Expandir menu administrativo" })).toHaveAttribute("aria-expanded", "false");

    unmount();
    render(<App />);

    await screen.findByRole("heading", { name: "Panel de Administración Global" });
    expect(document.querySelector(".admin-sidebar")).toHaveClass("admin-sidebar--collapsed");
    await user.click(screen.getByRole("button", { name: "Expandir menu administrativo" }));

    expect(localStorage.getItem("vg-admin-sidebar-collapsed")).toBe("false");
    expect(document.querySelector(".admin-sidebar")).not.toHaveClass("admin-sidebar--collapsed");
    expect(screen.getByRole("button", { name: "Colapsar menu administrativo" })).toHaveAttribute("aria-expanded", "true");
  });

  it("presenta la navegación administrativa en el orden del prototipo", async () => {
    window.history.pushState({}, "", "/admin");

    render(<App />);

    await screen.findByRole("heading", { name: "Panel de Administración Global" });

    const navigation = screen.getByRole("navigation", { name: /Modulos de administracion/ });
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent.trim())).toEqual([
      "Inicio",
      "Todas las solicitudes",
      "Asesores",
      "Usuarios",
      "Asignaciones",
      "Documentos",
      "Formularios DS-160",
      "Entrevistas",
      "Pagos y citas",
      "Banco de preguntas",
      "Reportes",
      "Actividad",
      "Recordatorios",
      "Configuración",
    ]);
    expect(screen.getByRole("link", { name: /Mi perfil/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cerrar sesi/ })).toBeInTheDocument();
  });

  it("muestra la consulta de logs de actividad", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/activity-logs");

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Logs de Actividad" })).toBeInTheDocument();
    expect(await screen.findByText("user.login")).toBeInTheDocument();
    expect(screen.getByText("cliente@example.com")).toBeInTheDocument();
    await user.click(screen.getByText("Ver detalles"));
    expect(screen.getByText("127.0.0.1")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/activity-logs?"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${adminSession.token}` }),
      })
    );
  });

  it("rechaza una sesión local fabricada con correo de administrador", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 1,
      nombre: "Admin falso",
      correo: "admin@prueba.com",
      rol: "admin",
    }));
    window.history.pushState({}, "", "/admin");

    render(<App />);

    await waitFor(() => expect(localStorage.getItem("visaguide_session")).toBeNull());
    expect(screen.queryByRole("heading", { name: "Panel de Administración Global" })).not.toBeInTheDocument();
    expect(globalThis.fetch.mock.calls.filter(([url]) => String(url).includes("/validar-sesion"))).toHaveLength(0);
  });

  it("lista, busca, filtra y edita usuarios, e impide que el admin se auto-bloquee", async () => {
    window.history.pushState({}, "", "/admin/users");
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Usuarios" })).toBeInTheDocument();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Admin General")).toBeInTheDocument();
    expect(within(table).getByText("Cliente Prueba")).toBeInTheDocument();
    expect(within(table).getByText("Laura Vásquez")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "laura");
    expect(within(table).queryByText("Cliente Prueba")).not.toBeInTheDocument();
    expect(within(table).getByText("Laura Vásquez")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Buscar" }));

    await user.click(screen.getByRole("tab", { name: "Asesor" }));
    expect(within(table).queryByText("Cliente Prueba")).not.toBeInTheDocument();
    expect(within(table).getByText("Laura Vásquez")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Todos" }));

    const adminRow = within(table).getByText("Admin General").closest("tr");
    expect(within(adminRow).getByRole("button", { name: "Desactivar" })).toBeDisabled();
    await user.click(within(adminRow).getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("combobox", { name: /Rol/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    const clientRow = within(table).getByText("Cliente Prueba").closest("tr");
    await user.click(within(clientRow).getByRole("button", { name: "Editar" }));
    const nameInput = screen.getByLabelText("Nombre");
    await user.clear(nameInput);
    await user.type(nameInput, "Cliente Editado");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Cliente Editado")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument();
  });

  it("muestra DS-160, documentos y entrevistas en el detalle de un usuario solicitante", async () => {
    window.history.pushState({}, "", "/admin/users/8");

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Detalle de Usuario" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Carlos Mendoza" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /DS-160/ })).toBeInTheDocument();
    expect(screen.getByText("Nombres")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documentos" })).toBeInTheDocument();
    expect(screen.getByText("pasaporte.pdf")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entrevistas" })).toBeInTheDocument();
    expect(screen.getByText("Buena preparacion")).toBeInTheDocument();
  });

  it("permite desactivar las notificaciones automáticas desde configuración", async () => {
    window.history.pushState({}, "", "/admin/settings");
    const user = userEvent.setup();

    render(<App />);

    await screen.findByDisplayValue("VisaGuide");
    await user.click(screen.getByRole("button", { name: /Notificaciones automáticas/ }));

    const toggle = await screen.findByRole("checkbox", { name: /Activar notificaciones automáticas/ });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Configuración guardada.")).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it.each([
    ["/admin/users", "Usuarios"],
    ["/admin/advisors", "Asesores"],
    ["/admin/assignments", "Asignaciones"],
    ["/admin/documents", "Documentos Globales"],
    ["/admin/ds160", "DS-160 Globales"],
    ["/admin/interviews", "Entrevistas"],
    ["/admin/questions", "Banco de preguntas"],
    ["/admin/processes", "Todas las solicitudes"],
    ["/admin/reports", "Reportes y Analíticas"],
    ["/admin/email-reminders", "Recordatorios por email"],
    ["/admin/settings", "Configuración"],
    ["/admin/profile", "Mi Perfil"],
  ])("carga la ruta base %s", async (path, pageTitle) => {
    window.history.pushState({}, "", path);

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: pageTitle })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: pageTitle })).toHaveLength(1);
    if (path === "/admin/documents") {
      expect(screen.getByRole("columnheader", { name: "Documento" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Solicitante" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Asesor" })).toBeInTheDocument();
      expect(await screen.findByText("Usuario Demo")).toBeInTheDocument();
      expect(screen.getByText("Pasaporte")).toBeInTheDocument();
      expect(screen.getByText("En revisión", { selector: ".admin-status" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ver revisión" })).toBeInTheDocument();
    } else if (path === "/admin/ds160") {
      expect(await screen.findByText("Usuario Demo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ver formulario" })).toBeInTheDocument();
    } else if (path === "/admin/interviews") {
      expect(await screen.findByText("Usuario Demo")).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Cita" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Preparación" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ver entrevista" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Entrevistas/ })).toHaveClass("admin-sidebar__link--active");
      expect(screen.queryByRole("heading", { name: "Banco de Preguntas" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Nueva pregunta" })).not.toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Buscar" })).toBeInTheDocument();
    } else if (path === "/admin/processes") {
      expect(await screen.findByText("Carlos Mendoza")).toBeInTheDocument();
      expect(screen.getByText("Renovación B1/B2")).toBeInTheDocument();
      expect(screen.getByText("Sin asignar")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute("href", "/admin/processes/21");
      expect(screen.getByRole("button", { name: "Gestionar" })).toBeInTheDocument();
    } else if (path === "/admin/reports") {
      expect(await screen.findByText("Total activas")).toBeInTheDocument();
      expect(screen.getByText("Tiempo promedio")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Nuevas solicitudes por mes" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Solicitudes por etapa" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Estado de Documentos" })).toBeInTheDocument();
    } else if (path === "/admin/email-reminders") {
      expect(screen.getByRole("button", { name: "Ejecutar recordatorios" })).toBeInTheDocument();
    } else if (path === "/admin/users") {
      expect(await screen.findByText("Cliente Prueba")).toBeInTheDocument();
      expect(screen.getByText("Laura Vásquez")).toBeInTheDocument();
    } else if (path === "/admin/settings") {
      expect(await screen.findByDisplayValue("VisaGuide")).toBeInTheDocument();
    }
  });

  it("filtra reportes por fechas personalizadas y exporta el mismo rango en Excel", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:reporte-xlsx");
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    window.history.pushState({}, "", "/admin/reports");

    render(<App />);

    await screen.findByText("Total activas");
    await user.selectOptions(screen.getByLabelText("Periodo"), "custom");
    await user.clear(screen.getByLabelText("Desde"));
    await user.type(screen.getByLabelText("Desde"), "2026-07-01");
    await user.clear(screen.getByLabelText("Hasta"));
    await user.type(screen.getByLabelText("Hasta"), "2026-07-31");

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/metrics/processes?from=2026-07-01&to=2026-07-31"),
      expect.any(Object)
    ));

    await user.click(screen.getByRole("button", { name: "Exportar Excel" }));
    expect(await screen.findByText("Reporte de Excel exportado correctamente.")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/metrics/processes.xlsx?from=2026-07-01&to=2026-07-31"),
      expect.any(Object)
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:reporte-xlsx");
    clickSpy.mockRestore();
  });

  it("ejecuta recordatorios por email desde el panel admin", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/email-reminders");

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Recordatorios por email" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ejecutar recordatorios" }));

    expect(await screen.findByText("Encontrados")).toBeInTheDocument();
    expect(screen.getAllByText("Dry run").length).toBeGreaterThan(0);
    expect(screen.getByText("Duplicados")).toBeInTheDocument();
    expect(screen.getByText("demo@example.com")).toBeInTheDocument();
    expect(screen.getByText("carlos@example.com")).toBeInTheDocument();
    expect(screen.getByText("safe-mode")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/email-reminders/run"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${adminSession.token}` }),
      })
    );
  });

  it("permite filtrar y desactivar preguntas desde el panel", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/questions");

    render(<App />);

    expect(await screen.findByText("¿Cuál es el propósito de su viaje?")).toBeInTheDocument();
    expect(screen.getByText("¿Quién financiará su viaje?")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Estado"), "active");
    expect(screen.queryByText("¿Quién financiará su viaje?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(await screen.findByText("Pregunta desactivada correctamente.")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/questions/10/status"),
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("confirma y elimina preguntas desde el panel", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/questions");

    render(<App />);

    await screen.findByText("¿Quién financiará su viaje?");
    await user.click(screen.getByRole("button", { name: "Eliminar pregunta: ¿Quién financiará su viaje?" }));
    const dialog = screen.getByRole("alertdialog", { name: "Eliminar pregunta" });
    expect(within(dialog).getByText("¿Quién financiará su viaje?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Eliminar pregunta" }));

    expect(await screen.findByText("Pregunta eliminada correctamente.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("¿Quién financiará su viaje?")).not.toBeInTheDocument());
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/questions/11"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("permite asignar un asesor y actualizar un trámite", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/processes");

    render(<App />);

    expect(await screen.findByText("Carlos Mendoza")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gestionar" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Asesor asignado"), "5");
    await user.selectOptions(within(dialog).getByLabelText("Estado"), "Pendiente");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Laura Vásquez")).toBeInTheDocument();
    expect(screen.getByText("Pendiente", { selector: ".admin-status" })).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/processes/21"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("muestra el detalle consolidado de una solicitud administrativa", async () => {
    window.history.pushState({}, "", "/admin/processes/21");

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Detalle de Solicitud" })).toBeInTheDocument();
    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Formulario DS-160").length).toBeGreaterThan(0);
    expect(screen.getByText("Documentos aprobados")).toBeInTheDocument();
    expect(screen.getAllByText("1/1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pasaporte").length).toBeGreaterThan(0);
    expect(screen.getByText("Documento ilegible.")).toBeInTheDocument();
    expect(screen.getAllByText("Buena preparacion").length).toBeGreaterThan(0);
    expect(screen.getByText("Documento aprobado")).toBeInTheDocument();
    const historySection = screen.getByRole("heading", { name: "Historial de cambios" }).closest("section");
    expect(within(historySection).getByText("Estado")).toBeInTheDocument();
    expect(within(historySection).getByText("Pendiente")).toBeInTheDocument();
    expect(within(historySection).getByText("admin@prueba.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gestionar tramite" })).toHaveAttribute("href", "/admin/processes");
    expect(screen.getAllByRole("link", { name: "Ver documentos" })[0]).toHaveAttribute("href", "/admin/documents");
    expect(screen.getAllByRole("link", { name: "Revisar entrevistas" })[0]).toHaveAttribute("href", "/admin/interviews");
  });

  it("permite navegar desde el sidebar", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin");

    render(<App />);

    await screen.findByRole("heading", { name: "Panel de Administración Global" });
    const navigation = screen.getByRole("navigation", { name: /Modulos de administracion/ });
    await user.click(within(navigation).getByRole("link", { name: /Usuarios/ }));

    await waitFor(() => expect(window.location.pathname).toBe("/admin/users"));
    expect(screen.getAllByRole("heading", { name: "Usuarios" })).toHaveLength(1);
  });

  it("abre la revisión DS-160 y guarda el estado desde el detalle", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/ds160");

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Ver formulario" }));
    const dialog = screen.getByRole("dialog", { name: "Usuario Demo" });
    await user.selectOptions(within(dialog).getByLabelText("Estado de revisión"), "aprobado");
    await user.click(within(dialog).getByRole("button", { name: "Guardar revisión" }));

    expect(await screen.findByText("Formulario actualizado.")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/ds160/31"),
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ estado: "aprobado" }) })
    );
  });

  it("abre una entrevista desde la tabla y la cierra con Escape", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/interviews");

    render(<App />);

    const trigger = await screen.findByRole("button", { name: "Ver entrevista" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Usuario Demo" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Usuario Demo" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("permite aprobar un documento sin recargar la pagina", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/documents");

    render(<App />);

    expect(await screen.findByText("Usuario Demo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver revisión" }));
    await user.click(screen.getByRole("button", { name: "Aprobar" }));

    expect(await screen.findByText("Documento aprobado correctamente.")).toBeInTheDocument();
    expect(screen.getByText("Aprobado", { selector: ".admin-status" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/admin/documents");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/documents/41/status"),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("abre documentos con la URL del backend y evita navegar por React Router", async () => {
    const user = userEvent.setup();
    const previewWindow = {
      opener: {},
      location: { href: "" },
      document: { title: "", body: { textContent: "" } },
    };
    const createObjectURL = vi.fn(() => "blob:documento-preview");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => previewWindow);
    window.history.pushState({}, "", "/admin/documents");

    render(<App />);

    expect(await screen.findByText("Usuario Demo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver revisión" }));
    await user.click(screen.getByRole("button", { name: "Ver documento" }));

    expect(openSpy).toHaveBeenCalledWith(
      "about:blank",
      "_blank"
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/localhost:3000\/documentos\/41\/archivo$/),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${adminSession.token}` }),
      })
    ));
    await waitFor(() => expect(previewWindow.location.href).toBe("blob:documento-preview"));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(window.location.pathname).toBe("/admin/documents");
  });

  it("permite editar y guardar observaciones administrativas", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/documents");

    render(<App />);

    await screen.findByText("Usuario Demo");
    await user.click(screen.getByRole("button", { name: "Ver revisión" }));

    const feedbackInput = await screen.findByRole("textbox", {
      name: "Comentario para el usuario",
    });
    expect(feedbackInput).toHaveValue("Documento ilegible.");
    await user.clear(feedbackInput);
    await user.type(feedbackInput, "Falta la segunda pagina.");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Observaciones guardadas correctamente.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Revisión de documento" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/admin/documents");

    const feedbackCall = globalThis.fetch.mock.calls.find(([url, options]) =>
      String(url).includes("/admin/documents/41/status") &&
      JSON.parse(options?.body || "{}").feedback === "Falta la segunda pagina."
    );
    expect(JSON.parse(feedbackCall[1].body)).toEqual({
      feedback: "Falta la segunda pagina.",
    });

    await user.click(screen.getByRole("button", { name: "Ver revisión" }));
    expect(await screen.findByDisplayValue("Falta la segunda pagina.")).toBeInTheDocument();
  });

  it("rechaza un documento usando el estado de correccion que entiende el cliente", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/documents");

    render(<App />);

    expect(await screen.findByText("Usuario Demo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver revisión" }));
    await user.click(screen.getByRole("button", { name: "Rechazar" }));

    expect(await screen.findByText("Documento rechazado correctamente.")).toBeInTheDocument();
    expect(screen.getByText(/Correcci/, { selector: ".admin-status" })).toBeInTheDocument();

    const statusCall = globalThis.fetch.mock.calls.find(([url]) =>
      String(url).includes("/admin/documents/41/status")
    );
    expect(JSON.parse(statusCall[1].body)).toEqual({ status: "correction" });
  });

  it("navega entre Dashboard y Entrevistas desde el sidebar", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin");

    render(<App />);

    await screen.findByRole("heading", { name: "Panel de Administración Global" });
    const navigation = screen.getByRole("navigation", { name: /Modulos de administracion/ });
    await user.click(within(navigation).getByRole("link", { name: /Entrevistas/ }));

    await waitFor(() => expect(window.location.pathname).toBe("/admin/interviews"));
    expect(screen.getByRole("heading", { level: 1, name: "Entrevistas" })).toBeInTheDocument();
    expect((await screen.findAllByText("Usuario Demo")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("link", { name: /^Inicio$/ }));

    await waitFor(() => expect(window.location.pathname).toBe("/admin"));
    expect(screen.getByRole("heading", { name: "Panel de Administración Global" })).toBeInTheDocument();
  });
});
