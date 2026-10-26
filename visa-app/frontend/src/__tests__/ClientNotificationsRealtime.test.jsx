import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationCenter from "../components/NotificationCenter";
import Sidebar from "../components/Sidebar";
import useUnreadNotifications, { NOTIFICATION_POLL_INTERVAL_MS } from "../hooks/useUnreadNotifications";

// SP10-13 / RNF-31: las notificaciones del cliente se actualizan solas, sin recargar la página.

vi.mock("../hooks/useTheme", () => ({ default: () => ({ isDark: false, toggleTheme: vi.fn() }) }));
vi.mock("../hooks/useClientWorkflow", () => ({
  default: () => ({ workflow: { assigned: true, gates: {} } }),
}));

const POLL = NOTIFICATION_POLL_INTERVAL_MS;

function setVisibility(state) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

function mockUnread(initial = 0) {
  const state = { total: initial };
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    if (path === "/notificaciones/no-leidas") {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ total: state.total }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  return { state, fetchMock };
}

const countCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/notificaciones/no-leidas")).length;
const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("useUnreadNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
    localStorage.setItem("visaguide_session", JSON.stringify({ id: 7, rol: "cliente", token: "token-ana" }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("consulta el contador al montar con el token de sesión", async () => {
    const { fetchMock } = mockUnread(3);

    const { result } = renderHook(() => useUnreadNotifications(7));
    await tick(0);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer token-ana");
    expect(JSON.parse(options.body)).toEqual({ userId: 7 });
    expect(result.current.unreadCount).toBe(3);
  });

  it("vuelve a consultar cada 30 segundos y refleja las notificaciones nuevas sin recargar", async () => {
    const { state, fetchMock } = mockUnread(1);
    const { result } = renderHook(() => useUnreadNotifications(7));
    await tick(0);
    expect(result.current.unreadCount).toBe(1);

    state.total = 4;
    await tick(POLL - 1);
    expect(result.current.unreadCount).toBe(1);
    await tick(1);

    expect(result.current.unreadCount).toBe(4);
    expect(countCalls(fetchMock)).toBe(2);
    expect(POLL).toBeGreaterThanOrEqual(30_000);
    expect(POLL).toBeLessThanOrEqual(60_000);
  });

  it("no consulta mientras la pestaña está oculta y se pone al día al volver", async () => {
    const { state, fetchMock } = mockUnread(0);
    const { result } = renderHook(() => useUnreadNotifications(7));
    await tick(0);

    setVisibility("hidden");
    state.total = 2;
    await tick(POLL * 3);
    expect(countCalls(fetchMock)).toBe(1);
    expect(result.current.unreadCount).toBe(0);

    setVisibility("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await tick(0);

    expect(result.current.unreadCount).toBe(2);
  });

  it("se actualiza de inmediato cuando se marcan notificaciones como leídas", async () => {
    const { state } = mockUnread(5);
    const { result } = renderHook(() => useUnreadNotifications(7));
    await tick(0);

    state.total = 0;
    await act(async () => { window.dispatchEvent(new CustomEvent("notificacionesLeidas")); });
    await tick(0);

    expect(result.current.unreadCount).toBe(0);
  });

  it("si una consulta falla conserva el último contador y reintenta en la siguiente", async () => {
    const { state, fetchMock } = mockUnread(2);
    const { result } = renderHook(() => useUnreadNotifications(7));
    await tick(0);

    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("offline")));
    await tick(POLL);
    expect(result.current.unreadCount).toBe(2);

    state.total = 6;
    await tick(POLL);
    expect(result.current.unreadCount).toBe(6);
  });

  it("no lanza una consulta nueva mientras otra sigue en curso", async () => {
    let release;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    renderHook(() => useUnreadNotifications(7));
    await tick(0);

    await tick(POLL * 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release({ ok: true, status: 200, json: async () => ({ total: 1 }) });
    await tick(0);
  });

  it("sin usuario no consulta nada y el contador es 0", async () => {
    const { fetchMock } = mockUnread(9);

    const { result } = renderHook(() => useUnreadNotifications(null));
    await tick(POLL * 2);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.unreadCount).toBe(0);
  });

  it("al desmontar deja de consultar", async () => {
    const { fetchMock } = mockUnread(1);
    const { unmount } = renderHook(() => useUnreadNotifications(7));
    await tick(0);

    unmount();
    await tick(POLL * 3);

    expect(countCalls(fetchMock)).toBe(1);
  });

  it("al desmontar cancela la consulta que sigue en curso", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { unmount } = renderHook(() => useUnreadNotifications(7));
    await tick(0);
    const { signal } = fetchMock.mock.calls[0][1];
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("al cambiar de usuario deja de consultar al anterior", async () => {
    const { fetchMock } = mockUnread(1);
    const { rerender } = renderHook(({ id }) => useUnreadNotifications(id), { initialProps: { id: 7 } });
    await tick(0);

    rerender({ id: 8 });
    await tick(0);

    const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).userId);
    expect(bodies).toEqual([7, 8]);
    await tick(POLL);
    const afterPoll = fetchMock.mock.calls.slice(2).map(([, options]) => JSON.parse(options.body).userId);
    expect(afterPoll).toEqual([8]);
  });
});

