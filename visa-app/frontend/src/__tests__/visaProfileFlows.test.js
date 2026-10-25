import { describe, expect, it } from "vitest";
import { getDs160Sections, secciones } from "../data/ds160Sections";
import { validarCampo } from "../utils/ds160Validation";

describe("flujos por tipo de visa", () => {
  it("agrega información SEVIS e institución solamente al DS-160 estudiantil", () => {
    const studentSections = getDs160Sections("estudiante");
    const visitorSections = getDs160Sections("turismo_negocios");
    const studentFields = studentSections.flatMap((section) => section.campos.map((field) => field.name));
    const visitorFields = visitorSections.flatMap((section) => section.campos.map((field) => field.name));

    expect(studentSections).toHaveLength(secciones.length + 1);
    expect(studentFields).toEqual(expect.arrayContaining(["studentVisaClass", "sevisId", "schoolSevisCode", "studyFundingSource"]));
    expect(visitorFields).not.toContain("sevisId");
  });

  it("agrega los datos de la visa anterior solamente a renovación", () => {
    const fields = getDs160Sections("renovacion").flatMap((section) => section.campos.map((field) => field.name));
    expect(fields).toEqual(expect.arrayContaining([
      "previousVisaNumber",
      "previousVisaIssueDate",
      "previousVisaExpirationDate",
      "previousVisaLostOrStolen",
    ]));
  });

  it("valida el formato oficial del identificador SEVIS", () => {
    const field = getDs160Sections("estudiante").flatMap((section) => section.campos).find((item) => item.name === "sevisId");
    expect(validarCampo(field, "N0012345678", {})).toBeNull();
    expect(validarCampo(field, "A0012345678", {})).toMatch(/SEVIS válido/);
    expect(validarCampo(field, "N123", {})).toMatch(/al menos 11/);
  });
});
