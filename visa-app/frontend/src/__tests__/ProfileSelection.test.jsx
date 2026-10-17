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

    render(<ProfileSelection />);

    await waitFor(() =>
      expect(screen.getByText("Turismo / Negocios (B1/B2)")).toBeInTheDocument()
    );

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
});
