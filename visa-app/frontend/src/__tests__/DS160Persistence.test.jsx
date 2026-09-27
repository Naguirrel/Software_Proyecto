import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DS160Form from "../pages/ds160";

describe("DS-160 navigation persistence", () => {
  it("persiste la nueva sección al avanzar", async () => {
    const user = userEvent.setup();
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 7,
      token: "signed-session-token",
      nombre: "Usuario Prueba",
      correo: "usuario@example.com",
      perfil: "turismo_negocios",
    }));
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    const datos = {
      apellidos: "Perez",
      nombres: "Juana",
      otrosNombres: "No",
      fechaNacimiento: "1990-01-01",
      lugarNacimiento: "Guatemala",
      paisNacimiento: "Guatemala",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/validar-sesion")) {
        return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
      }
      if (requestUrl.includes("/ds160/load")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ datos, seccion_actual: 1, completado: false }),
        });
      }
      if (requestUrl.includes("/notificaciones/")) {
        return Promise.resolve({ ok: true, json: async () => ({ total: 0 }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <DS160Form />
      </MemoryRouter>
    );

    await screen.findByText(/Sección 1: Datos Personales/);
    await user.click(screen.getByRole("button", { name: "Siguiente →" }));

    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(([url, options]) => {
        const requestUrl = String(url);
        return requestUrl.endsWith("/ds160") && options?.method === "POST";
      });
      expect(saveCall).toBeDefined();
      expect(JSON.parse(saveCall[1].body)).toMatchObject({ seccion_actual: 2 });
    });
  });
});
