import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Cronologia from "../pages/Cronologia";

const authState = vi.hoisted(() => ({
  isValidating: false,
  session: {
    id: 7,
    nombre: "Ana López",
    correo: "ana@example.com",
    perfil: "turismo_negocios",
  },
}));

const workflowState = vi.hoisted(() => ({
  workflow: { assigned: true, gates: { ds160: { allowed: true } } },
  isLoading: false,
}));

vi.mock("../hooks/useRequireAuth", () => ({
  default: () => authState,
}));

vi.mock("../hooks/useModoSenior", () => ({
  default: () => false,
}));

vi.mock("../hooks/useClientWorkflow", () => ({
  default: () => workflowState,
}));

vi.mock("../components/Sidebar", () => ({
  default: ({ currentPage }) => <nav data-testid="sidebar">{currentPage}</nav>,
}));

describe("Cronologia", () => {
  beforeEach(() => {
    Object.assign(authState, {
      isValidating: false,
      session: {
        id: 7,
        nombre: "Ana López",
        correo: "ana@example.com",
        perfil: "turismo_negocios",
      },
    });
    Object.assign(workflowState, {
      workflow: { assigned: true, gates: { ds160: { allowed: true } } },
      isLoading: false,
    });
  });

  it("usa la misma etapa dinámica del dashboard e incluye subir documentos después del DS-160", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/estado-tramite")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ progreso: 34, etapaActual: "Pago de visa" }),
        });
      }

      if (requestUrl.includes("/ds160")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ seccion_actual: 10, completado: true }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 1, estado: "review" }],
      });
    });

    render(<Cronologia />);

    expect(await screen.findByRole("heading", { name: "Subir documentos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Subir documentos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pago de visa" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Revisión experta/i })).not.toBeInTheDocument();
  });

  it("muestra hablar con el asesor en la etapa de pago", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/estado-tramite")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ progreso: 50, etapaActual: "Pago de visa" }),
        });
      }

      if (requestUrl.includes("/ds160")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ seccion_actual: 10, completado: true }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 1, estado: "approved" },
          { id: 2, estado: "approved" },
          { id: 3, estado: "approved" },
          { id: 4, estado: "approved" },
        ],
      });
    });

    render(<Cronologia />);

    expect(await screen.findByRole("heading", { name: "Pago de visa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hablar con el asesor/i })).toBeInTheDocument();
  });

  it("sin asesor explica la espera y no consulta ni habilita el DS-160", async () => {
    workflowState.workflow = { assigned: false, gates: { ds160: { allowed: false } } };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/estado-tramite")) {
        return Promise.resolve({ ok: true, json: async () => ({ progreso: 17 }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<Cronologia />);

    expect(await screen.findByText(/esperando asignación de asesor/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/ds160"))).toBe(false);
    expect(screen.queryByRole("button", { name: /DS-160/i })).not.toBeInTheDocument();
  });
});
