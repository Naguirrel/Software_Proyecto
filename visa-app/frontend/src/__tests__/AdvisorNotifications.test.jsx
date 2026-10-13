import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdvisorNotificationCenter from "../components/advisor/AdvisorNotificationCenter";
import AdvisorNotificationToasts from "../components/advisor/AdvisorNotificationToasts";
import { AdvisorNotificationsProvider } from "../components/advisor/AdvisorNotificationsContext";
import { advisorRequest } from "../utils/advisorApi";
import { consumeAdvisorNotificationStream, parseSseFrame } from "../utils/advisorNotificationStream";

vi.mock("../utils/advisorApi", () => ({ advisorRequest: vi.fn() }));
vi.mock("../utils/advisorNotificationStream", async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, consumeAdvisorNotificationStream: vi.fn() };
});

const notification = {
  id: 11,
  id_usuario: 9,
  titulo: "Documento nuevo",
  mensaje: "Ana subió su pasaporte.",
  tipo: "documento",
  leido: false,
  archivado: false,
  action_url: "/advisor/documentos?document=31",
  created_at: "2026-10-12T15:00:00.000Z",
};

function renderNotifications() {
  return render(
    <MemoryRouter>
      <AdvisorNotificationsProvider>
        <AdvisorNotificationCenter />
        <AdvisorNotificationToasts />
      </AdvisorNotificationsProvider>
    </MemoryRouter>,
  );
}

describe("notificaciones en tiempo real del asesor", () => {
  let streamCallbacks;

  beforeEach(() => {
    streamCallbacks = null;
    advisorRequest.mockReset();
    advisorRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/notifications") return { notifications: [], unreadCount: 0, hasMore: false };
      if (path === "/notifications/preferences/current" && !options.method) {
        return { preferences: { advisor_id: 9, sound_enabled: false, muted_types: [] } };
      }
      if (path === "/notifications/11/read" && options.method === "PUT") {
        return { notification: { ...notification, leido: true } };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    consumeAdvisorNotificationStream.mockImplementation(({ signal, onEvent, onOpen }) => {
      streamCallbacks = { onEvent, onOpen };
      onOpen?.();
      return new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
    });
  });

  test("interpreta eventos SSE con datos multilínea", () => {
    expect(parseSseFrame("id: 8\nevent: notification\ndata: {\"id\":8,\ndata: \"tipo\":\"chat\"}"))
      .toEqual({ event: "notification", id: "8", data: { id: 8, tipo: "chat" } });
  });

  test("muestra un aviso entrante, actualiza el contador y permite marcarlo como leído", async () => {
    const user = userEvent.setup();
    renderNotifications();
    await waitFor(() => expect(streamCallbacks).not.toBeNull());

    act(() => streamCallbacks.onEvent({ event: "notification", data: notification }));

    expect(await screen.findByLabelText("Avisos nuevos")).toHaveTextContent("Documento nuevo");
    const trigger = screen.getByRole("button", { name: "Abrir notificaciones, 1 sin leer" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Notificaciones" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Ana subió su pasaporte.")).toBeInTheDocument();

    await user.click(dialog.querySelector(".advisor-notification-content"));
    await waitFor(() => expect(advisorRequest).toHaveBeenCalledWith("/notifications/11/read", { method: "PUT" }));
  });
});
