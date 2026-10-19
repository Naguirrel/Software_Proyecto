import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { buildApiUrl } from "../config/api";
import { getPasswordError, MIN_PASSWORD_LENGTH, PASSWORD_HINT } from "../utils/passwordPolicy";

// SP10-05: mínimo 8 caracteres, con letras y números, en registro y restablecimiento.

describe("getPasswordError", () => {
  it("el mínimo es 8 y el texto de ayuda lo explica", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(PASSWORD_HINT).toBe("Mínimo 8 caracteres, con letras y números.");
  });

  it.each(["clave1234", "abcdefg1", "1234567a", "Contraseña2026", "ñandú1234", "Clave-segura-123"])(
    "acepta %s",
    (password) => expect(getPasswordError(password)).toBe("")
  );

  it.each([
    ["abc123", "al menos 8 caracteres"],
    ["abcdef1", "al menos 8 caracteres"],
    ["", "al menos 8 caracteres"],
    ["12345678", "al menos una letra"],
    ["1234-5678", "al menos una letra"],
    ["abcdefgh", "al menos un número"],
    ["abcd-efgh", "al menos un número"],
  ])("rechaza %j indicando qué falta", (password, expected) => {
    expect(getPasswordError(password)).toContain(expected);
  });

  it("no acepta valores que no son texto", () => {
    expect(getPasswordError(undefined)).toContain("al menos 8 caracteres");
    expect(getPasswordError(null)).toContain("al menos 8 caracteres");
  });
});

describe("formularios de registro y restablecimiento", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function fillRegistration(user, contrasena) {
    await user.type(screen.getByLabelText("Nombre completo"), "Ana López");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), contrasena);
    await user.type(screen.getByLabelText("Confirmar contraseña"), contrasena);
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));
  }

  it("el registro muestra la regla de la contraseña y la asocia al campo", () => {
    window.history.pushState({}, "", "/registro");

    render(<App />);

    expect(screen.getByText(PASSWORD_HINT)).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription(PASSWORD_HINT);
    expect(screen.getByLabelText("Confirmar contraseña")).not.toHaveAttribute("aria-describedby");
  });

  it.each([
    ["abcdef1", "al menos 8 caracteres"],
    ["12345678", "al menos una letra"],
    ["abcdefgh", "al menos un número"],
  ])("el registro rechaza %s con un mensaje claro y no envía nada", async (contrasena, message) => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    window.history.pushState({}, "", "/registro");

    render(<App />);
    await fillRegistration(user, contrasena);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el registro envía una contraseña que cumple la política", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "El correo ya está registrado" }),
    });
    window.history.pushState({}, "", "/registro");

    render(<App />);
    await fillRegistration(user, "abcdefg1");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/register"), expect.objectContaining({
      body: JSON.stringify({ nombre: "Ana López", correo: "ana@example.com", contrasena: "abcdefg1" }),
    })));
  });

  it("el registro muestra el mensaje del servidor si rechaza la contraseña", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "La contraseña debe tener al menos 8 caracteres e incluir letras y números" }),
    });
    window.history.pushState({}, "", "/registro");

    render(<App />);
    await fillRegistration(user, "clave1234");

    expect(await screen.findByRole("alert")).toHaveTextContent("al menos 8 caracteres e incluir letras y números");
  });

  it("el restablecimiento muestra la regla y rechaza contraseñas débiles sin enviar nada", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    window.history.pushState({}, "", "/restablecer-contrasena?token=abc123");

    render(<App />);
    expect(screen.getByLabelText("Nueva contraseña")).toHaveAccessibleDescription(PASSWORD_HINT);

    for (const [contrasena, message] of [["abcdef1", "al menos 8 caracteres"], ["12345678", "al menos una letra"], ["abcdefgh", "al menos un número"]]) {
      await user.clear(screen.getByLabelText("Nueva contraseña"));
      await user.clear(screen.getByLabelText("Confirmar contraseña"));
      await user.type(screen.getByLabelText("Nueva contraseña"), contrasena);
      await user.type(screen.getByLabelText("Confirmar contraseña"), contrasena);
      await user.click(screen.getByRole("button", { name: /Guardar contraseña/i }));
      expect(screen.getByRole("alert")).toHaveTextContent(message);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
