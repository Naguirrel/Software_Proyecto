import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DocumentCard from "../components/DocumentCard";

const passportDoc = {
  id: "passport",
  title: "Pasaporte vigente",
  category: "Identificacion Oficial",
  type: "pdf",
  required: true,
  status: "pending",
  updatedAt: "No subido",
  downloadUrl: "",
  storedDocumentId: null,
  feedback: "",
};

describe("DocumentCard", () => {
  it("mantiene la carga vigente conectada a POST /upload", async () => {
    localStorage.setItem("visaguide_session", JSON.stringify({ token: "test-token" }));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:pasaporte") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const documento = { id: 21, estado: "review" };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ documento }),
    });
    const onUploadSuccess = vi.fn();

    const { container } = render(
      <DocumentCard
        doc={passportDoc}
        usuarioId={3}
        onStatusChange={vi.fn()}
        onUploadSuccess={onUploadSuccess}
        onDeleteSuccess={vi.fn()}
      />
    );
    const file = new File(["%PDF-1.4"], "pasaporte.pdf", { type: "application/pdf" });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith("passport", documento));
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("/upload");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.body.get("file")).toBe(file);
    expect(options.body.get("usuario_id")).toBe("3");
  });

  it("rechaza archivos que no cumplen el tipo requerido", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { container } = render(
      <DocumentCard
        doc={passportDoc}
        usuarioId={3}
        onStatusChange={vi.fn()}
        onUploadSuccess={vi.fn()}
        onDeleteSuccess={vi.fn()}
      />
    );

    const input = container.querySelector('input[type="file"]');
    const image = new File(["contenido"], "foto.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [image] } });

    expect(
      await screen.findByText("Este documento requiere un archivo PDF.")
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("muestra error si se intenta subir sin usuario autenticado", async () => {
    const user = userEvent.setup();

    render(
      <DocumentCard
        doc={passportDoc}
        usuarioId={null}
        onStatusChange={vi.fn()}
        onUploadSuccess={vi.fn()}
        onDeleteSuccess={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /subir archivo/i }));

    expect(
      screen.getByText("Inicia sesión para ligar este archivo a tu usuario.")
    ).toBeInTheDocument();
  });
});
