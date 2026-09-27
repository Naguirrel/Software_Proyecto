import { describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, getErrorMessage } from "../utils/apiClient";
import { buildApiUrl } from "../config/api";

function jsonResponse({ ok, status, data }) {
  return {
    ok,
    status,
    json: vi.fn(async () => data),
    text: vi.fn(async () => ""),
  };
}

describe("apiRequest", () => {
  it("devuelve el JSON de una respuesta exitosa", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      ok: true,
      status: 200,
      data: { success: true },
    }));

    await expect(apiRequest("/health")).resolves.toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(buildApiUrl("/health"), {
      signal: expect.any(AbortSignal),
    });
  });

  it("conserva el mensaje y metadatos de un error HTTP", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      ok: false,
      status: 422,
      data: { error: "El correo no es válido", code: "INVALID_EMAIL", details: { field: "correo" } },
    }));

    const error = await apiRequest("/register").catch((requestError) => requestError);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "El correo no es válido",
      status: 422,
      code: "INVALID_EMAIL",
      details: { field: "correo" },
    });
  });

  it("limpia una sesión existente cuando el servidor responde 401", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({ token: "expired" }));
    localStorage.setItem("correoUsuario", "persona@example.com");
    const expiredListener = vi.fn();
    window.addEventListener("visaguide:session-expired", expiredListener, { once: true });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      ok: false,
      status: 401,
      data: {},
    }));

    await expect(apiRequest("/validar-sesion")).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem("visaguide_session")).toBeNull();
    expect(localStorage.getItem("correoUsuario")).toBeNull();
    expect(expiredListener).toHaveBeenCalledOnce();
  });

  it("normaliza errores de red sin exponer detalles internos", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiRequest("/dashboard")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "No fue posible conectar con el servidor. Verifica tu conexión.",
    });
  });

  it("obtiene mensajes seguros para valores desconocidos", () => {
    expect(getErrorMessage(null, "Error controlado")).toBe("Error controlado");
  });
});
