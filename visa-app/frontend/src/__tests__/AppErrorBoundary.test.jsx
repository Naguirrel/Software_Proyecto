import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "../components/AppErrorBoundary";

describe("AppErrorBoundary", () => {
  it("muestra una recuperación accesible y permite reintentar el render", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldFail = true;
    function RecoverableContent() {
      if (shouldFail) throw new Error("chunk failed");
      return <p>Contenido recuperado</p>;
    }

    render(
      <AppErrorBoundary>
        <RecoverableContent />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos mostrar esta página");
    shouldFail = false;
    await userEvent.click(screen.getByRole("button", { name: /Intentar de nuevo/i }));
    expect(screen.getByText("Contenido recuperado")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});
