import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import NotificationCenter from "../components/NotificationCenter";

const notification = {
  id: 41,
  titulo: "Perfil actualizado",
  mensaje: "Tus datos fueron guardados.",
  leido: false,
  action_url: null,
};

describe("NotificationCenter", () => {
  it("marca como leído y retira del panel un aviso sin ruta de acción", async () => {
    const user = userEvent.setup();
    const updateEvent = vi.fn();
    window.addEventListener("notificacionesLeidas", updateEvent);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notificaciones: [notification] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(
      <MemoryRouter>
        <NotificationCenter userId={7} unreadCount={1} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /abrir notificaciones/i }));
    await user.click(await screen.findByRole("button", { name: "Leer: Perfil actualizado" }));

    await waitFor(() => expect(screen.queryByText("Perfil actualizado")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/notificaciones/41/leer"),
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ userId: 7 }) })
    );
    expect(updateEvent).toHaveBeenCalledTimes(1);
    window.removeEventListener("notificacionesLeidas", updateEvent);
  });

  it("conserva el aviso visible y muestra un error si la actualización falla", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notificaciones: [notification] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    render(
      <MemoryRouter>
        <NotificationCenter userId={7} unreadCount={1} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /abrir notificaciones/i }));
    await user.click(await screen.findByRole("button", { name: "Leer: Perfil actualizado" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo marcar la notificación como leída.");
    expect(screen.getByText("Perfil actualizado")).toBeInTheDocument();
  });
});
