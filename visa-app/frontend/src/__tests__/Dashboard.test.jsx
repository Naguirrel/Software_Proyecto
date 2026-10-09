import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../pages/Dashboard";

const user = userEvent.setup();

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

describe("Dashboard", () => {
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

  it("muestra la información principal y los datos del usuario", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/estado-tramite")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            progreso: 34,
            etapaActual: "Pago de visa",
            siguientePaso: "Realizar el pago de la tarifa de visa",
          }),
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
        json: async () => [{ id: 1, estado: "correction" }],
      });
    });

    render(<Dashboard />);

    expect(await screen.findByRole("heading", { name: "¡Hola, Ana!" })).toBeInTheDocument();
    expect(screen.getByText("Continuemos con tu solicitud de visa B1/B2.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Progreso general" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Corregir ahora/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Corregir documentos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisión de documentos/i })).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("1", { selector: ".dash-stat-card__value" })).toBeInTheDocument();
    expect(screen.getByText("Subir documentos")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/estado-tramite"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ correo: "ana@example.com" }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("envía el token de sesión al cargar el DS-160 y muestra el porcentaje guardado", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({ ...authState.session, token: "token-ana" }));
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/ds160/load")) {
        // El backend exige sesión: sin Authorization responde 401.
        if (options.headers?.Authorization !== "Bearer token-ana") {
          return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: "No autorizado" }) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ datos: {}, seccion_actual: 6, completado: false }),
        });
      }

      return Promise.resolve({ ok: true, json: async () => (requestUrl.includes("/documentos") ? [] : {}) });
    });

    render(<Dashboard />);

    expect(await screen.findByText("50%", { selector: ".dash-stat-card__value" })).toBeInTheDocument();
    expect(screen.queryByText(/no pudieron actualizarse/i)).not.toBeInTheDocument();
  });

  it("muestra el aviso de verificación cuando el correo no está verificado y permite reenviarlo", async () => {
    authState.session = { ...authState.session, emailVerificado: false };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/reenviar-verificacion")) {
        return Promise.resolve({ ok: true, json: async () => ({ message: "ok" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Dashboard />);

    expect(await screen.findByText("Verifica tu correo electrónico")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar enlace" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Enlace enviado" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/reenviar-verificacion"), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ correo: "ana@example.com" }),
    }));
  });

  it("no muestra el aviso de verificación cuando el correo ya está verificado", async () => {
    authState.session = { ...authState.session, emailVerificado: true };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<Dashboard />);

    await screen.findByRole("heading", { name: "¡Hola, Ana!" });
    expect(screen.queryByText("Verifica tu correo electrónico")).not.toBeInTheDocument();
  });

  it("usa valores seguros cuando no hay datos del usuario ni del trámite", async () => {
    authState.session = { id: 8, correo: "sin-datos@example.com", perfil: null };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<Dashboard />);

    expect(await screen.findByRole("heading", { name: "¡Hola, Usuario!" })).toBeInTheDocument();
    expect(screen.getByText("Continuemos con tu solicitud de visa B1/B2.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("1", { selector: ".dash-etapa-num" })).toBeInTheDocument());
  });

  it("presenta el estado de carga mientras se valida la sesión", () => {
    authState.isValidating = true;
    authState.session = null;

    render(<Dashboard />);

    expect(screen.getByTestId("sidebar")).toHaveTextContent("inicio");
    expect(document.querySelectorAll(".sk-shimmer").length).toBeGreaterThan(0);
  });

  it("limita la etapa al rango válido cuando el backend devuelve progreso excesivo", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/estado-tramite")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ progreso: 180 }),
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

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText("7", { selector: ".dash-etapa-num" })).toBeInTheDocument()
    );
    expect(screen.getByText("100%", { selector: ".dash-ring-pct" })).toBeInTheDocument();
  });
});
