import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AdvisorSessionProvider } from "../components/advisor/AdvisorSessionContext";
import AdvisorDashboard from "../pages/advisor/AdvisorDashboard";
import { advisorRequest } from "../utils/advisorApi";

vi.mock("../utils/advisorApi", () => ({ advisorRequest: vi.fn() }));

const dashboardData = {
  stats: { activeProcesses: 3, pendingDocuments: 2, pendingDs160: 1, pendingInterviews: 4 },
  attention: [{
    id: 12,
    estado: "Pendiente",
    etapaActual: "Formulario DS-160",
    solicitante: { nombre: "Ana López", correo: "ana@example.com", perfil: "Estudiante F1" },
  }],
  activity: [],
};

describe("panel de asesor", () => {
  beforeEach(() => {
    localStorage.removeItem("vg-advisor-sidebar-collapsed");
    advisorRequest.mockReset();
    advisorRequest.mockResolvedValue(dashboardData);
  });

  test("muestra métricas y solicitudes asignadas", async () => {
    render(
      <MemoryRouter initialEntries={["/advisor"]}>
        <AdvisorSessionProvider value={{ id: 9, nombre: "Laura Vásquez", rol: "asesor" }}>
          <AdvisorDashboard />
        </AdvisorSessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Panel de asesoría" })).toBeInTheDocument();
    expect(screen.getByText("Solicitudes activas")).toBeInTheDocument();
    expect(screen.getByText("Documentos pendientes")).toBeInTheDocument();
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("Estudiante F1")).toBeInTheDocument();
    await waitFor(() => expect(advisorRequest).toHaveBeenCalledWith("/dashboard", expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });

  test("incluye navegación para los ocho módulos", async () => {
    render(
      <MemoryRouter initialEntries={["/advisor"]}>
        <AdvisorSessionProvider value={{ id: 9, nombre: "Laura Vásquez", rol: "asesor" }}>
          <AdvisorDashboard />
        </AdvisorSessionProvider>
      </MemoryRouter>,
    );

    await screen.findByText("Solicitudes activas");
    for (const label of ["Inicio", "Mis solicitudes", "Documentos", "Formularios DS-160", "Entrevistas", "Chat", "Tareas", "Banco de preguntas"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  test("inicia con la navegación compacta y permite fijarla expandida", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/advisor"]}>
        <AdvisorSessionProvider value={{ id: 9, nombre: "Laura Vásquez", rol: "asesor" }}>
          <AdvisorDashboard />
        </AdvisorSessionProvider>
      </MemoryRouter>,
    );

    await screen.findByText("Solicitudes activas");
    const navigation = screen.getByRole("complementary", { name: "Navegación del panel de asesor" });
    expect(navigation).toHaveClass("admin-sidebar--collapsed");

    await user.click(screen.getByRole("button", { name: "Expandir menú de asesor" }));
    expect(navigation).not.toHaveClass("admin-sidebar--collapsed");
    expect(localStorage.getItem("vg-advisor-sidebar-collapsed")).toBe("false");
  });

  test("mantiene el acceso al perfil con estilo neutro en su ruta", async () => {
    render(
      <MemoryRouter initialEntries={["/advisor/perfil"]}>
        <AdvisorSessionProvider value={{ id: 9, nombre: "Laura Vásquez", rol: "asesor" }}>
          <AdvisorDashboard />
        </AdvisorSessionProvider>
      </MemoryRouter>,
    );

    await screen.findByText("Solicitudes activas");
    const profileLink = screen.getAllByRole("link", { name: "Mi perfil" })[0];
    expect(profileLink).toHaveAttribute("aria-current", "page");
    expect(profileLink).not.toHaveClass("admin-sidebar__link--active");
  });
});
