import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { buildApiUrl } from "../config/api";

describe("pantallas de autenticación", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirige la ruta raíz al login", async () => {
    window.history.pushState({}, "", "/");

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("mantiene el login real y permite mostrar la contraseña", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    window.history.pushState({}, "", "/login");

    render(<App />);

    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");

    await user.type(screen.getByLabelText("Correo electrónico"), "persona@example.com");
    await user.type(password, "secreto");
    await user.click(screen.getByRole("button", { name: /Ingresar/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
      "El correo o la contraseña son incorrectos. Verifica tus datos e intenta de nuevo."
    ));
    expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: "persona@example.com", contrasena: "secreto" }),
    });
  });

  it("renderiza el login y bloquea envíos con campos vacíos o correo inválido", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    window.history.pushState({}, "", "/login");

    render(<App />);

    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ingresar/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Ingresar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("El correo es obligatorio");

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@dominio");
    await user.click(screen.getByRole("button", { name: /Ingresar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresa un correo válido");

    await user.clear(screen.getByLabelText("Correo electrónico"));
    await user.type(screen.getByLabelText("Correo electrónico"), "persona@example.com");
    await user.click(screen.getByRole("button", { name: /Ingresar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("La contraseña es obligatoria");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirige a /admin usando el rol entregado por el backend", async () => {
    const user = userEvent.setup();
    const loggedUser = {
      id: 1,
      nombre: "Admin General",
      correo: "admin@prueba.com",
      rol: "admin",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).endsWith("/login")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, usuario: loggedUser, token: "signed-admin-token" }),
        });
      }
      if (String(url).includes("/validar-sesion")) {
        return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ questions: [], sessions: [] }) });
    });
    window.history.pushState({}, "", "/login");

    render(<App />);

    await user.type(document.querySelector("#login-correo"), loggedUser.correo);
    await user.type(document.querySelector("#login-contrasena"), "123456");
    await user.click(screen.getByRole("button", { name: /Ingresar/i }));

    await waitFor(() => expect(window.location.pathname).toBe("/admin"));
    expect(JSON.parse(localStorage.getItem("visaguide_session"))).toMatchObject({
      id: 1,
      correo: loggedUser.correo,
      rol: "admin",
    });
  });

  it("guarda la sesión cuando el login responde correctamente", async () => {
    const user = userEvent.setup();
    const loggedUser = {
      id_usuario: 8,
      nombre: "Mario Gómez",
      correo: "mario@example.com",
      perfil: null,
      rol: "cliente",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).endsWith("/login")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, usuario: loggedUser, token: "signed-client-token" }),
        });
      }
      if (String(url).includes("/validar-sesion")) {
        return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    window.history.pushState({}, "", "/login");

    render(<App />);

    await user.type(document.querySelector("#login-correo"), loggedUser.correo);
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    await user.click(screen.getByRole("button", { name: /Ingresar/i }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("visaguide_session"))).toMatchObject({
        id: loggedUser.id_usuario,
        nombre: loggedUser.nombre,
        correo: loggedUser.correo,
        perfil: null,
        rol: "cliente",
      });
    });
    expect(localStorage.getItem("correoUsuario")).toBe(loggedUser.correo);
    expect(window.location.pathname).toBe("/seleccion-perfil");
    expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: loggedUser.correo, contrasena: "secreto" }),
    });
  });

  it("conserva validación, autocomplete y envío real del registro", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "duplicate key" }),
    });
    window.history.pushState({}, "", "/registro");

    render(<App />);

    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveAttribute("autocomplete", "new-password");

    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("El nombre es obligatorio");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Nombre completo"), "Ana López");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "clave123");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Este correo ya está registrado"));
    expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Ana López", correo: "ana@example.com", contrasena: "clave123" }),
    });
  });

  it("valida correo, longitud y confirmación de contraseña antes de registrar", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    window.history.pushState({}, "", "/registro");

    render(<App />);

    await user.type(screen.getByLabelText("Nombre completo"), "Ana López");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@dominio");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresa un correo válido");

    await user.clear(screen.getByLabelText("Correo electrónico"));
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "123");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("al menos 4 caracteres");

    await user.clear(screen.getByLabelText("Contraseña"));
    await user.type(screen.getByLabelText("Contraseña"), "clave123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "otra-clave");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Las contraseñas no coinciden");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("guarda la sesión después del registro y continúa a selección de perfil", async () => {
    const user = userEvent.setup();
    const newUser = {
      id_usuario: 42,
      nombre: "Ana López",
      correo: "ana@example.com",
      perfil: null,
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).endsWith("/register")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: newUser, token: "signed-registration-token" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
    });
    window.history.pushState({}, "", "/registro");

    render(<App />);

    await user.type(screen.getByLabelText("Nombre completo"), newUser.nombre);
    await user.type(screen.getByLabelText("Correo electrónico"), newUser.correo);
    await user.type(screen.getByLabelText("Contraseña"), "clave123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "clave123");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));

    await waitFor(() => expect(window.location.pathname).toBe("/seleccion-perfil"));
    expect(JSON.parse(localStorage.getItem("visaguide_session"))).toMatchObject({
      id: 42,
      nombre: newUser.nombre,
      correo: newUser.correo,
      perfil: null,
    });
    expect(localStorage.getItem("correoUsuario")).toBe(newUser.correo);
  });

  it("avisa que se envió un correo de verificación y guarda emailVerificado en la sesión", async () => {
    const user = userEvent.setup();
    const newUser = {
      id_usuario: 42,
      nombre: "Ana López",
      correo: "ana@example.com",
      perfil: null,
      emailVerificado: false,
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).endsWith("/register")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: newUser, token: "signed-registration-token" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
    });
    window.history.pushState({}, "", "/registro");

    render(<App />);

    await user.type(screen.getByLabelText("Nombre completo"), newUser.nombre);
    await user.type(screen.getByLabelText("Correo electrónico"), newUser.correo);
    await user.type(screen.getByLabelText("Contraseña"), "clave123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "clave123");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/i }));

    await waitFor(() => expect(window.location.pathname).toBe("/seleccion-perfil"));
    expect(JSON.parse(localStorage.getItem("visaguide_session"))).toMatchObject({
      emailVerificado: false,
    });
  });

  it("verifica el correo con el token del enlace y actualiza la sesión", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 42, correo: "ana@example.com", emailVerificado: false,
    }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Correo verificado correctamente", usuario: { emailVerificado: true } }),
    });
    window.history.pushState({}, "", "/verificar-email?token=abc123");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Correo verificado correctamente"));
    expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/verificar-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "abc123" }),
    });
    expect(JSON.parse(localStorage.getItem("visaguide_session"))).toMatchObject({ emailVerificado: true });
  });

  it("muestra un error cuando el enlace de verificación es inválido", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "El enlace de verificación es inválido o expiró" }),
    });
    window.history.pushState({}, "", "/verificar-email?token=vencido");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
      "El enlace de verificación es inválido o expiró"
    ));
  });

  it("permite solicitar la recuperación de contraseña desde el login", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/login");

    render(<App />);

    await user.click(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" }));

    await waitFor(() => expect(window.location.pathname).toBe("/recuperar-contrasena"));
    expect(screen.getByRole("heading", { name: "Recuperar contraseña" })).toBeInTheDocument();
  });

  it("valida el correo y envía la solicitud de recuperación de contraseña", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña." }),
    });
    window.history.pushState({}, "", "/recuperar-contrasena");

    render(<App />);

    await user.click(screen.getByRole("button", { name: /Enviar enlace/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("El correo es obligatorio");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Correo electrónico"), "persona@example.com");
    await user.click(screen.getByRole("button", { name: /Enviar enlace/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña."
    ));
    expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/forgot-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: "persona@example.com" }),
    });
  });

  it("valida la nueva contraseña y la envía junto al token del enlace", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Contraseña actualizada correctamente" }),
    });
    window.history.pushState({}, "", "/restablecer-contrasena?token=abc123");

    render(<App />);

    await user.type(screen.getByLabelText("Nueva contraseña"), "clave123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "otra-clave");
    await user.click(screen.getByRole("button", { name: /Guardar contraseña/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Las contraseñas no coinciden");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Confirmar contraseña"));
    await user.type(screen.getByLabelText("Confirmar contraseña"), "clave123");
    await user.click(screen.getByRole("button", { name: /Guardar contraseña/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/reset-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "abc123", nuevaContrasena: "clave123" }),
    }));
    expect(screen.getByRole("status")).toHaveTextContent("Contraseña actualizada correctamente");
  });

  it("muestra el error del servidor cuando el token de restablecimiento es inválido", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "El enlace de recuperación es inválido o expiró" }),
    });
    window.history.pushState({}, "", "/restablecer-contrasena?token=vencido");

    render(<App />);

    await user.type(screen.getByLabelText("Nueva contraseña"), "clave123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "clave123");
    await user.click(screen.getByRole("button", { name: /Guardar contraseña/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
      "El enlace de recuperación es inválido o expiró"
    ));
  });

  it.each([
    ["/login", "turismo_negocios", "/dashboard"],
    ["/registro", "turismo_negocios", "/dashboard"],
    ["/login", null, "/seleccion-perfil"],
    ["/registro", null, "/seleccion-perfil"],
  ])("redirige una sesión válida desde %s según su perfil", async (route, perfil, destination) => {
    localStorage.setItem("correoUsuario", "sesion@example.com");
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: 7,
      nombre: "Usuario Sesión",
      correo: "sesion@example.com",
      perfil,
      token: "signed-session-token",
    }));
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/validar-sesion")) {
        return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    window.history.pushState({}, "", route);

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe(destination));
  });

  it("muestra el aviso de cuenta bloqueada y no lo oculta automáticamente", async () => {
    const user = userEvent.setup();
    const lockMessage = "Tu cuenta está bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en 15 minutos o usa el enlace que enviamos a tu correo para desbloquearla.";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 423,
      json: async () => ({ error: lockMessage, minutosRestantes: 15 }),
    });
    window.history.pushState({}, "", "/login");

    render(<App />);

    await user.type(screen.getByLabelText("Correo electrónico"), "persona@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "secreto");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await user.click(screen.getByRole("button", { name: /Ingresar/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(lockMessage));
    vi.advanceTimersByTime(6000);
    expect(screen.getByRole("alert")).toHaveTextContent(lockMessage);
    vi.useRealTimers();
  });

  it("desbloquea la cuenta con el enlace del correo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Tu cuenta fue desbloqueada. Ya puedes iniciar sesión." }),
    });
    window.history.pushState({}, "", "/desbloquear-cuenta?token=abc123");

    render(<App />);

    expect(await screen.findByText("Tu cuenta fue desbloqueada. Ya puedes iniciar sesión.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/desbloquear-cuenta"), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ token: "abc123" }),
    }));
    expect(screen.getByRole("link", { name: "Ir a iniciar sesión" })).toBeInTheDocument();
  });

  it("explica cuando el enlace de desbloqueo es inválido y ofrece restablecer la contraseña", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "El enlace de desbloqueo es inválido o expiró" }),
    });
    window.history.pushState({}, "", "/desbloquear-cuenta?token=vencido");

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("El enlace de desbloqueo es inválido o expiró");
    expect(screen.getByRole("link", { name: "Restablecer mi contraseña" })).toHaveAttribute("href", "/recuperar-contrasena");
  });

  it("no llama al backend si el enlace de desbloqueo no trae token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    window.history.pushState({}, "", "/desbloquear-cuenta");

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("El enlace de desbloqueo no es válido.");
    expect(fetchMock).not.toHaveBeenCalledWith(buildApiUrl("/desbloquear-cuenta"), expect.anything());
  });
});
