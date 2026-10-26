import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminQuestions from "../pages/admin/AdminQuestions";
import QuestionBankModal from "../components/QuestionBankModal";
import { buildQuestionPayload, EXAMPLE_FIELDS, MAX_EXAMPLE_LENGTH } from "../utils/questionExamples";

// SP10-19: el administrador edita los ejemplos de respuesta fuerte/débil del banco de preguntas.

vi.mock("../components/admin/AdminLayout", () => ({ default: ({ children }) => <main>{children}</main> }));

const categories = ["General", "Viaje", "Finanzas"];
const difficulties = ["Fácil", "Media", "Alta"];

const QUESTION = {
  id: 10,
  question: "¿Cuál es el propósito de su viaje?",
  category: "Viaje",
  difficulty: "Fácil",
  is_required: true,
  activo: true,
  ejemplo_fuerte: "Voy a un congreso de 5 días y regreso a mi trabajo.",
  explicacion_fuerte: "Es concreta y verificable.",
  ejemplo_debil: "No sé, quiero conocer.",
  explicacion_debil: "Es vaga y no demuestra vínculos.",
};

function renderModal(props = {}) {
  const onSubmit = vi.fn();
  render(
    <QuestionBankModal
      categories={categories}
      difficulties={difficulties}
      isSaving={false}
      mode="edit"
      question={QUESTION}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      {...props}
    />
  );
  return onSubmit;
}

describe("buildQuestionPayload", () => {
  const form = {
    question: "¿Pregunta?",
    category: "Viaje",
    difficulty: "Media",
    is_required: false,
    ejemplo_fuerte: "  Fuerte  ",
    explicacion_fuerte: "",
    ejemplo_debil: "",
    explicacion_debil: "   ",
  };

  it("al crear solo envía los ejemplos escritos, sin espacios sobrantes", () => {
    expect(buildQuestionPayload(form, "create")).toEqual({
      question: "¿Pregunta?",
      category: "Viaje",
      difficulty: "Media",
      is_required: false,
      ejemplo_fuerte: "Fuerte",
    });
  });

  it("al editar envía siempre los cuatro campos para que un campo vacío borre el ejemplo", () => {
    expect(buildQuestionPayload(form, "edit")).toEqual({
      question: "¿Pregunta?",
      category: "Viaje",
      difficulty: "Media",
      is_required: false,
      ejemplo_fuerte: "Fuerte",
      explicacion_fuerte: "",
      ejemplo_debil: "",
      explicacion_debil: "",
    });
  });

  it("define los cuatro campos que acepta el backend", () => {
    expect(EXAMPLE_FIELDS.map((field) => field.name)).toEqual([
      "ejemplo_fuerte", "explicacion_fuerte", "ejemplo_debil", "explicacion_debil",
    ]);
    expect(MAX_EXAMPLE_LENGTH).toBe(2000);
  });
});

