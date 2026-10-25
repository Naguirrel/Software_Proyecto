import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "../components/Sidebar";

vi.mock("../hooks/useTheme", () => ({
  default: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

vi.mock("../components/TopActions", () => ({
  default: ({ userId, unreadCount }) => (
    <div data-testid="top-actions">{userId}:{unreadCount}</div>
  ),
}));

vi.mock("../hooks/useClientWorkflow", () => ({
  default: () => ({
    workflow: {
      assigned: true,
      gates: {
        ds160: { allowed: true },
        payment: { allowed: true },
        appointment: { allowed: true },
        interview: { allowed: true },
        chat: { allowed: true },
      },
    },
  }),
}));

const renderSidebar = (currentPage = "inicio") =>
  render(
    <MemoryRouter>
      <Sidebar currentPage={currentPage} />
    </MemoryRouter>
  );

describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 12,
      nombre: "Ana López",
      correo: "ana@example.com",
      perfil: "turismo_negocios",
      rol: "cliente",
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ total: 3 }),
    });
  });

  it("renderiza las opciones, rutas y datos del usuario dentro del router", async () => {
    renderSidebar();

    const expectedLinks = [
      ["Inicio", "/dashboard"],
      ["DS-160", "/ds160"],
      ["Cronología", "/cronologia"],
      ["Documentos", "/documents"],
      ["Entrevista", "/entrevista"],
      ["Chat con asesor", "/chat"],
    ];

    expectedLinks.forEach(([name, href]) => {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    });
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("Aplicante a visa B1/B2")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("top-actions")).toHaveTextContent("12:3"));
  });

  it("mantiene perfil, tema y salida fuera del área desplazable al minimizar la barra", () => {
    renderSidebar();

    const sidebar = document.querySelector(".vg-sidebar");
    const footer = sidebar.querySelector(":scope > .vg-sidebar-bottom-section");
    expect(footer).toBeInTheDocument();
    expect(sidebar.querySelector(".vg-sidebar-content")).not.toContainElement(footer);
    expect(footer).toContainElement(screen.getByRole("link", { name: /Abrir perfil de Ana López/i }));
    expect(footer).toContainElement(screen.getByRole("button", { name: "Activar modo oscuro" }));
    expect(footer).toContainElement(screen.getByRole("button", { name: "Cerrar sesión" }));
  });

  it("identifica visualmente la opción activa", () => {
    renderSidebar("documentos");

    expect(screen.getByRole("link", { name: "Documentos" })).toHaveStyle({
      backgroundColor: "var(--vg-navy)",
      color: "rgb(255, 255, 255)",
    });
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveStyle({
      backgroundColor: "var(--vg-navy)",
    });
  });

  it("no muestra el aviso de verificación cuando el correo ya está verificado", () => {
    renderSidebar();

    expect(screen.queryByText("Verifica tu correo electrónico")).not.toBeInTheDocument();
  });

  it("muestra el aviso de verificación y permite reenviar el enlace", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 12,
      nombre: "Ana López",
      correo: "ana@example.com",
      perfil: "turismo_negocios",
      rol: "cliente",
      emailVerificado: false,
    }));
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/reenviar-verificacion")) {
        return Promise.resolve({ ok: true, json: async () => ({ message: "ok" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ total: 0 }) });
    });

    renderSidebar();

    expect(screen.getByText("Verifica tu correo electrónico")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar enlace" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Enlace enviado" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/reenviar-verificacion"), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ correo: "ana@example.com" }),
    }));
  });

  it("permite cerrar el aviso de verificación", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 12,
      nombre: "Ana López",
      correo: "ana@example.com",
      emailVerificado: false,
      rol: "cliente",
    }));
    const user = userEvent.setup();

    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Cerrar aviso de verificación" }));

    expect(screen.queryByText("Verifica tu correo electrónico")).not.toBeInTheDocument();
  });

  it("muestra un error y permite reintentar si el reenvío falla", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 12,
      nombre: "Ana López",
      correo: "ana@example.com",
      emailVerificado: false,
      rol: "cliente",
    }));
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/reenviar-verificacion")) {
        return Promise.resolve({ ok: false, json: async () => ({ error: "falló" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ total: 0 }) });
    });

    renderSidebar();
    await user.click(screen.getByRole("button", { name: "Reenviar enlace" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument());
    expect(screen.getByText("No se pudo enviar el enlace. Intenta de nuevo.")).toBeInTheDocument();
  });

  it("refleja en la sesión abierta que el correo se verificó en otra pestaña", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 12,
      nombre: "Ana López",
      correo: "ana@example.com",
      emailVerificado: false,
      rol: "cliente",
    }));

    renderSidebar();
    expect(screen.getByText("Verifica tu correo electrónico")).toBeInTheDocument();

    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 12,
      nombre: "Ana López",
      correo: "ana@example.com",
      emailVerificado: true,
      rol: "cliente",
    }));
    window.dispatchEvent(new StorageEvent("storage", { key: "visaguide_session" }));

    await waitFor(() => expect(screen.queryByText("Verifica tu correo electrónico")).not.toBeInTheDocument());
  });

  it("deja la expansión al hover y permite activar el modo Senior", async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.queryByRole("button", { name: /barra lateral/i })).not.toBeInTheDocument();

    const senior = screen.getByRole("button", { name: "Alternar modo Senior" });
    expect(screen.getByText("Modo Senior · desactivado")).toHaveClass("vg-sidebar-label");
    await user.click(senior);
    expect(senior).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Modo Senior · activado")).toHaveClass("vg-sidebar-label");
    expect(localStorage.getItem("modoSenior")).toBe("true");
    expect(document.documentElement).toHaveClass("modo-senior");
    expect(screen.getByText("Modo Senior activado")).toBeInTheDocument();

    await user.click(senior);
    expect(screen.getByText("Modo Senior desactivado")).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass("modo-senior");
  });

  it("agranda iconos y filas en modo Senior y se sincroniza si cambia en otra pestaña", async () => {
    renderSidebar();
    const inicio = screen.getByRole("link", { name: "Inicio" });
    expect(inicio.querySelector("svg")).toHaveAttribute("width", "20");

    localStorage.setItem("modoSenior", "true");
    window.dispatchEvent(new StorageEvent("storage", { key: "modoSenior" }));

    await waitFor(() => expect(inicio.querySelector("svg")).toHaveAttribute("width", "28"));
    expect(inicio).toHaveStyle({ minHeight: "56px" });
    expect(screen.getByRole("button", { name: "Alternar modo Senior" })).toHaveAttribute("aria-pressed", "true");
  });
});
