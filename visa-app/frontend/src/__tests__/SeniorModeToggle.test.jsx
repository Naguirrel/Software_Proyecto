import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import SeniorModeToggle from "../components/SeniorModeToggle";

describe("SeniorModeToggle", () => {
  beforeEach(() => {
    localStorage.setItem("visaguide_session", JSON.stringify({ id: 7, rol: "cliente" }));
  });

  it("expone el estado, lo persiste y anuncia cada cambio", async () => {
    const user = userEvent.setup();
    render(<SeniorModeToggle showState />);

    const toggle = screen.getByRole("button", { name: "Activar modo senior" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("Modo senior · desactivado");

    await user.click(toggle);

    expect(toggle).toHaveAccessibleName("Desactivar modo senior");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveTextContent("Modo senior · activado");
    expect(screen.getByRole("status")).toHaveTextContent("Modo senior activado");
    expect(localStorage.getItem("modoSenior")).toBe("true");
    expect(document.documentElement).toHaveClass("modo-senior");
    expect(document.documentElement).toHaveAttribute("data-ui-mode", "senior");
  });

  it("respeta una preferencia persistida al montarse", () => {
    localStorage.setItem("modoSenior", "true");

    render(<SeniorModeToggle />);

    expect(screen.getByRole("button", { name: "Desactivar modo senior" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