describe("QuestionBankModal: ejemplos de respuesta", () => {
  it("muestra los ejemplos guardados al editar una pregunta", () => {
    renderModal();

    expect(screen.getByLabelText(/Ejemplo de respuesta fuerte/)).toHaveValue(QUESTION.ejemplo_fuerte);
    expect(screen.getByLabelText(/Por qué es una respuesta fuerte/)).toHaveValue(QUESTION.explicacion_fuerte);
    expect(screen.getByLabelText(/Ejemplo de respuesta débil/)).toHaveValue(QUESTION.ejemplo_debil);
    expect(screen.getByLabelText(/Por qué es una respuesta débil/)).toHaveValue(QUESTION.explicacion_debil);
  });

  it("deja los campos vacíos si la pregunta no tiene ejemplos", () => {
    renderModal({ question: { ...QUESTION, ejemplo_fuerte: null, explicacion_fuerte: undefined, ejemplo_debil: null, explicacion_debil: null } });

    for (const label of [/Ejemplo de respuesta fuerte/, /Por qué es una respuesta fuerte/, /Ejemplo de respuesta débil/, /Por qué es una respuesta débil/]) {
      expect(screen.getByLabelText(label)).toHaveValue("");
    }
  });

  it("guarda los cambios hechos a un ejemplo conservando los demás", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    const strong = screen.getByLabelText(/Ejemplo de respuesta fuerte/);
    await user.clear(strong);
    await user.type(strong, "Respuesta nueva y concreta.");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSubmit).toHaveBeenCalledWith({
      question: QUESTION.question,
      category: "Viaje",
      difficulty: "Fácil",
      is_required: true,
      ejemplo_fuerte: "Respuesta nueva y concreta.",
      explicacion_fuerte: QUESTION.explicacion_fuerte,
      ejemplo_debil: QUESTION.ejemplo_debil,
      explicacion_debil: QUESTION.explicacion_debil,
    });
  });

  it("permite borrar un ejemplo enviándolo vacío", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    await user.clear(screen.getByLabelText(/Ejemplo de respuesta débil/));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSubmit.mock.calls[0][0]).toMatchObject({ ejemplo_debil: "", ejemplo_fuerte: QUESTION.ejemplo_fuerte });
  });

  it("al crear una pregunta sin ejemplos no los envía", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal({ mode: "create", question: null });

    await user.type(screen.getByPlaceholderText("Escribe la pregunta consular..."), "¿Dónde trabaja?");
    await user.click(screen.getByRole("button", { name: "Crear pregunta" }));

    expect(onSubmit).toHaveBeenCalledWith({
      question: "¿Dónde trabaja?",
      category: "General",
      difficulty: "Media",
      is_required: false,
    });
  });

  it("limita cada ejemplo a 2000 caracteres y muestra el contador", async () => {
    const user = userEvent.setup();
    renderModal({ question: { ...QUESTION, ejemplo_fuerte: "abc" } });

    const strong = screen.getByLabelText(/Ejemplo de respuesta fuerte/);
    expect(strong).toHaveAttribute("maxlength", "2000");
    expect(within(strong.closest("label")).getByText("3/2000")).toBeInTheDocument();
    await user.type(strong, "de");
    expect(within(strong.closest("label")).getByText("5/2000")).toBeInTheDocument();
  });

  it("indica que los ejemplos son opcionales y para qué sirven", () => {
    renderModal();

    expect(screen.getByText("Ejemplos de respuesta (opcional)")).toBeInTheDocument();
    expect(screen.getByText(/Se muestran al cliente en el simulador de entrevista/)).toBeInTheDocument();
  });
});

describe("panel admin: editar ejemplos de una pregunta", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("visaguide_session", JSON.stringify({ id: 1, rol: "admin", token: "admin-token" }));
  });

  it("guarda con PUT los ejemplos editados y recarga la lista", async () => {
    const user = userEvent.setup();
    let questions = [QUESTION];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, "");
      if (path === "/questions/admin") {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ questions }) });
      }
      if (path === "/questions/10" && options.method === "PUT") {
        questions = [{ ...QUESTION, ...JSON.parse(options.body) }];
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ question: questions[0] }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<AdminQuestions />);
    await user.click(await screen.findByRole("button", { name: /Editar/ }));

    const weak = screen.getByLabelText(/Ejemplo de respuesta débil/);
    expect(weak).toHaveValue(QUESTION.ejemplo_debil);
    await user.clear(weak);
    await user.type(weak, "Quiero pasear.");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Pregunta guardada correctamente."));
    const put = fetchMock.mock.calls.find(([, options]) => options?.method === "PUT");
    expect(put[1].headers.Authorization).toBe("Bearer admin-token");
    expect(JSON.parse(put[1].body)).toEqual({
      question: QUESTION.question,
      category: "Viaje",
      difficulty: "Fácil",
      is_required: true,
      ejemplo_fuerte: QUESTION.ejemplo_fuerte,
      explicacion_fuerte: QUESTION.explicacion_fuerte,
      ejemplo_debil: "Quiero pasear.",
      explicacion_debil: QUESTION.explicacion_debil,
    });
  });

  it("muestra el error del servidor si no se pueden guardar los ejemplos", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, "");
      if (path === "/questions/admin") {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ questions: [QUESTION] }) });
      }
      if (options.method === "PUT") {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "ejemplo_fuerte no puede superar 2000 caracteres" }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<AdminQuestions />);
    await user.click(await screen.findByRole("button", { name: /Editar/ }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("ejemplo_fuerte no puede superar 2000 caracteres")).toBeInTheDocument();
  });
});
