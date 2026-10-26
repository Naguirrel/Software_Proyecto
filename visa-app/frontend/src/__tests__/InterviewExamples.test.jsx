import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewSimulator from "../pages/InterviewSimulator";
import { buildQuestionExamples, getAnalysisSide } from "../utils/interviewExamples";

// SP10-20: el simulador muestra los ejemplos fuertes/débiles del banco de preguntas.

const session = { id: 3, nombre: "Cliente", correo: "cliente@example.test", token: "token" };
vi.mock("../hooks/useRequireAuth", () => ({ default: () => ({ isValidating: false, session }) }));
vi.mock("../hooks/useModoSenior", () => ({ default: () => false }));
vi.mock("../components/Sidebar", () => ({ default: () => <nav>Barra lateral</nav> }));

const FULL = {
  id: 1,
  question: "¿Quién financiará su viaje?",
  ejemplo_fuerte: "Mi empresa paga el viaje y tengo carta de trabajo.",
  explicacion_fuerte: "Indica una fuente concreta y comprobable.",
  ejemplo_debil: "Creo que alguien me ayudará.",
  explicacion_debil: "Es vaga y genera dudas sobre el financiamiento.",
};
const ONLY_EXAMPLE = { id: 2, question: "¿Dónde trabaja?", ejemplo_fuerte: "Soy contadora en una empresa desde 2019.", ejemplo_debil: "Trabajo en varias cosas." };
const ONLY_REASON = { id: 3, question: "¿Tiene familia en el país?", explicacion_fuerte: "Responde solo lo que se pregunta." };
const NONE = { id: 4, question: "¿Cuánto tiempo se quedará?", ejemplo_fuerte: null, explicacion_fuerte: "   ", ejemplo_debil: "", explicacion_debil: null };

const GENERAL = {
  weakNotes: ["Evita respuestas vagas, suposiciones o datos que no puedas explicar.", "Escucha la pregunta completa y responde solo lo que te solicitan."],
  strongNotes: ["Responde con claridad, honestidad y datos concretos de tu situación.", "Mantén tus respuestas coherentes con tu solicitud y tus documentos."],
};

function response(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

function renderSimulator(questions = [FULL, ONLY_EXAMPLE, ONLY_REASON, NONE]) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => response({ questions })));
  return render(
    <MemoryRouter initialEntries={["/entrevista/simulador"]}>
      <Routes>
        <Route path="/entrevista/simulador" element={<InterviewSimulator />} />
      </Routes>
    </MemoryRouter>
  );
}

const card = (name) => screen.getByRole("heading", { name, level: 3 }).closest("article");

async function goToQuestion(user, number) {
  for (let step = 1; step < number; step += 1) {
    await user.click(screen.getByRole("button", { name: /Siguiente pregunta/ }));
  }
}

describe("buildQuestionExamples", () => {
  it("extrae y recorta los cuatro textos del banco", () => {
    expect(buildQuestionExamples({ ...FULL, ejemplo_fuerte: "  Con espacios  " })).toEqual({
      strong: { quote: "Con espacios", reason: FULL.explicacion_fuerte },
      weak: { quote: FULL.ejemplo_debil, reason: FULL.explicacion_debil },
    });
  });

  it("trata los campos vacíos, nulos o ausentes como sin ejemplo", () => {
    const empty = { strong: { quote: "", reason: "" }, weak: { quote: "", reason: "" } };
    expect(buildQuestionExamples(NONE)).toEqual(empty);
    expect(buildQuestionExamples({})).toEqual(empty);
    expect(buildQuestionExamples(null)).toEqual(empty);
    expect(buildQuestionExamples({ ejemplo_fuerte: 42 }).strong.quote).toBe("");
  });
});

describe("getAnalysisSide", () => {
  const intro = { weak: "d", strong: "f", weakNotes: ["nd"], strongNotes: ["nf"] };

  it("la pregunta de introducción conserva su ejemplo fijo", () => {
    expect(getAnalysisSide({ id: "intro" }, "strong", { intro, general: GENERAL })).toMatchObject({ title: "Respuesta Fuerte", quote: "f", notes: ["nf"] });
  });

  it("usa el ejemplo y la explicación del banco cuando existen", () => {
    const question = { id: "bank-1", examples: buildQuestionExamples(FULL) };

    expect(getAnalysisSide(question, "weak", { intro, general: GENERAL })).toEqual({
      title: "Respuesta débil",
      subtitle: "Ejemplo para esta pregunta",
      quote: FULL.ejemplo_debil,
      notes: [FULL.explicacion_debil],
    });
  });

  it("si falta la explicación mantiene el ejemplo y las recomendaciones generales", () => {
    const question = { id: "bank-2", examples: buildQuestionExamples(ONLY_EXAMPLE) };

    expect(getAnalysisSide(question, "strong", { intro, general: GENERAL })).toMatchObject({
      quote: ONLY_EXAMPLE.ejemplo_fuerte,
      notes: GENERAL.strongNotes,
    });
  });

  it("sin ejemplos propios muestra la orientación general", () => {
    const question = { id: "bank-4", examples: buildQuestionExamples(NONE) };

    expect(getAnalysisSide(question, "weak", { intro, general: GENERAL })).toEqual({
      title: "Evita respuestas vagas",
      subtitle: "Orientación general",
      quote: null,
      notes: GENERAL.weakNotes,
    });
    expect(getAnalysisSide({ id: "bank-9" }, "strong", { intro, general: GENERAL }).subtitle).toBe("Orientación general");
  });
});

