import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../pages/Dashboard";
import Cronologia from "../pages/Cronologia";
import Perfil from "../pages/Perfil/Perfil";
import ProfileSelection from "../pages/ProfileSelection/ProfileSelection";
import useRequireAuth from "../hooks/useRequireAuth";

// Regresión SP10-02: Dashboard, Cronología, Perfil y Selección de perfil identifican al usuario
// con el token de sesión (Authorization) y nunca con el correo ni con un id enviado en la petición.
// Son pruebas del cliente con fetch simulado: no sustituyen una prueba real contra el backend.

const CORREO = "ana@example.com";
const TOKEN = "token-ana";

vi.mock("../hooks/useModoSenior", () => ({ default: () => false }));
vi.mock("../components/Sidebar", () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock("../hooks/useClientWorkflow", () => ({
  default: () => ({
    workflow: { assigned: true, gates: { ds160: { allowed: true } }, requirements: {}, currentStep: "profile" },
    isLoading: false,
    error: "",
    retry: vi.fn(),
  }),
}));

const perfilPayload = {
  usuario: {
    id: 7,
    nombre: "Ana López",
    correo: CORREO,
    telefono: "",
    ciudad: "",
    pais: "",
    perfil: "turismo_negocios",
    preferencias: { notificacionesEmail: true, idioma: "es" },
  },
  tramite: { tipoVisa: "B1/B2", consulado: "Sin definir", estado: "En proceso", etapaActual: "Pago de visa", etapa: 3, totalEtapas: 6, activo: true },
};

function storeSession(extra = {}) {
  localStorage.setItem(
    "visaguide_session",
    JSON.stringify({ id: 7, nombre: "Ana López", correo: CORREO, perfil: "turismo_negocios", token: TOKEN, ...extra })
  );
}

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
const fail = (status, body = {}) => Promise.resolve({ ok: false, status, json: async () => body });

// fetch simulado: /validar-sesion válido y el resto según el manejador.
function mockApi(handler) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    if (path.startsWith("/validar-sesion")) return ok({ valid: true });
    return handler(path, options);
  });
}

function dataCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([url]) => !String(url).includes("/validar-sesion"));
}

function expectSessionOnly(calls) {
  expect(calls.length).toBeGreaterThan(0);
  for (const [url, options] of calls) {
    expect(options.headers.Authorization, String(url)).toBe(`Bearer ${TOKEN}`);
    const sent = `${url} ${options.body ?? ""}`;
    expect(sent, String(url)).not.toContain(CORREO);
    expect(sent, String(url)).not.toMatch(/correo|usuario_id|userId/);
  }
}

describe("SP10-02: los flujos del cliente usan la sesión", () => {
  beforeEach(() => {
    storeSession();
  });

  it("Dashboard: estado del trámite, DS-160 y documentos viajan con el token y sin correo ni id", async () => {
    const fetchMock = mockApi((path) => ok(path.startsWith("/documentos") ? [] : {}));

    render(<Dashboard />);

    await waitFor(() => {
      const paths = dataCalls(fetchMock).map(([url]) => String(url));
      expect(paths.some((p) => p.includes("/estado-tramite"))).toBe(true);
      expect(paths.some((p) => p.includes("/ds160/load"))).toBe(true);
      expect(paths.some((p) => p.includes("/documentos/listar"))).toBe(true);
    });
    expectSessionOnly(dataCalls(fetchMock));
  });

  it("Cronología: estado del trámite, DS-160 y documentos viajan con el token y sin correo ni id", async () => {
    const fetchMock = mockApi((path) => ok(path.startsWith("/documentos") ? [] : {}));

    render(<Cronologia />);

    await waitFor(() => {
      const paths = dataCalls(fetchMock).map(([url]) => String(url));
      expect(paths.some((p) => p.includes("/estado-tramite"))).toBe(true);
      expect(paths.some((p) => p.includes("/documentos/listar"))).toBe(true);
    });
    expectSessionOnly(dataCalls(fetchMock));
  });

  it("Perfil: carga y actualiza con el token; el correo solo se muestra, no se envía", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi((_path, options) => ok(options.method === "PUT" ? { usuario: perfilPayload.usuario } : perfilPayload));

    render(<Perfil />);

    const toggle = await screen.findByRole("switch", { name: "Notificaciones por Email" });
    expect(screen.getByText(CORREO)).toBeInTheDocument();
    await user.click(toggle);

    await waitFor(() => expect(dataCalls(fetchMock).some(([, o]) => o.method === "PUT")).toBe(true));
    const calls = dataCalls(fetchMock);
    expectSessionOnly(calls);
    expect(JSON.parse(calls.find(([, o]) => o.method === "PUT")[1].body)).toEqual({ notificacionesEmail: false });
    expect(JSON.parse(calls.find(([, o]) => o.method === "POST")[1].body)).toEqual({});
  });

  it("Selección de perfil: guarda solo el perfil elegido con el token, aunque haya otro correo guardado", async () => {
    const user = userEvent.setup();
    storeSession({ perfil: null });
    localStorage.removeItem("perfilUsuario");
    localStorage.setItem("correoUsuario", "otra-persona@example.com");
    const fetchMock = mockApi(() => ok({ message: "Perfil guardado correctamente" }));

    render(<ProfileSelection />);
    await user.click(await screen.findByText("Turismo / Negocios (B1/B2)"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(screen.getByText("¡Perfil seleccionado con éxito!")).toBeInTheDocument());
    const calls = dataCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toContain("/guardar-perfil");
    expect(JSON.parse(calls[0][1].body)).toEqual({ perfil: "turismo_negocios" });
    expect(calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.stringify(calls[0])).not.toContain("otra-persona@example.com");
  });
});

