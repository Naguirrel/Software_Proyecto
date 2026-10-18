import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initModoSenior, isModoSeniorEnabled, setModoSenior } from "../utils/modoSenior";

afterEach(() => {
  document.documentElement.classList.remove("modo-senior");
  delete document.documentElement.dataset.uiMode;
});

beforeEach(() => {
  localStorage.setItem("visaguide_session", JSON.stringify({ id: 7, rol: "cliente" }));
});

describe("modoSenior", () => {
  it("activa el atributo global, lo persiste y avisa a quien escuche", () => {
    const listener = vi.fn();
    window.addEventListener("modoSeniorChange", listener);

    setModoSenior(true);

    expect(document.documentElement).toHaveClass("modo-senior");
    expect(document.documentElement).toHaveAttribute("data-ui-mode", "senior");
    expect(localStorage.getItem("modoSenior")).toBe("true");
    expect(isModoSeniorEnabled()).toBe(true);
    expect(listener.mock.calls[0][0].detail).toBe(true);
    window.removeEventListener("modoSeniorChange", listener);
  });

  it("lo desactiva y quita el atributo", () => {
    setModoSenior(true);
    setModoSenior(false);

    expect(document.documentElement).not.toHaveClass("modo-senior");
    expect(document.documentElement).toHaveAttribute("data-ui-mode", "standard");
    expect(isModoSeniorEnabled()).toBe(false);
  });

  it("al iniciar la app restaura el modo guardado para un cliente", () => {
    localStorage.setItem("modoSenior", "true");

    initModoSenior();

    expect(document.documentElement).toHaveClass("modo-senior");
    expect(document.documentElement).toHaveAttribute("data-ui-mode", "senior");
  });

  it("no activa el modo para personal administrativo o asesor", () => {
    localStorage.setItem("visaguide_session", JSON.stringify({ id: 9, rol: "admin" }));
    localStorage.setItem("modoSenior", "true");

    initModoSenior();

    expect(document.documentElement).not.toHaveClass("modo-senior");
    expect(document.documentElement).toHaveAttribute("data-ui-mode", "standard");
    expect(isModoSeniorEnabled()).toBe(false);
  });

  it("sincroniza el atributo cuando cambia desde otra pestaña", () => {
    initModoSenior();
    localStorage.setItem("modoSenior", "true");

    window.dispatchEvent(new StorageEvent("storage", { key: "modoSenior" }));

    expect(document.documentElement).toHaveClass("modo-senior");
    expect(document.documentElement).toHaveAttribute("data-ui-mode", "senior");
  });
});
