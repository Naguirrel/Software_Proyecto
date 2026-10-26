import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdvisorRelationshipCard from "../components/AdvisorRelationshipCard";
import { apiRequest } from "../utils/apiClient";

vi.mock("../utils/apiClient", () => ({ apiRequest: vi.fn() }));
vi.mock("../components/ProfileAvatar", () => ({
  default: ({ name }) => <span data-testid="profile-avatar">Avatar de {name}</span>,
}));

const advisor = {
  id: 9,
  name: "Laura Asesora",
  email: "laura@example.com",
  phone: "+502 5555 0101",
  avatarVersion: 1,
};

describe("AdvisorRelationshipCard", () => {
  beforeEach(() => apiRequest.mockReset());

  test("muestra al asesor y permite enviar una solicitud explicada", async () => {
    const user = userEvent.setup();
    apiRequest
      .mockResolvedValueOnce({ advisor, request: null })
      .mockResolvedValueOnce({ request: { id: 44, status: "pending" } });

    render(<MemoryRouter><AdvisorRelationshipCard /></MemoryRouter>);

    expect(await screen.findByText("Laura Asesora")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir chat" })).toHaveAttribute("href", "/chat");
    await user.click(screen.getByRole("button", { name: /solicitar cambio de asesor/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Motivo principal" }), "poor_communication");
    await user.type(
      screen.getByRole("textbox", { name: "Explicación" }),
      "No he recibido respuesta durante varios días y necesito continuar."
    );
    await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));

    expect(apiRequest).toHaveBeenLastCalledWith("/advisor-change-requests", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        category: "poor_communication",
        message: "No he recibido respuesta durante varios días y necesito continuar.",
      }),
    }));
    expect(await screen.findByText("Pendiente de revisión administrativa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /solicitar cambio/i })).not.toBeInTheDocument();
  });

  test("mantiene bloqueado un segundo envío mientras existe una solicitud pendiente", async () => {
    apiRequest.mockResolvedValue({
      advisor,
      request: { id: 44, status: "pending", resolution: "" },
    });

    render(<MemoryRouter><AdvisorRelationshipCard /></MemoryRouter>);

    expect(await screen.findByText("Pendiente de revisión administrativa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /solicitar cambio/i })).not.toBeInTheDocument();
  });
});