describe("contador del Sidebar del cliente", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
    localStorage.setItem("visaguide_session", JSON.stringify({ id: 12, nombre: "Ana López", correo: "ana@example.com", rol: "cliente", token: "t" }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("muestra una notificación nueva que llega mientras la página está abierta", async () => {
    const { state } = mockUnread(0);
    render(<MemoryRouter><Sidebar currentPage="inicio" /></MemoryRouter>);
    await tick(0);
    expect(screen.getByRole("button", { name: "Abrir notificaciones" })).toBeInTheDocument();

    state.total = 2;
    await tick(POLL);

    expect(screen.getByRole("button", { name: "Abrir notificaciones, 2 sin leer" })).toBeInTheDocument();
  });
});

// El panel navega al abrir un aviso con ruta, así que necesita un Router.
function Center({ count }) {
  return <MemoryRouter><NotificationCenter userId={7} unreadCount={count} /></MemoryRouter>;
}

describe("NotificationCenter con el panel abierto", () => {
  const A = { id: 1, titulo: "Documento aprobado", mensaje: "Tu pasaporte fue aprobado.", leido: false };
  const B = { id: 2, titulo: "Nueva etapa", mensaje: "Avanzaste de etapa.", leido: false };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setVisibility("visible");
    localStorage.setItem("visaguide_session", JSON.stringify({ id: 7, rol: "cliente", token: "t" }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockList(list) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve({
      ok: true, status: 200, json: async () => ({ notificaciones: list.current }),
    }));
  }

  async function openPanel(unreadCount) {
    const result = render(<Center count={unreadCount} />);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      screen.getByRole("button", { name: /Abrir notificaciones/ })
    );
    await screen.findByText(A.titulo);
    return result;
  }

  it("agrega a la lista abierta una notificación nueva cuando sube el contador, sin mostrar 'Cargando'", async () => {
    const list = { current: [A] };
    const fetchMock = mockList(list);
    const { rerender } = await openPanel(1);
    const before = fetchMock.mock.calls.length;

    list.current = [B, A];
    rerender(<Center count={2} />);

    expect(screen.queryByText("Cargando notificaciones…")).not.toBeInTheDocument();
    expect(await screen.findByText(B.titulo)).toBeInTheDocument();
    expect(screen.getByText(A.titulo)).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });

  it("actualiza la lista abierta cada 30 segundos aunque el contador no cambie", async () => {
    const list = { current: [A] };
    mockList(list);
    await openPanel(1);

    list.current = [B, A];
    await tick(POLL);

    expect(await screen.findByText(B.titulo)).toBeInTheDocument();
  });

  it("si la actualización silenciosa falla conserva la lista y no muestra error", async () => {
    const list = { current: [A] };
    const fetchMock = mockList(list);
    const { rerender } = await openPanel(1);

    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));
    rerender(<Center count={2} />);
    await tick(0);

    expect(screen.getByText(A.titulo)).toBeInTheDocument();
    expect(screen.queryByText("No se pudieron cargar las notificaciones.")).not.toBeInTheDocument();
  });

  it("anuncia a los lectores de pantalla cuando llega una notificación nueva, no al cargar", async () => {
    mockList({ current: [] });
    const { rerender } = render(<Center count={1} />);
    const live = () => screen.getAllByRole("status").find((node) => node.classList.contains("visually-hidden"));
    expect(live()).toHaveTextContent("");

    rerender(<Center count={2} />);
    expect(live()).toHaveTextContent("Nueva notificación recibida");
  });

  it("no anuncia nada cuando el contador baja", async () => {
    mockList({ current: [] });
    const { rerender } = render(<Center count={3} />);

    rerender(<Center count={1} />);

    const live = screen.getAllByRole("status").find((node) => node.classList.contains("visually-hidden"));
    expect(live).toHaveTextContent("");
  });

  it("con el panel cerrado no actualiza la lista", async () => {
    const fetchMock = mockList({ current: [A] });
    const { rerender } = render(<Center count={0} />);

    rerender(<Center count={1} />);
    await tick(POLL * 2);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
