import { describe, expect, it } from "vitest";
import { buildDs160PdfFilename } from "../utils/ds160PdfFilename";

describe("nombre del PDF DS-160", () => {
  it("usa el primer nombre y primer apellido de los campos separados del formulario", () => {
    expect(buildDs160PdfFilename(
      { nombres: "Norman David", apellidos: "Aguirre López" },
      { nombre: "Otro Nombre" }
    )).toBe("Form_DS160_Norman_Aguirre.pdf");
  });

  it("evita usar el segundo nombre como apellido cuando solo hay nombre de sesión", () => {
    expect(buildDs160PdfFilename({}, { nombre: "Norman David Aguirre López" }))
      .toBe("Form_DS160_Norman_Aguirre.pdf");
  });

  it("limpia caracteres inválidos y usa un respaldo si faltan datos", () => {
    expect(buildDs160PdfFilename({ nombres: "Ána/", apellidos: "Núñez:*" }))
      .toBe("Form_DS160_Ana_Nunez.pdf");
    expect(buildDs160PdfFilename()).toBe("Form_DS160_Usuario_Apellido.pdf");
  });
});
