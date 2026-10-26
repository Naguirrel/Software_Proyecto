import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProfileSelection from "../pages/ProfileSelection/ProfileSelection";
import { buildApiUrl } from "../config/api";

describe("ProfileSelection", () => {
  it("permite seleccionar un perfil y guardarlo contra el endpoint real configurado", async () => {
    const user = userEvent.setup();
    localStorage.setItem("correoUsuario", "norman@example.com");
    localStorage.setItem(
      "visaguide_session",
      JSON.stringify({
        id: 1,
        token: "signed-session-token",
        nombre: "Norman Aguirre",
        correo: "norman@example.com",
        rol: "cliente",
      })
    );

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/validar-sesion")) {
        return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
      }

      if (String(url).endsWith("/guardar-perfil")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            message: "Perfil guardado correctamente",
            user: { perfil: "turismo_negocios" },
          }),
        });
      }

      return Promise.resolve({ ok: true, json: async () => ({ total: 0 }) });
    });

    const { container } = render(<ProfileSelection />);

    await waitFor(() =>
      expect(screen.getByText("Turismo / Negocios (B1/B2)")).toBeInTheDocument()
    );

    expect(container.querySelector('[data-icon="visaguide-mark"]')).toBeInTheDocument();
    [
      "visa-tourism-business",
      "visa-student",
      "visa-renewal",
      "visa-family",
      "senior-glasses",
    ].forEach((iconName) => {
      expect(container.querySelector(`[data-icon="${iconName}"]`)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Turismo / Negocios (B1/B2)"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(screen.getByText("¡Perfil seleccionado con éxito!")).toBeInTheDocument()
    );
    expect(localStorage.getItem("perfilUsuario")).toBe("turismo_negocios");
    expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/guardar-perfil"), expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer signed-session-token" },
      body: JSON.stringify({ perfil: "turismo_negocios" }),
    }));
  });

  it("activa Senior solo al elegir Adulto Mayor y no muestra un interruptor manual", async () => {
    const user = userEvent.setup();
    localStorage.setItem("modoSenior", "true");
    localStorage.setItem(
      "visaguide_session",
      JSON.stringify({
        id: 2,
        token: "signed-session-token",
        nombre: "Cliente de prueba",
        correo: "cliente@example.com",
        rol: "cliente",
      })
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ valid: true }),
    });

    render(<ProfileSelection />);

    await waitFor(() => expect(screen.getByText("Adulto Mayor (asistencia accesible)")).toBeInTheDocument());
    await waitFor(() => expect(document.documentElement).not.toHaveClass("modo-senior"));
    expect(screen.queryByRole("button", { name: /^Modo senior ·/i })).not.toBeInTheDocument();

    await user.click(screen.getByText("Adulto Mayor (asistencia accesible)"));
    expect(document.documentElement).toHaveClass("modo-senior");
    expect(localStorage.getItem("modoSenior")).toBe("true");

    await user.click(screen.getByText("Estudiante (F/M)"));
    expect(document.documentElement).not.toHaveClass("modo-senior");
    expect(localStorage.getItem("modoSenior")).toBe("false");
  });
});