describe("SP10-02: errores 401 y 403", () => {
  beforeEach(() => {
    storeSession();
  });

  it("Perfil: con 401 la sesión se descarta y no queda a la vista información de la cuenta", async () => {
    const expired = vi.fn();
    window.addEventListener("visaguide:session-expired", expired);
    mockApi(() => fail(401, { error: "Sesión inválida" }));

    render(<Perfil />);

    await waitFor(() => expect(expired).toHaveBeenCalled());
    expect(localStorage.getItem("visaguide_session")).toBeNull();
    expect(screen.queryByText(CORREO)).not.toBeInTheDocument();
    expect(screen.queryByText("Ana López")).not.toBeInTheDocument();
    window.removeEventListener("visaguide:session-expired", expired);
  });

  it("Perfil: con 403 muestra que no tiene permiso, sin datos de otra cuenta y conservando la sesión", async () => {
    mockApi(() => fail(403, { error: "No autorizado" }));

    render(<Perfil />);

    expect(await screen.findByText("No tienes permiso para ver este perfil.")).toBeInTheDocument();
    expect(screen.queryByText(CORREO)).not.toBeInTheDocument();
    expect(localStorage.getItem("visaguide_session")).not.toBeNull();
  });

  it("Perfil: si guardar devuelve 403 avisa y revierte el cambio", async () => {
    const user = userEvent.setup();
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockApi((_path, options) => (options.method === "PUT" ? fail(403, { error: "No puedes modificar este usuario" }) : ok(perfilPayload)));

    render(<Perfil />);
    const toggle = await screen.findByRole("switch", { name: "Notificaciones por Email" });
    await user.click(toggle);

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith("No puedes modificar este usuario"));
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("Selección de perfil: con 403 muestra el mensaje del servidor y no avanza al dashboard", async () => {
    const user = userEvent.setup();
    storeSession({ perfil: null });
    localStorage.removeItem("perfilUsuario");
    mockApi(() => fail(403, { error: "No puedes modificar el perfil de otro usuario" }));

    render(<ProfileSelection />);
    await user.click(await screen.findByText("Estudiante (F/M)"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("No puedes modificar el perfil de otro usuario")).toBeInTheDocument();
    expect(screen.queryByText("¡Perfil seleccionado con éxito!")).not.toBeInTheDocument();
    expect(localStorage.getItem("perfilUsuario")).toBeNull();
  });

  it("Selección de perfil: con 401 limpia la sesión y no marca el perfil como guardado", async () => {
    const user = userEvent.setup();
    storeSession({ perfil: null });
    localStorage.removeItem("perfilUsuario");
    mockApi(() => fail(401, { error: "Sesión inválida" }));

    render(<ProfileSelection />);
    await user.click(await screen.findByText("Estudiante (F/M)"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(localStorage.getItem("visaguide_session")).toBeNull());
    expect(localStorage.getItem("perfilUsuario")).toBeNull();
    expect(screen.queryByText("¡Perfil seleccionado con éxito!")).not.toBeInTheDocument();
  });

  it("Dashboard: si la sesión expira durante la carga vuelve al estado de carga sin mostrar datos", async () => {
    mockApi((path) => (path.startsWith("/documentos") ? fail(401, { error: "Sesión inválida" }) : ok({ progreso: 40 })));

    render(<Dashboard />);

    await waitFor(() => expect(localStorage.getItem("visaguide_session")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("heading", { name: /Hola/ })).not.toBeInTheDocument());
  });
});

describe("SP10-02: useRequireAuth descarta la sesión", () => {
  async function renderValidated() {
    storeSession();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => ({ valid: true }) });
    const hook = renderHook(() => useRequireAuth());
    await waitFor(() => expect(hook.result.current.isValidating).toBe(false));
    return hook;
  }

  it("al expirar la sesión descarta la sesión en memoria", async () => {
    const { result } = await renderValidated();
    expect(result.current.session.correo).toBe(CORREO);

    act(() => {
      localStorage.removeItem("visaguide_session");
      window.dispatchEvent(new CustomEvent("visaguide:session-expired"));
    });

    expect(result.current.session).toBeNull();
    expect(result.current.isValidating).toBe(true);
  });

  it("si otra pestaña inicia sesión con otro usuario descarta la sesión de este", async () => {
    const { result } = await renderValidated();

    act(() => {
      storeSession({ id: 99, correo: "otro@example.com", token: "token-otro" });
      window.dispatchEvent(new StorageEvent("storage", { key: "visaguide_session" }));
    });

    expect(result.current.session).toBeNull();
  });

  it("si otra pestaña cierra la sesión descarta la sesión de este", async () => {
    const { result } = await renderValidated();

    act(() => {
      localStorage.removeItem("visaguide_session");
      window.dispatchEvent(new StorageEvent("storage", { key: "visaguide_session" }));
    });

    expect(result.current.session).toBeNull();
  });

  it("un cambio en la misma sesión o en otra clave no la descarta", async () => {
    const { result } = await renderValidated();

    act(() => {
      storeSession({ nombre: "Ana M. López" });
      window.dispatchEvent(new StorageEvent("storage", { key: "visaguide_session" }));
      window.dispatchEvent(new StorageEvent("storage", { key: "idioma" }));
    });

    expect(result.current.session).not.toBeNull();
    expect(result.current.isValidating).toBe(false);
  });
});
