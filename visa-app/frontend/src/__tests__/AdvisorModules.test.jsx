import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdvisorProcesses from "../pages/advisor/AdvisorProcesses";
import AdvisorDocuments from "../pages/advisor/AdvisorDocuments";
import AdvisorDS160 from "../pages/advisor/AdvisorDS160";
import AdvisorInterviews from "../pages/advisor/AdvisorInterviews";
import AdvisorQuestions from "../pages/advisor/AdvisorQuestions";
import AdvisorProfile from "../pages/advisor/AdvisorProfile";
import { advisorRequest } from "../utils/advisorApi";

vi.mock("../components/advisor/AdvisorLayout", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../components/AuthenticatedAudio", () => ({ default: ({ src }) => <audio data-testid="authenticated-audio" src={src} /> }));
vi.mock("../utils/documentPreview", () => ({ openDocumentPreview: vi.fn() }));
vi.mock("../utils/advisorApi", () => ({ advisorRequest: vi.fn() }));

const applicant = {
  id: 42,
  nombre: "Ana López",
  correo: "ana@example.com",
  perfil: "Turismo",
  telefono: "+502 5555 0101",
  ciudad: "Guatemala",
  pais: "Guatemala",
};

const process = {
  id: 18,
  estado: "Pendiente",
  etapaActual: "Configuración de perfil",
  progreso: 0,
  updatedAt: "2026-10-08T14:30:00.000Z",
  solicitante: applicant,
};

function renderPage(page) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

describe("módulos operativos del panel de asesor", () => {
  beforeEach(() => {
    advisorRequest.mockReset();
    localStorage.clear();
  });

  test("actualiza el estado y la etapa de una solicitud asignada", async () => {
    advisorRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/processes" && !options.method) return { processes: [process] };
      if (path === "/processes/18" && !options.method) {
        return { process, documents: [], ds160: null, interviews: [], history: [] };
      }
      if (path === "/processes/18" && options.method === "PUT") {
        return { process: { ...process, ...JSON.parse(options.body) } };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const user = userEvent.setup();

    renderPage(<AdvisorProcesses />);
    expect(await screen.findByText("Ana López")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver detalles" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Estado")).toBeEnabled());
    await user.selectOptions(within(dialog).getByLabelText("Estado"), "En proceso");
    await user.selectOptions(within(dialog).getByLabelText("Etapa actual"), "Formulario DS-160");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(advisorRequest).toHaveBeenCalledWith("/processes/18", {
      method: "PUT",
      body: JSON.stringify({ estado: "En proceso", etapaActual: "Formulario DS-160" }),
    }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("permite reintentar la carga de solicitudes después de un error", async () => {
    advisorRequest
      .mockRejectedValueOnce(new Error("No fue posible cargar las solicitudes"))
      .mockResolvedValueOnce({ processes: [process] });
    const user = userEvent.setup();

    renderPage(<AdvisorProcesses />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible cargar las solicitudes");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Ana López")).toBeInTheDocument();
    expect(advisorRequest).toHaveBeenCalledTimes(2);
  });

  test("exige observaciones al solicitar una corrección documental y guarda la revisión", async () => {
    const document = {
      id: 31,
      nombre: "Pasaporte",
      tipo: "application/pdf",
      documento_key: "passport",
      estado: "pending",
      feedback: "",
      creado_en: "2026-10-08T14:30:00.000Z",
      usuario: applicant,
    };
    advisorRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/documents" && !options.method) return { documents: [document] };
      if (path === "/documents/31" && options.method === "PUT") {
        return { document: { ...document, ...JSON.parse(options.body) } };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const user = userEvent.setup();

    renderPage(<AdvisorDocuments />);
    expect(await screen.findByText("Pasaporte")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revisar" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Guardar revisión" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Describe la corrección");

    await user.type(within(dialog).getByLabelText("Observaciones"), "Adjunta una imagen completa y legible.");
    await user.click(within(dialog).getByRole("button", { name: "Guardar revisión" }));
    await waitFor(() => expect(advisorRequest).toHaveBeenCalledWith("/documents/31", {
      method: "PUT",
      body: JSON.stringify({ status: "correction", feedback: "Adjunta una imagen completa y legible." }),
    }));
  });

  test("valida y registra correcciones en un formulario DS-160", async () => {
    const form = {
      id: 9,
      userId: 42,
      name: "Ana López",
      email: "ana@example.com",
      profile: "Turismo",
      currentSection: 10,
      completed: true,
      progress: 100,
      status: "por_revisar",
      feedback: "",
      data: { travelPurpose: "Turismo" },
      updatedAt: "2026-10-08T14:30:00.000Z",
    };
    advisorRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/ds160" && !options.method) return { forms: [form] };
      if (path === "/ds160/9" && options.method === "PUT") return { message: "Formulario actualizado correctamente" };
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const user = userEvent.setup();

    renderPage(<AdvisorDS160 />);
    expect(await screen.findByText("Ana López")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revisar" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Estado"), "correccion");
    await user.click(within(dialog).getByRole("button", { name: "Guardar revisión" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Agrega las correcciones");

    await user.type(within(dialog).getByLabelText("Retroalimentación"), "Corrige las fechas del viaje anterior.");
    await user.click(within(dialog).getByRole("button", { name: "Guardar revisión" }));
    await waitFor(() => expect(advisorRequest).toHaveBeenCalledWith("/ds160/9", {
      method: "PUT",
      body: JSON.stringify({ status: "correccion", feedback: "Corrige las fechas del viaje anterior." }),
    }));
  });

  test("exige retroalimentación y califica una entrevista", async () => {
    const interview = {
      id: 14,
      user_id: 42,
      user_name: "Ana López",
      user_email: "ana@example.com",
      status: "pending",
      responses: [{ id: "q1", text: "¿Cuál es el propósito de su viaje?", recorded: true, audio: { url: "/audio/q1" } }],
      feedback: null,
      rating: null,
      created_at: "2026-10-08T14:30:00.000Z",
    };
    advisorRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/interviews" && !options.method) return { sessions: [interview] };
      if (path === "/interviews/14/feedback" && options.method === "PUT") {
        const payload = JSON.parse(options.body);
        return { session: { ...interview, ...payload, rating: Number(payload.rating), status: "reviewed" } };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const user = userEvent.setup();

    renderPage(<AdvisorInterviews />);
    expect(await screen.findByText("Ana López")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver detalles" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("authenticated-audio")).toHaveAttribute("src", "/audio/q1");
    await user.click(within(dialog).getByRole("button", { name: "Guardar retroalimentación" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("La retroalimentación es obligatoria");

    await user.type(within(dialog).getByLabelText("Retroalimentación"), "Respuesta clara y concreta.");
    await user.selectOptions(within(dialog).getByLabelText("Calificación"), "5");
    await user.click(within(dialog).getByRole("button", { name: "Guardar retroalimentación" }));
    await waitFor(() => expect(advisorRequest).toHaveBeenCalledWith("/interviews/14/feedback", {
      method: "PUT",
      body: JSON.stringify({ feedback: "Respuesta clara y concreta.", rating: "5" }),
    }));
  });

  test("activa o desactiva preguntas y agrega una nueva al banco", async () => {
    const question = {
      id: 7,
      question: "¿Cuál es el propósito de su viaje?",
      category: "Viaje",
      difficulty: "Fácil",
      is_required: true,
      activo: true,
      uso_count: 3,
    };
    advisorRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/questions" && !options.method) return { questions: [question] };
      if (path === "/questions/7/status" && options.method === "PATCH") {
        return { question: { ...question, activo: JSON.parse(options.body).activo } };
      }
      if (path === "/questions" && options.method === "POST") {
        return { question: { id: 8, ...JSON.parse(options.body), activo: true, uso_count: 0 } };
      }
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const user = userEvent.setup();

    renderPage(<AdvisorQuestions />);
    expect(await screen.findByText(question.question)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(advisorRequest).toHaveBeenCalledWith("/questions/7/status", {
      method: "PATCH",
      body: JSON.stringify({ activo: false }),
    }));
    expect(await screen.findByRole("button", { name: "Activar" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nueva pregunta" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Pregunta"), "¿Cómo financiará su viaje?");
    await user.selectOptions(within(dialog).getByLabelText("Categoría"), "Finanzas");
    await user.click(within(dialog).getByRole("button", { name: "Guardar pregunta" }));
    expect(await screen.findByText("¿Cómo financiará su viaje?")).toBeInTheDocument();
  });

  test("actualiza el perfil y sincroniza el nombre de la sesión local", async () => {
    const profile = {
      id_usuario: 9,
      nombre: "Laura Vásquez",
      correo: "laura@example.com",
      telefono: "",
      ciudad: "Guatemala",
      pais: "Guatemala",
      rol: "asesor",
    };
    localStorage.setItem("visaguide_session", JSON.stringify({ id: 9, nombre: profile.nombre, rol: "asesor" }));
    advisorRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/profile" && !options.method) return { user: profile };
      if (path === "/profile" && options.method === "PUT") return { user: JSON.parse(options.body) };
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const user = userEvent.setup();

    renderPage(<AdvisorProfile />);
    const nameInput = await screen.findByLabelText("Nombre completo");
    await user.clear(nameInput);
    await user.type(nameInput, "Laura Méndez");
    await user.type(screen.getByLabelText("Teléfono"), "+502 5555 0102");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Perfil actualizado correctamente");
    expect(JSON.parse(localStorage.getItem("visaguide_session"))).toMatchObject({ nombre: "Laura Méndez" });
    expect(advisorRequest).toHaveBeenCalledWith("/profile", expect.objectContaining({ method: "PUT" }));
  });
});
