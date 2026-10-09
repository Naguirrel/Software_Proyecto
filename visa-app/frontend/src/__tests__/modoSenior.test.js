import { afterEach, describe, expect, it, vi } from "vitest";
import { initModoSenior, isModoSeniorEnabled, setModoSenior } from "../utils/modoSenior";

afterEach(() => {
  document.documentElement.removeAttribute("data-modo-senior");
});

describe("modoSenior", () => {
  it("activa el atributo global, lo persiste y avisa a quien escuche", () => {
    const listener = vi.fn();
    window.addEventListener("modoSeniorChange", listener);

    setModoSenior(true);

    expect(document.documentElement).toHaveAttribute("data-modo-senior");
    expect(localStorage.getItem("modoSenior")).toBe("true");
    expect(isModoSeniorEnabled()).toBe(true);
    expect(listener.mock.calls[0][0].detail).toBe(true);
    window.removeEventListener("modoSeniorChange", listener);
  });

  it("lo desactiva y quita el atributo", () => {
    setModoSenior(true);
    setModoSenior(false);

    expect(document.documentElement).not.toHaveAttribute("data-modo-senior");
    expect(isModoSeniorEnabled()).toBe(false);
  });

  it("al iniciar la app restaura el modo guardado en cualquier pantalla", () => {
    localStorage.setItem("modoSenior", "true");

    initModoSenior();

    expect(document.documentElement).toHaveAttribute("data-modo-senior");
  });

  it("sincroniza el atributo cuando cambia desde otra pestaña", () => {
    initModoSenior();
    localStorage.setItem("modoSenior", "true");

    window.dispatchEvent(new StorageEvent("storage", { key: "modoSenior" }));

    expect(document.documentElement).toHaveAttribute("data-modo-senior");
  });
});
