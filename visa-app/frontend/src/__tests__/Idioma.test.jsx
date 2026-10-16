import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Perfil from "../pages/Perfil/Perfil";
import DashboardStats from "../components/DashboardStats";
import {
  setIdiomaPreferido,
  translate,
  translateValue,
  TRANSLATIONS,
} from "../i18n/translations";
import { getDashboardNextAction, getProcessStageLabel } from "../utils/dashboardStats";

vi.mock("../hooks/useRequireAuth", () => ({
  default: () => ({
    isValidating: false,
    session: { id: 7, nombre: "Ana López", correo: "ana@example.com", perfil: "turismo_negocios" },
  }),
}));

vi.mock("../hooks/useModoSenior", () => ({
  default: () => false,
}));

vi.mock("../components/Sidebar", () => ({
  default: () => <nav data-testid="sidebar" />,
}));

const perfilResponse = (idioma = "es") => ({
  usuario: {
    id: 7,
    nombre: "Ana López",
    correo: "ana@example.com",
    telefono: "",
    ciudad: "",
    pais: "",
    perfil: "turismo_negocios",
    preferencias: { notificacionesEmail: true, idioma },
  },
  tramite: {
    tipoVisa: "B1/B2 (Turismo / Negocios)",
    consulado: "Sin definir",
    estado: "En proceso",
    etapaActual: "Pago de visa",
    etapa: 3,
    totalEtapas: 6,
    activo: true,
  },
});

describe("traducciones", () => {
  it("ambos idiomas tienen las mismas llaves", () => {
    expect(Object.keys(TRANSLATIONS.en).sort()).toEqual(Object.keys(TRANSLATIONS.es).sort());
  });

  it("reemplaza variables, elige plural y usa español aunque se solicite inglés", () => {
    expect(translate("en", "dashboard.greeting", { nombre: "Ana" })).toBe("¡Hola, Ana!");
    expect(translate("es", "stats.documentsHint", { count: 1 })).toBe("documento asociado");
    expect(translate("en", "stats.documentsHint", { count: 3 })).toBe("documentos asociados");
    expect(translate("fr", "sidebar.inicio")).toBe("Inicio");
    expect(translate("en", "llave.inexistente")).toBe("llave.inexistente");
    expect(translateValue("en", "serverStage", "Pago de visa")).toBe("Pago de visa");
    expect(translateValue("en", "serverStage", "Etapa desconocida")).toBe("Etapa desconocida");
  });

  it("las utilidades del dashboard respetan el idioma", () => {
    expect(getProcessStageLabel(2)).toBe("Completar DS-160");
    expect(getProcessStageLabel(2, "en")).toBe("Completar DS-160");
    expect(getDashboardNextAction({ stageNumber: 1, idioma: "en" })).toMatchObject({
      priority: "PRIORIDAD ALTA",
      title: "Completar perfil",
    });
  });

  it("migra una preferencia antigua y mantiene la interfaz en español", () => {
    localStorage.setItem("idioma", "en");
    document.documentElement.lang = "en";
    render(<DashboardStats loading={false} error="" stats={{ ds160Percentage: 40, documentCount: 2 }} />);
    expect(screen.getByText("DS-160 completado")).toBeInTheDocument();
    expect(localStorage.getItem("idioma")).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    setIdiomaPreferido("en");
    expect(screen.getByText("DS-160 completado")).toBeInTheDocument();
    expect(screen.queryByText("DS-160 completed")).not.toBeInTheDocument();
    expect(localStorage.getItem("idioma")).toBe("es");
    expect(document.documentElement.lang).toBe("es");
  });
});

describe("Perfil - idioma de la interfaz", () => {
  it("oculta el selector de idioma y conserva las preferencias disponibles", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => perfilResponse("en") });

    render(<Perfil />);

    expect(await screen.findByRole("heading", { name: "Perfil de Usuario" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Idioma de la interfaz" })).not.toBeInTheDocument();
    expect(screen.queryByText("English")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Notificaciones por Email" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
    expect(localStorage.getItem("idioma")).toBe("es");
  });

  it("el interruptor de notificaciones mueve la perilla dentro del riel", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, options = {}) =>
      Promise.resolve({
        ok: true,
        json: async () => (options.method === "PUT" ? { usuario: perfilResponse().usuario } : perfilResponse()),
      })
    );

    render(<Perfil />);
    const toggle = await screen.findByRole("switch", { name: "Notificaciones por Email" });
    const knob = toggle.querySelector("span");

    expect(knob).toHaveStyle({ left: "2px", transform: "translateX(20px)" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(knob).toHaveStyle({ left: "2px", transform: "translateX(0)" });
  });
});
