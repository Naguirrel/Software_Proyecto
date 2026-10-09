import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AdvisorChat from "../pages/advisor/AdvisorChat";
import AdvisorTasks from "../pages/advisor/AdvisorTasks";
import { advisorRequest } from "../utils/advisorApi";

vi.mock("../components/advisor/AdvisorLayout", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../utils/advisorApi", () => ({ advisorRequest: vi.fn() }));

const conversation = {
  userId: 5,
  name: "Ana López",
  email: "ana@example.com",
  profile: "Turismo",
  stage: "Formulario DS-160",
  lastMessage: "Necesito ayuda",
  unreadCount: 1,
};

describe("comunicación del asesor", () => {
  beforeEach(() => { advisorRequest.mockReset(); });
  afterEach(() => vi.useRealTimers());

  test("consulta mensajes nuevos automáticamente mientras la conversación está abierta", async () => {
    vi.useFakeTimers();
    advisorRequest.mockImplementation(async (path) => {
      if (path === "/conversations") return { conversations: [conversation] };
      if (path.includes("afterId=1")) {
        return { messages: [{ id: 2, sender: "client", message: "Mensaje recibido en vivo", createdAt: "2026-10-05T18:01:00.000Z" }] };
      }
      if (path.startsWith("/conversations/5/messages?")) {
        return { messages: [{ id: 1, sender: "advisor", message: "Hola Ana", createdAt: "2026-10-05T18:00:00.000Z" }], hasMoreBefore: false };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });

    render(<MemoryRouter><AdvisorChat /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText("Hola Ana")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(screen.getByText("Mensaje recibido en vivo")).toBeInTheDocument();
    expect(advisorRequest).toHaveBeenCalledWith(expect.stringContaining("afterId=1"), expect.any(Object));
  });

  test("edita una tarea y conserva el solicitante asociado", async () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const task = {
      id: 8,
      title: "Revisar documentos",
      dueAt: now.toISOString(),
      priority: "high",
      status: "pending",
      userId: 5,
      applicantName: "Ana López",
    };
    advisorRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/tasks" && !options.method) return { tasks: [task] };
      if (path === "/processes") return { processes: [{ solicitante: { id: 5, nombre: "Ana López" } }] };
      if (path === "/tasks/8" && options.method === "PUT") {
        const payload = JSON.parse(options.body);
        return { task: { ...task, ...payload, applicantName: "Ana López" } };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const user = userEvent.setup();

    render(<MemoryRouter><AdvisorTasks /></MemoryRouter>);
    expect(await screen.findByText("Revisar documentos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar tarea" }));
    const title = screen.getByLabelText("Título");
    await user.clear(title);
    await user.type(title, "Revisar pasaporte");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Revisar pasaporte")).toBeInTheDocument();
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(advisorRequest).toHaveBeenCalledWith("/tasks/8", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining('"dueAt":"'),
    }));
  });
});
