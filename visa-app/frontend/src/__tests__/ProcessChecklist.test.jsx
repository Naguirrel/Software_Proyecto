import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProcessChecklist from "../components/ProcessChecklist";
import { TRANSLATIONS, translate } from "../i18n/translations";
import { workflowFixture } from "./helpers/workflowFixture";

const t = (key, vars) => translate("es", key, vars);
// `translate()` hoy fuerza el español (normalizarIdioma), así que se lee el diccionario en inglés directamente.
const tEn = (key, vars = {}) => (TRANSLATIONS.en[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));

function itemFor(label) {
  return screen.getByText(label).closest("li");
}

describe("ProcessChecklist", () => {
  it("muestra las actividades hechas y las pendientes con su estado en texto, no solo con color", () => {
    render(<ProcessChecklist workflow={workflowFixture("partial")} t={t} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(within(itemFor("Completar tu perfil")).getByText("Completada")).toBeInTheDocument();
    expect(within(itemFor("Asesor asignado")).getByText("Completada")).toBeInTheDocument();
    expect(within(itemFor("Completar el formulario DS-160")).getByText("Completada")).toBeInTheDocument();
    expect(within(itemFor("Documentos obligatorios aprobados")).getByText("Siguiente paso")).toBeInTheDocument();
    expect(within(itemFor("Pago consular completado")).getByText("Pendiente")).toBeInTheDocument();
    expect(within(itemFor("Práctica de entrevista realizada")).getByText("Pendiente")).toBeInTheDocument();
  });

  it("presenta las actividades como una lista ordenada y marca solo el paso actual con aria-current", () => {
    render(<ProcessChecklist workflow={workflowFixture("partial")} t={t} />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("list").tagName).toBe("OL");
    const current = screen.getAllByRole("listitem").filter((item) => item.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Documentos obligatorios aprobados");
  });

  it("resume el avance con un título, un conteo y una barra de progreso accesible", () => {
    render(<ProcessChecklist workflow={workflowFixture("partial")} t={t} />);

    expect(screen.getByRole("heading", { name: "Checklist de tu trámite" })).toBeInTheDocument();
    expect(screen.getByText("3 de 7 actividades completadas")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Avance del checklist" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "7");
    expect(bar).toHaveAttribute("aria-valuetext", "3 de 7 actividades completadas");
  });

  it("muestra el conteo de documentos subidos y aprobados", () => {
    render(<ProcessChecklist workflow={workflowFixture("partial")} t={t} />);

    expect(within(itemFor("Documentos obligatorios aprobados")).getByText("3 de 3 subidos · 2 de 3 aprobados")).toBeInTheDocument();
  });

  it("ofrece acceso para continuar solo en las actividades pendientes disponibles", () => {
    render(<ProcessChecklist workflow={workflowFixture("partial")} t={t} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/documents");
    expect(links[0]).toHaveAccessibleName("Continuar: Documentos obligatorios aprobados");
  });

  it("las actividades bloqueadas explican el motivo y no ofrecen enlace", () => {
    render(<ProcessChecklist workflow={workflowFixture("partial")} t={t} />);

    const payment = itemFor("Pago consular completado");
    expect(within(payment).getByText("Bloqueada: Los tres documentos obligatorios deben estar aprobados antes del pago.")).toBeInTheDocument();
    expect(within(payment).queryByRole("link")).not.toBeInTheDocument();
  });

  it("avance inicial: el perfil es el siguiente paso y esperar al asesor explica la espera", () => {
    render(<ProcessChecklist workflow={workflowFixture("profileDone")} t={t} />);

    expect(screen.getByText("1 de 7 actividades completadas")).toBeInTheDocument();
    const assignment = itemFor("Asesor asignado");
    expect(within(assignment).getByText("Siguiente paso")).toBeInTheDocument();
    expect(within(assignment).getByText(/Un administrador asignará tu asesor/)).toBeInTheDocument();
    expect(within(assignment).queryByRole("link")).not.toBeInTheDocument();
  });

  it("pago en gestión: sigue pendiente con su aclaración y acceso a pagos", () => {
    render(<ProcessChecklist workflow={workflowFixture("payment")} t={t} />);

    const payment = itemFor("Pago consular completado");
    expect(within(payment).getByText("Siguiente paso")).toBeInTheDocument();
    expect(within(payment).getByText("Tu transferencia está en validación o en gestión consular.")).toBeInTheDocument();
    expect(within(payment).getByRole("link")).toHaveAttribute("href", "/pagos");
  });

  it("trámite completo: celebra el avance y no deja enlaces ni pasos pendientes", () => {
    render(<ProcessChecklist workflow={workflowFixture("complete")} t={t} />);

    expect(screen.getByText("¡Completaste todas las actividades del trámite!")).toBeInTheDocument();
    expect(screen.getAllByText("Completada")).toHaveLength(7);
    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "7");
  });

  it("muestra el estado de carga mientras aún no hay datos", () => {
    render(<ProcessChecklist workflow={null} isLoading t={t} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu checklist…");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("conserva la lista visible mientras se vuelve a consultar", () => {
    render(<ProcessChecklist workflow={workflowFixture("partial")} isLoading t={t} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.queryByText("Cargando tu checklist…")).not.toBeInTheDocument();
  });

  it("muestra un error accesible y permite reintentar", async () => {
    const onRetry = vi.fn();
    render(<ProcessChecklist workflow={null} error="falló" onRetry={onRetry} t={t} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar el checklist de tu trámite.");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("sin información del trámite muestra un mensaje en lugar de una lista vacía", () => {
    render(<ProcessChecklist workflow={null} t={t} />);

    expect(screen.getByText("Todavía no hay información de tu trámite para mostrar.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("una respuesta sin requisitos tampoco inventa estados", () => {
    render(<ProcessChecklist workflow={{ assigned: true, gates: {} }} t={t} />);

    expect(screen.getByText("Todavía no hay información de tu trámite para mostrar.")).toBeInTheDocument();
    expect(screen.queryByText("Completada")).not.toBeInTheDocument();
  });

  it("se muestra en inglés con las mismas actividades y estados", () => {
    render(<ProcessChecklist workflow={workflowFixture("partial")} t={tEn} />);

    expect(screen.getByRole("heading", { name: "Your application checklist" })).toBeInTheDocument();
    expect(screen.getByText("3 of 7 activities completed")).toBeInTheDocument();
    expect(within(screen.getByText("Required documents approved").closest("li")).getByText("Next step")).toBeInTheDocument();
    expect(screen.getAllByText("Completed")).toHaveLength(3);
  });

  it("todas las claves del checklist existen en español e inglés", () => {
    const keys = Object.keys(TRANSLATIONS.es).filter((key) => key.startsWith("checklist.") || /^action\.(payment|appointment)\./.test(key));

    expect(keys.length).toBeGreaterThan(25);
    for (const key of keys) {
      expect(TRANSLATIONS.en[key], key).toBeTruthy();
    }
  });
});
