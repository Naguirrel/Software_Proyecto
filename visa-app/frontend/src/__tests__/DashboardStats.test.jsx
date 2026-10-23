import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardStats from "../components/DashboardStats";
import {
  calculateDs160Percentage,
  getDashboardNextAction,
  getDashboardQuickCards,
  summarizeDocuments,
} from "../utils/dashboardStats";

describe("DashboardStats", () => {
  it("calcula el porcentaje desde las secciones persistidas del DS-160", () => {
    expect(calculateDs160Percentage({ seccion_actual: 1, completado: false })).toBe(0);
    expect(calculateDs160Percentage({ seccion_actual: 6, completado: false })).toBe(50);
    expect(calculateDs160Percentage({ seccion_actual: 10, completado: true })).toBe(100);
    expect(calculateDs160Percentage({ seccion_actual: 99, completado: false })).toBe(100);
  });

  it("renderiza el porcentaje, documentos y etapa real", () => {
    render(
      <DashboardStats
        loading={false}
        error=""
        stats={{
          ds160Percentage: 50,
          documentCount: 3,
          currentStage: "Pago de visa",
        }}
      />
    );

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progreso del DS-160" })).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
    expect(screen.getByText("3 documentos asociados", { selector: ".dash-stat-card__stage" })).toBeInTheDocument();
    expect(screen.getByText("Pago de visa")).toBeInTheDocument();
    expect(screen.queryByText("Estado de tu trámite")).not.toBeInTheDocument();
  });

  it("muestra valores seguros cuando no existen datos", () => {
    render(<DashboardStats loading={false} error="" stats={null} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 documentos asociados")).toBeInTheDocument();
    expect(screen.getByText("Trámite no iniciado")).toBeInTheDocument();
  });

  it("usa el singular cuando hay un documento asociado", () => {
    render(<DashboardStats loading={false} error="" stats={{ documentCount: 1 }} />);

    expect(screen.getByText("1 documento asociado")).toBeInTheDocument();
  });

  it("muestra estados de carga y error", () => {
    const { rerender } = render(<DashboardStats loading error="" stats={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando estadísticas");

    rerender(
      <DashboardStats
        loading={false}
        error="Algunas estadísticas no pudieron actualizarse."
        stats={{ ds160Percentage: 0, documentCount: 0, currentStage: "" }}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("no pudieron actualizarse");
  });

  it("resume documentos por estado para alimentar el dashboard", () => {
    expect(
      summarizeDocuments([
        { estado: "approved" },
        { estado: "review" },
        { estado: "correction" },
        { estado: "rejected" },
        { estado: "pending" },
        { status: "pending" },
      ])
    ).toMatchObject({
      total: 6,
      approved: 1,
      review: 1,
      correction: 2,
      pending: 2,
    });
  });

  it("prioriza correcciones de documentos sobre la etapa actual", () => {
    expect(
      getDashboardNextAction({
        stageNumber: 3,
        ds160Percentage: 100,
        documentSummary: { correction: 2 },
        tramite: { siguientePaso: "Realizar pago" },
      })
    ).toMatchObject({
      title: "Corregir documentos",
      path: "/documents",
      buttonLabel: "Corregir ahora",
    });
  });

  it("genera cards rápidas dinámicas según documentos y etapa", () => {
    const cards = getDashboardQuickCards({
      documentSummary: { total: 1, pending: 1 },
      stageNumber: 6,
    });

    expect(cards[0]).toMatchObject({
      badge: "PENDIENTE",
      title: "Subir documentos",
      path: "/documents",
    });
    expect(cards[2]).toMatchObject({
      title: "Preparación de entrevista",
      cta: "Practicar ahora",
      path: "/entrevista",
    });
  });

  it("envía los pasos de pago y cita al asesor por WhatsApp", () => {
    const paymentAction = getDashboardNextAction({ stageNumber: 4 });
    const appointmentAction = getDashboardNextAction({ stageNumber: 5 });

    expect(paymentAction).toMatchObject({
      buttonLabel: "Hablar con el asesor",
    });
    expect(paymentAction.path).toContain("https://wa.me/");
    expect(paymentAction.path).toContain("text=");

    expect(appointmentAction).toMatchObject({
      buttonLabel: "Hablar con el asesor",
    });
    expect(appointmentAction.path).toContain("https://wa.me/");
    expect(appointmentAction.path).toContain("text=");
  });
});
