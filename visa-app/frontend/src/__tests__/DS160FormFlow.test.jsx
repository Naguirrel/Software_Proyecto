import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DS160Form from "../pages/ds160";
import { secciones } from "../data/ds160Sections";

const SESSION = {
  id: 7,
  token: "signed-session-token",
  nombre: "Usuario Prueba",
  correo: "usuario@example.com",
  perfil: "turismo_negocios",
};

function setSession() {
  localStorage.setItem("visaguide_session", JSON.stringify(SESSION));
}

function mockFetch({ datos = {}, seccion_actual = 1, completado = false } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/validar-sesion")) {
      return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
    }
    if (requestUrl.includes("/ds160/load")) {
      return Promise.resolve({ ok: true, json: async () => ({ datos, seccion_actual, completado }) });
    }
    if (requestUrl.includes("/notificaciones/")) {
      return Promise.resolve({ ok: true, json: async () => ({ total: 0 }) });
    }
    if (requestUrl.endsWith("/ds160/pdf")) {
      return Promise.resolve({
        ok: true,
        blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      });
    }
    if (requestUrl.endsWith("/ds160") && options?.method === "POST") {
      return Promise.resolve({ ok: true, json: async () => ({ message: "ok" }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

function renderForm() {
  return render(
    <MemoryRouter>
      <DS160Form />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  setSession();
});

describe("DS-160: carga inicial del formulario", () => {
  it("carga un formulario vacío en la sección 1 cuando el usuario no tiene datos previos", async () => {
    mockFetch();
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    expect(screen.getByLabelText(/APELLIDOS/i)).toHaveValue("");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(Math.round(100 / secciones.length)));
  });

  it("envía el token de sesión al cargar el formulario, no solo el correo", async () => {
    const fetchMock = mockFetch();
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    const loadCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/ds160/load"));
    expect(loadCall).toBeDefined();
    expect(loadCall[1].headers).toMatchObject({ Authorization: `Bearer ${SESSION.token}` });
  });

  it("carga un formulario existente con sus datos y retoma la sección guardada", async () => {
    mockFetch({
      datos: { apellidos: "Perez", nombres: "Ana", otrosNombres: "No", fechaNacimiento: "1990-01-01", lugarNacimiento: "Guatemala", paisNacimiento: "Guatemala" },
      seccion_actual: 1,
    });
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    expect(screen.getByLabelText(/APELLIDOS/i)).toHaveValue("Perez");
    expect(screen.getByLabelText(/^NOMBRES/i)).toHaveValue("Ana");
  });
});

describe("DS-160: validación y navegación entre secciones", () => {
  it("no avanza de sección y muestra errores si faltan campos obligatorios", async () => {
    const user = userEvent.setup();
    mockFetch();
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    await user.click(screen.getByRole("button", { name: "Siguiente →" }));

    expect(await screen.findAllByText("Este campo es obligatorio")).not.toHaveLength(0);
    expect(screen.getByText(/Sección 1: Datos Personales/)).toBeInTheDocument();
  });

  it("avanza a la siguiente sección al completar los campos obligatorios y guarda el progreso", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    await user.type(screen.getByLabelText(/APELLIDOS/i), "Perez");
    await user.type(screen.getByLabelText(/^NOMBRES/i), "Ana");
    await user.click(within(screen.getByRole("group", { name: /OTROS NOMBRES/i })).getByRole("button", { name: "No" }));
    await user.type(screen.getByLabelText(/FECHA DE NACIMIENTO/i), "1990-01-01");
    await user.type(screen.getByLabelText(/CIUDAD DE NACIMIENTO/i), "Guatemala");
    await user.type(screen.getByLabelText(/PAÍS DE NACIMIENTO/i), "Guatemala");

    await user.click(screen.getByRole("button", { name: "Siguiente →" }));

    await screen.findByText(/Sección 2:/);
    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/ds160") && options?.method === "POST");
      expect(saveCall).toBeDefined();
      expect(JSON.parse(saveCall[1].body)).toMatchObject({ seccion_actual: 2, completado: false });
    });
  });

  it("vuelve a la sección anterior sin perder los datos ya ingresados", async () => {
    const user = userEvent.setup();
    mockFetch({ datos: {}, seccion_actual: 2 });
    renderForm();

    await screen.findByText(/Sección 2:/);
    const backButton = screen.getByRole("button", { name: /Anterior/ });
    expect(backButton).toBeEnabled();

    await user.click(backButton);

    await screen.findByText(/Sección 1: Datos Personales/);
  });

  it("deshabilita el botón Anterior en la primera sección", async () => {
    mockFetch();
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();
  });
});

describe("DS-160: guardado manual y descarga de PDF", () => {
  it("guarda el progreso al presionar 'Guardar progreso' y muestra confirmación", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    await user.click(screen.getByRole("button", { name: "Guardar progreso" }));

    await screen.findByText("✓ Progreso guardado");
    const saveCall = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/ds160") && options?.method === "POST");
    expect(saveCall).toBeDefined();
  });

  it("muestra un mensaje de error si el guardado manual falla", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/validar-sesion")) return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
      if (requestUrl.includes("/ds160/load")) return Promise.resolve({ ok: true, json: async () => ({ datos: {}, seccion_actual: 1, completado: false }) });
      if (requestUrl.includes("/notificaciones/")) return Promise.resolve({ ok: true, json: async () => ({ total: 0 }) });
      if (requestUrl.endsWith("/ds160")) return Promise.resolve({ ok: false, json: async () => ({ error: "falló" }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    await user.click(screen.getByRole("button", { name: "Guardar progreso" }));

    await screen.findByText("Error al guardar. Intenta de nuevo.");
  });

  it("descarga el PDF generado por el backend al presionar 'Descargar PDF'", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    renderForm();
    await screen.findByText(/Sección 1: Datos Personales/);

    await user.click(screen.getByRole("button", { name: /Descargar PDF/ }));

    await waitFor(() => {
      const pdfCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/ds160/pdf"));
      expect(pdfCall).toBeDefined();
    });
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });

  it("muestra un mensaje si la descarga del PDF falla", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/validar-sesion")) return Promise.resolve({ ok: true, json: async () => ({ valid: true }) });
      if (requestUrl.includes("/ds160/load")) return Promise.resolve({ ok: true, json: async () => ({ datos: {}, seccion_actual: 1, completado: false }) });
      if (requestUrl.includes("/notificaciones/")) return Promise.resolve({ ok: true, json: async () => ({ total: 0 }) });
      if (requestUrl.endsWith("/ds160/pdf")) return Promise.resolve({ ok: false, json: async () => ({ error: "Formulario DS-160 no encontrado" }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    await user.click(screen.getByRole("button", { name: /Descargar PDF/ }));

    await screen.findByText("Formulario DS-160 no encontrado");
  });
});

describe("DS-160: autoguardado", () => {
  it("guarda automáticamente los cambios sin necesidad de presionar 'Guardar progreso'", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    renderForm();

    await screen.findByText(/Sección 1: Datos Personales/);
    const initialSaveCalls = () => fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/ds160") && options?.method === "POST").length;
    expect(initialSaveCalls()).toBe(0);

    await user.type(screen.getByLabelText(/APELLIDOS/i), "P");

    await waitFor(() => expect(initialSaveCalls()).toBeGreaterThan(0), { timeout: 3000 });
    const [, options] = fetchMock.mock.calls.find(([url, opts]) => String(url).endsWith("/ds160") && opts?.method === "POST");
    expect(JSON.parse(options.body).datos).toMatchObject({ apellidos: "P" });
  });
});
