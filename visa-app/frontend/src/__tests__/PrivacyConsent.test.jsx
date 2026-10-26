import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { buildApiUrl } from "../config/api";
import {
  PRIVACY_NOTICE_SECTIONS,
  PRIVACY_NOTICE_UPDATED,
  PRIVACY_NOTICE_VERSION,
} from "../config/privacyNotice";

// SP10-12: página de aviso de privacidad y casilla obligatoria en el registro.

const CONSENT_LABEL = /aviso de privacidad/i;

async function fillRegistration(user, { check = false } = {}) {
  await user.type(screen.getByLabelText("Nombre completo"), "Ana López");
  await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
  await user.type(screen.getByLabelText("Contraseña"), "clave1234");
  await user.type(screen.getByLabelText("Confirmar contraseña"), "clave1234");
  if (check) await user.click(screen.getByRole("checkbox", { name: CONSENT_LABEL }));
}

describe("aviso de privacidad (página pública)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("se abre sin iniciar sesión en /privacidad y muestra título, versión y fecha", async () => {
    window.history.pushState({}, "", "/privacidad");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Aviso de privacidad" })).toBeInTheDocument();
    expect(screen.getByText(`Versión ${PRIVACY_NOTICE_VERSION} · Vigente desde el ${PRIVACY_NOTICE_UPDATED}`)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra todas las secciones del aviso con su contenido", async () => {
    window.history.pushState({}, "", "/privacidad");

    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Aviso de privacidad" });

    expect(PRIVACY_NOTICE_SECTIONS.length).toBeGreaterThanOrEqual(7);
    for (const section of PRIVACY_NOTICE_SECTIONS) {
      expect(screen.getByRole("heading", { level: 2, name: section.title })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Qué datos recopilamos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tus derechos" })).toBeInTheDocument();
    expect(screen.getByText(/No vendemos tus datos personales/)).toBeInTheDocument();
  });

  it("ofrece volver al registro o ir al inicio de sesión", async () => {
    window.history.pushState({}, "", "/privacidad");

    render(<App />);

    expect(await screen.findByRole("link", { name: "Volver al registro" })).toHaveAttribute("href", "/registro");
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
  });

  it("la versión mostrada es la que se envía al registrarse", () => {
    expect(PRIVACY_NOTICE_VERSION).toBe("1.0");
  });
});

describe("registro con aviso de privacidad", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/registro");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("muestra la casilla sin marcar con un enlace al aviso que se abre en otra pestaña", () => {
    render(<App />);

    const checkbox = screen.getByRole("checkbox", { name: CONSENT_LABEL });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute("aria-required", "true");
    const link = within(checkbox.closest(".auth-consent")).getByRole("link", { name: /aviso de privacidad/i });
    expect(link).toHaveAttribute("href", "/privacidad");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAccessibleName(/se abre en una pestaña nueva/);
  });

  it("no deja registrarse sin aceptar: muestra el motivo, marca el campo y no envía nada", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<App />);

    await fillRegistration(user);
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Debes aceptar el aviso de privacidad para crear tu cuenta");
    const checkbox = screen.getByRole("checkbox", { name: CONSENT_LABEL });
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox.closest(".auth-consent")).toHaveClass("auth-consent--error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("al marcar la casilla se quita el estado de error", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch");
    render(<App />);
    await fillRegistration(user);
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));

    await user.click(screen.getByRole("checkbox", { name: CONSENT_LABEL }));

    const checkbox = screen.getByRole("checkbox", { name: CONSENT_LABEL });
    expect(checkbox).toBeChecked();
    expect(checkbox).not.toHaveAttribute("aria-invalid");
    expect(checkbox.closest(".auth-consent")).not.toHaveClass("auth-consent--error");
  });

  it("al aceptar envía el consentimiento con la versión del aviso", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "El correo ya está registrado" }),
    });
    render(<App />);

    await fillRegistration(user, { check: true });
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/register"), expect.objectContaining({ method: "POST" })));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      nombre: "Ana López",
      correo: "ana@example.com",
      contrasena: "clave1234",
      acepta_privacidad: true,
      version_privacidad: PRIVACY_NOTICE_VERSION,
    });
  });

  it("el error de contraseña se muestra antes que el de privacidad", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<App />);

    await user.type(screen.getByLabelText("Nombre completo"), "Ana López");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "abc");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "abc");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("al menos 8 caracteres");
    expect(screen.getByRole("checkbox", { name: CONSENT_LABEL })).not.toHaveAttribute("aria-invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra el mensaje del servidor si el aviso cambió mientras se registraba", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "El aviso de privacidad cambió. Recarga la página y acéptalo de nuevo" }),
    });
    render(<App />);

    await fillRegistration(user, { check: true });
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El aviso de privacidad cambió");
  });
});
