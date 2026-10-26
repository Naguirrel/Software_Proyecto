import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AdvisorSessionProvider } from "../components/advisor/AdvisorSessionContext";
import AdvisorLayout from "../components/advisor/AdvisorLayout";
import AdvisorDashboard from "../pages/advisor/AdvisorDashboard";
import { advisorRequest } from "../utils/advisorApi";

vi.mock("../utils/advisorApi", () => ({ advisorRequest: vi.fn() }));
vi.mock("../utils/advisorNotificationStream", () => ({
  consumeAdvisorNotificationStream: vi.fn(({ signal, onOpen }) => {
    onOpen?.();
    return new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  }),
}));

const dashboardData = {
  stats: { activeProcesses: 3, pendingDocuments: 2, pendingDs160: 1, pendingInterviews: 4, pendingTasks: 2, unreadMessages: 1 },
  attention: [{
    id: 12,
    estado: "Pendiente",
    etapaActual: "Formulario DS-160",
    solicitante: { nombre: "Ana López", correo: "ana@example.com", perfil: "Estudiante F1" },
  }],
  activity: [],
  workQueue: [],
};

function renderAdvisor(path = "/advisor") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdvisorSessionProvider value={{ id: 9, nombre: "Laura Vásquez", rol: "asesor" }}>
        <Routes>
          <Route path="/advisor" element={<AdvisorLayout />}>
            <Route index element={<AdvisorDashboard />} />
            <Route path="solicitudes" element={<h1>Mis solicitudes</h1>} />
            <Route path="solicitudes/:id" element={<h1>Detalle de solicitud</h1>} />
            <Route path="perfil" element={<h1>Mi perfil</h1>} />
          </Route>
        </Routes>
      </AdvisorSessionProvider>
    </MemoryRouter>,
  );
}

describe("panel de asesor", () => {
  beforeEach(() => {
    advisorRequest.mockReset();
    advisorRequest.mockImplementation(async (path) => {
      if (path === "/dashboard") return dashboardData;
      if (path === "/notifications") return { notifications: [], unreadCount: 0, hasMore: false };
      if (path === "/notifications/preferences/current") {
        return { preferences: { advisor_id: 9, sound_enabled: false, muted_types: [] } };
      }
      if (path === "/processes") {
        return {
          processes: [{
            id: 12,
            etapaActual: "Formulario DS-160",
            solicitante: { nombre: "Ana López", correo: "ana@example.com", perfil: "Estudiante F1" },
          }],
        };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
  });

  test("muestra métricas y solicitudes asignadas", async () => {
    renderAdvisor();

    expect(await screen.findByRole("heading", { name: "Panel de asesoría" })).toBeInTheDocument();
    expect(screen.getByText("Solicitudes activas")).toBeInTheDocument();
    expect(screen.getByText("Documentos pendientes")).toBeInTheDocument();
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("Estudiante F1")).toBeInTheDocument();
    await waitFor(() => expect(advisorRequest).toHaveBeenCalledWith("/dashboard", expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });

  test("incluye navegación para los ocho módulos", async () => {
    renderAdvisor();

    await screen.findByText("Solicitudes activas");
    for (const label of ["Inicio", "Mis solicitudes", "Documentos", "Formularios DS-160", "Entrevistas", "Chat", "Tareas", "Banco de preguntas"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  test("mantiene la navegación compacta sin control de expansión", async () => {
    renderAdvisor();

    await screen.findByText("Solicitudes activas");
    const navigation = screen.getByRole("complementary", { name: "Navegación del panel de asesor" });
    expect(navigation).toHaveClass("admin-sidebar--collapsed");
    expect(screen.queryByRole("button", { name: /menú de asesor/i })).not.toBeInTheDocument();
  });

  test("destaca el acceso al perfil cuando su ruta está activa", async () => {
    renderAdvisor("/advisor/perfil");

    await screen.findByRole("heading", { name: "Mi perfil" });
    const profileLink = screen.getAllByRole("link", { name: "Mi perfil" })[0];
    expect(profileLink).toHaveAttribute("aria-current", "page");
    expect(profileLink).toHaveClass("admin-sidebar__profile--active");
  });

  test("permite abrir una solicitud desde la búsqueda global usando el teclado", async () => {
    const user = userEvent.setup();
    renderAdvisor();
    const search = screen.getByRole("combobox", { name: "Buscar solicitante" });

    await user.click(search);
    await user.type(search, "Ana");
    expect(await screen.findByRole("option", { name: /Ana López/ })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(await screen.findByRole("heading", { name: "Detalle de solicitud" })).toBeInTheDocument();
  });
});
