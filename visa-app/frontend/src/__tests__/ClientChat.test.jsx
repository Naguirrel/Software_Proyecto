import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Chat from "../pages/Chat";
import { apiRequest } from "../utils/apiClient";

vi.mock("../components/Sidebar", () => ({ default: () => <nav aria-label="Navegación" /> }));
vi.mock("../hooks/useRequireAuth", () => ({ default: () => ({ isValidating: false, session: { nombre: "Ana", rol: "cliente" } }) }));
vi.mock("../hooks/useModoSenior", () => ({ default: () => false }));
vi.mock("../utils/apiClient", () => ({ apiRequest: vi.fn() }));

const assignment = {
  id_usuario: 5,
  id_asesor: 9,
  advisor_name: "Laura",
  perfil: "Turismo",
  estado: "En proceso",
  etapa_actual: "Formulario DS-160",
};

describe("chat del cliente", () => {
  beforeEach(() => { apiRequest.mockReset(); });
  afterEach(() => vi.useRealTimers());

  test("muestra al asesor real y recibe respuestas incrementales", async () => {
    vi.useFakeTimers();
    apiRequest.mockImplementation(async (path) => {
      if (path.includes("afterId=1")) {
        return { assignment, messages: [{ id: 2, sender: "advisor", message: "Respuesta nueva", createdAt: "2026-10-05T18:01:00.000Z" }] };
      }
      if (path === "/chat?limit=50") {
        return { assignment, messages: [{ id: 1, sender: "client", message: "Mi consulta", createdAt: "2026-10-05T18:00:00.000Z" }], hasMoreBefore: false };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });

    render(<MemoryRouter><Chat /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByPlaceholderText("Escribe tu mensaje a Laura…")).toBeInTheDocument();
    expect(screen.getByText("Mi consulta")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(screen.getByText("Respuesta nueva")).toBeInTheDocument();
  });
});
