import { render, screen, waitFor } from "@testing-library/react";
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

  it("reemplaza variables, elige plural y usa español como respaldo", () => {
    expect(translate("en", "dashboard.greeting", { nombre: "Ana" })).toBe("Hi, Ana!");
    expect(translate("es", "stats.documentsHint", { count: 1 })).toBe("documento asociado");
    expect(translate("en", "stats.documentsHint", { count: 3 })).toBe("linked documents");
    expect(translate("fr", "sidebar.inicio")).toBe("Inicio");
    expect(translate("en", "llave.inexistente")).toBe("llave.inexistente");
    expect(translateValue("en", "serverStage", "Pago de visa")).toBe("Visa payment");
    expect(translateValue("en", "serverStage", "Etapa desconocida")).toBe("Etapa desconocida");
  });

  it("las utilidades del dashboard respetan el idioma", () => {
    expect(getProcessStageLabel(2)).toBe("Completar DS-160");
    expect(getProcessStageLabel(2, "en")).toBe("Complete DS-160");
    expect(getDashboardNextAction({ stageNumber: 1, idioma: "en" })).toMatchObject({
      priority: "HIGH PRIORITY",
      title: "Complete profile",
    });
  });

  it("los componentes montados cambian de idioma sin recargar", async () => {
    render(<DashboardStats loading={false} error="" stats={{ ds160Percentage: 40, documentCount: 2 }} />);
    expect(screen.getByText("DS-160 completado")).toBeInTheDocument();

    setIdiomaPreferido("en");

    expect(await screen.findByText("DS-160 completed")).toBeInTheDocument();
    expect(screen.getByText("Application not started")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    setIdiomaPreferido("es");
  });
});

describe("Perfil - idioma de la interfaz", () => {
  it("cambia la interfaz a inglés y guarda la preferencia", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, options = {}) => {
      if (options.method === "PUT") {
        const body = JSON.parse(options.body);
        return Promise.resolve({ ok: true, json: async () => ({ usuario: perfilResponse(body.idioma).usuario }) });
      }
      return Promise.resolve({ ok: true, json: async () => perfilResponse("es") });
    });

    render(<Perfil />);

    expect(await screen.findByRole("heading", { name: "Perfil de Usuario" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Idioma de la interfaz" }), "en");

    expect(await screen.findByRole("heading", { name: "User Profile" })).toBeInTheDocument();
    expect(screen.getByText("Account preferences")).toBeInTheDocument();
    expect(screen.getByText("Visa payment")).toBeInTheDocument();
    expect(screen.getByText("B1/B2 (Tourism / Business)")).toBeInTheDocument();
    expect(localStorage.getItem("idioma")).toBe("en");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/usuario-perfil"),
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ correo: "ana@example.com", idioma: "en" }) })
      )
    );
    setIdiomaPreferido("es");
  });

  it("revierte el idioma si no se pudo guardar", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, options = {}) => {
      if (options.method === "PUT") {
        return Promise.resolve({ ok: false, json: async () => ({ error: "Error de servidor" }) });
      }
      return Promise.resolve({ ok: true, json: async () => perfilResponse("es") });
    });

    render(<Perfil />);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Idioma de la interfaz" }), "en");

    expect(await screen.findByRole("heading", { name: "Perfil de Usuario" })).toBeInTheDocument();
    expect(localStorage.getItem("idioma")).toBe("es");
    expect(window.alert).toHaveBeenCalledWith("Error de servidor");
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