describe("InterviewSimulator: ejemplos del banco", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("la pregunta de introducción sigue mostrando su ejemplo fijo", async () => {
    renderSimulator();

    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    expect(within(card("Respuesta Débil")).getByText(/Voy de turismo, a pasear un rato/)).toBeInTheDocument();
    expect(within(card("Respuesta Fuerte")).getByText(/Viajo a Orlando, Florida/)).toBeInTheDocument();
  });

  it("una pregunta con ejemplos muestra el ejemplo débil y el fuerte con su explicación", async () => {
    const user = userEvent.setup();
    renderSimulator();
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await goToQuestion(user, 2);

    expect(screen.getByText(`"${FULL.question}"`)).toBeInTheDocument();
    const weak = card("Respuesta débil");
    expect(within(weak).getByText(FULL.ejemplo_debil)).toBeInTheDocument();
    expect(within(weak).getByRole("heading", { name: "¿Por qué es débil?" })).toBeInTheDocument();
    expect(within(weak).getByText(FULL.explicacion_debil)).toBeInTheDocument();
    const strong = card("Respuesta fuerte");
    expect(within(strong).getByText(FULL.ejemplo_fuerte)).toBeInTheDocument();
    expect(within(strong).getByText(FULL.explicacion_fuerte)).toBeInTheDocument();
    expect(screen.getAllByText("Ejemplo para esta pregunta")).toHaveLength(2);
  });

  it("al cambiar de pregunta cambian los ejemplos", async () => {
    const user = userEvent.setup();
    renderSimulator();
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await goToQuestion(user, 2);
    expect(screen.getByText(FULL.ejemplo_fuerte)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Siguiente pregunta/ }));

    expect(screen.queryByText(FULL.ejemplo_fuerte)).not.toBeInTheDocument();
    expect(screen.getByText(ONLY_EXAMPLE.ejemplo_fuerte)).toBeInTheDocument();
    expect(screen.getByText(ONLY_EXAMPLE.ejemplo_debil)).toBeInTheDocument();
  });

  it("si la pregunta solo tiene ejemplo muestra las recomendaciones generales como explicación", async () => {
    const user = userEvent.setup();
    renderSimulator();
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await goToQuestion(user, 3);

    const strong = card("Respuesta fuerte");
    expect(within(strong).getByText(ONLY_EXAMPLE.ejemplo_fuerte)).toBeInTheDocument();
    expect(within(strong).getByText(GENERAL.strongNotes[0])).toBeInTheDocument();
  });

  it("si la pregunta solo tiene explicación la muestra sin cita", async () => {
    const user = userEvent.setup();
    renderSimulator();
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await goToQuestion(user, 4);

    const strong = card("Respuesta fuerte");
    expect(within(strong).getByText(ONLY_REASON.explicacion_fuerte)).toBeInTheDocument();
    expect(strong.querySelector("blockquote")).toBeNull();
    expect(within(card("Evita respuestas vagas")).getByText(GENERAL.weakNotes[0])).toBeInTheDocument();
  });

  it("una pregunta sin ejemplos conserva la orientación general", async () => {
    const user = userEvent.setup();
    renderSimulator();
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await goToQuestion(user, 5);

    expect(screen.getByText(`"${NONE.question}"`)).toBeInTheDocument();
    expect(screen.getAllByText("Orientación general")).toHaveLength(2);
    expect(within(card("Responde con claridad")).getByText(GENERAL.strongNotes[0])).toBeInTheDocument();
    expect(document.querySelector(".analysis-card blockquote")).toBeNull();
  });

  it("las preguntas del banco sin los campos de ejemplos (respuesta anterior del backend) siguen funcionando", async () => {
    const user = userEvent.setup();
    renderSimulator([1, 2, 3, 4].map((id) => ({ id, question: `Pregunta aleatoria ${id}`, activo: true })));
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await goToQuestion(user, 2);

    expect(screen.getByText('"Pregunta aleatoria 1"')).toBeInTheDocument();
    expect(screen.getAllByText("Orientación general")).toHaveLength(2);
  });

  it("los ejemplos se muestran como texto, sin interpretar HTML", async () => {
    const user = userEvent.setup();
    renderSimulator([{ ...FULL, ejemplo_fuerte: "<img src=x onerror=alert(1)> Respuesta" }, ONLY_EXAMPLE, ONLY_REASON, NONE]);
    await screen.findByRole("heading", { name: /Pregunta 1 de 5/ });

    await goToQuestion(user, 2);

    expect(screen.getByText("<img src=x onerror=alert(1)> Respuesta")).toBeInTheDocument();
    expect(document.querySelector(".analysis-card img")).toBeNull();
  });
});
