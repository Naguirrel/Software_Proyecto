import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewSimulator from "../pages/InterviewSimulator";

const session = { id: 3, nombre: "Cliente", correo: "cliente@example.test", token: "token" };
vi.mock("../hooks/useRequireAuth", () => ({ default: () => ({ isValidating: false, session }) }));
vi.mock("../hooks/useModoSenior", () => ({ default: () => false }));
vi.mock("../components/Sidebar", () => ({ default: () => <nav>Barra lateral</nav> }));

const firstSet = [1, 2, 3, 4].map((id) => ({ id, question: `Pregunta aleatoria ${id}`, activo: true }));
const secondSet = [5, 6, 7, 8].map((id) => ({ id, question: `Nueva pregunta ${id}`, activo: true }));

function response(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

function renderSimulator() {
  return render(
    <MemoryRouter initialEntries={["/entrevista/simulador"]}>
      <Routes>
        <Route path="/entrevista/simulador" element={<InterviewSimulator />} />
        <Route path="/entrevista/retroalimentacion" element={<p>Entrevista enviada</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewSimulator", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => response({ questions: firstSet })));
  });

  it("muestra carga, la introducción fija y cuatro preguntas del banco", async () => {
    let completeRequest;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => { completeRequest = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    renderSimulator();

    expect(screen.getByRole("status")).toHaveTextContent("Cargando preguntas");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/questions/random?count=4&exclude=intro"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).toContain(`excludeText=${encodeURIComponent("¿Cuál es su nombre completo y cuál es el propósito de su viaje?")}`);
    expect(new URL(requestUrl, "http://localhost").searchParams.get("excludeText"))
      .toBe("¿Cuál es su nombre completo y cuál es el propósito de su viaje?");
    completeRequest(await response({ questions: firstSet }));

    expect(await screen.findByRole("heading", { name: /Pregunta 1 de 5/ })).toBeInTheDocument();
    expect(screen.getByText('"¿Cuál es su nombre completo y cuál es el propósito de su viaje?"')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escuchar pronunciación (Inglés/Español)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Progreso del simulador").querySelectorAll(".sim-progress__bar")).toHaveLength(5);
  });

  it("muestra el error de preguntas insuficientes y permite reintentar", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ error: "No hay suficientes preguntas activas elegibles: se necesitan 4 y hay 3." }, 409))
      .mockImplementationOnce(() => response({ questions: firstSet }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderSimulator();

    expect(await screen.findByRole("status")).toHaveTextContent("se necesitan 4 y hay 3");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: /Pregunta 1 de 5/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("mantiene el conjunto durante la sesión y obtiene otro al reiniciar", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ questions: firstSet }))
      .mockImplementationOnce(() => response({ questions: secondSet }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderSimulator();

    await screen.findByText('"¿Cuál es su nombre completo y cuál es el propósito de su viaje?"');
    await user.click(screen.getByRole("button", { name: /Siguiente pregunta/ }));
    expect(screen.getByText('"Pregunta aleatoria 1"')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escuchar pregunta en español" })).toBeInTheDocument();
    expect(screen.getAllByText("Orientación general")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Nueva sesión" }));
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });
    await user.click(screen.getByRole("button", { name: /Siguiente pregunta/ }));
    expect(await screen.findByText('"Nueva pregunta 5"')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rechaza una respuesta duplicada del API y cancela una solicitud al desmontar", async () => {
    const duplicate = [firstSet[0], firstSet[0], firstSet[2], firstSet[3]];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => response({ questions: duplicate })));
    const { unmount } = renderSimulator();
    expect(await screen.findByRole("status")).toHaveTextContent("cuatro preguntas diferentes");
    unmount();

    let completeRequest;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => { completeRequest = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const second = renderSimulator();
    const signal = fetchMock.mock.calls[0][1].signal;
    second.unmount();
    expect(signal.aborted).toBe(true);
    completeRequest(await response({ questions: firstSet }));
  });

  it("rechaza una pregunta igual a la introducción sin reintentar automáticamente", async () => {
    const duplicateIntro = [
      { id: 99, question: "  ¿CUÁL ES SU NOMBRE COMPLETO Y CUÁL ES EL PROPÓSITO DE SU VIAJE?  ", category: "General" },
      ...firstSet.slice(0, 3),
    ];
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ questions: duplicateIntro }))
      .mockImplementationOnce(() => response({ questions: firstSet }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderSimulator();

    expect(await screen.findByRole("status")).toHaveTextContent("cuatro preguntas diferentes");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: /Pregunta 1 de 5/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("descarta un permiso de micrófono pendiente al iniciar otra sesión", async () => {
    let allowMicrophone;
    const stop = vi.fn();
    vi.stubGlobal("MediaRecorder", class {});
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => new Promise((resolve) => { allowMicrophone = resolve; })) },
    });
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => response({ questions: firstSet }))
      .mockImplementationOnce(() => response({ questions: secondSet })));
    const user = userEvent.setup();
    renderSimulator();

    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });
    await user.click(screen.getByRole("button", { name: "Grabar mi respuesta" }));
    await user.click(screen.getByRole("button", { name: "Nueva sesión" }));
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });
    allowMicrophone({ getTracks: () => [{ stop }] });

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Grabar mi respuesta" })).toBeInTheDocument();
  });

  it("limpia el stream y descarta un onstop tardío antes de solicitar otra sesión", async () => {
    const stopOldTrack = vi.fn();
    const stopNewTrack = vi.fn();
    const streams = [
      { getTracks: () => [{ stop: stopOldTrack }] },
      { getTracks: () => [{ stop: stopNewTrack }] },
    ];
    let recorderCount = 0;
    let oldRecorder;
    class DeferredMediaRecorder {
      constructor() {
        this.state = "inactive";
        this.mimeType = "audio/webm";
        this.index = recorderCount++;
        if (this.index === 0) oldRecorder = this;
      }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        if (this.index === 0) {
          this.lateData = this.ondataavailable;
          this.lateStop = this.onstop;
        } else {
          this.ondataavailable?.({ data: new Blob(["new"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      }
    }
    vi.stubGlobal("MediaRecorder", DeferredMediaRecorder);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:new") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockImplementationOnce(async () => streams[0]).mockImplementationOnce(async () => streams[1]) },
    });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ questions: firstSet }))
      .mockImplementationOnce(() => {
        expect(stopOldTrack).toHaveBeenCalled();
        expect(oldRecorder.ondataavailable).toBeNull();
        expect(oldRecorder.onstop).toBeNull();
        return response({ questions: secondSet });
      });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderSimulator();
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await user.click(screen.getByRole("button", { name: "Grabar mi respuesta" }));
    await user.click(screen.getByRole("button", { name: /Detener grabación/ }));
    const lateData = oldRecorder.lateData;
    const lateStop = oldRecorder.lateStop;
    await user.click(screen.getByRole("button", { name: "Nueva sesión" }));
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await user.click(screen.getByRole("button", { name: "Grabar mi respuesta" }));
    lateData({ data: new Blob(["old"], { type: "audio/webm" }) });
    lateStop();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByText("Respuesta grabada")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Detener grabación/ }));
    expect(await screen.findByText("Respuesta grabada")).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL.mock.calls[0][0].size).toBe(3);
    expect(stopNewTrack).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("revoca audios anteriores y limpia una grabación activa al desmontar", async () => {
    const trackStop = vi.fn();
    const recorders = [];
    class FakeMediaRecorder {
      constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; recorders.push(this); }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:previous") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] })) },
    });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ questions: firstSet }))
      .mockImplementationOnce(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previous");
        return response({ questions: secondSet });
      });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const view = renderSimulator();
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await user.click(screen.getByRole("button", { name: "Grabar mi respuesta" }));
    await user.click(screen.getByRole("button", { name: /Detener grabación/ }));
    await screen.findByText("Respuesta grabada");
    await user.click(screen.getByRole("button", { name: "Nueva sesión" }));
    expect(await screen.findByText("0 de 5")).toBeInTheDocument();
    expect(screen.queryByText("Respuesta grabada")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Grabar mi respuesta" }));
    const lateStop = recorders[1].onstop;
    view.unmount();
    expect(recorders[1].state).toBe("inactive");
    expect(recorders[1].onstop).toBeNull();
    expect(trackStop).toHaveBeenCalled();
    lateStop();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("envía cinco respuestas y sus audios con los IDs de la sesión", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:audio") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    class FakeMediaRecorder {
      constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    });
    const fetchMock = vi.fn().mockImplementation((url) => String(url).includes("/interview-sessions")
      ? response({ session: { id: 77 } }) : response({ questions: firstSet }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderSimulator();
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    for (let index = 0; index < 5; index += 1) {
      await user.click(screen.getByRole("button", { name: "Grabar mi respuesta" }));
      await user.click(screen.getByRole("button", { name: /Detener grabación/ }));
      await screen.findByText("Respuesta grabada");
      await user.click(screen.getByRole("button", { name: index === 4 ? /Finalizar entrevista/ : /Siguiente pregunta/ }));
    }

    expect(await screen.findByText("Entrevista enviada")).toBeInTheDocument();
    const [, options] = fetchMock.mock.calls.find(([url]) => String(url).includes("/interview-sessions"));
    const payload = JSON.parse(options.body.get("session"));
    expect(payload.user).toMatchObject(session);
    expect(payload.questions).toHaveLength(5);
    expect(payload.questions.map((item) => item.id)).toEqual(["intro", "bank-1", "bank-2", "bank-3", "bank-4"]);
    expect(payload.questions.every((item) => item.recorded)).toBe(true);
    expect(["intro", "bank-1", "bank-2", "bank-3", "bank-4"].every((id) => options.body.has(`audio_${id}`))).toBe(true);
  });
});
