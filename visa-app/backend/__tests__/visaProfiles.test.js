const {
  PROFILE_KEYS,
  getDocumentsForProfile,
  getProfileConfig,
  getRequiredDocumentKeys,
  normalizeProfileKey,
} = require("../config/visaProfiles");

describe("configuración de requisitos por tipo de visa", () => {
  test("mantiene cinco perfiles canónicos y normaliza valores heredados", () => {
    expect(PROFILE_KEYS).toEqual([
      "turismo_negocios",
      "estudiante",
      "renovacion",
      "grupo_familiar",
      "adulto_mayor",
    ]);
    expect(normalizeProfileKey("Visa estudiante F1")).toBe("estudiante");
    expect(normalizeProfileKey("Grupo Familiar B1/B2")).toBe("grupo_familiar");
    expect(normalizeProfileKey("perfil desconocido")).toBeNull();
  });

  test("solicita I-20 y comprobante SEVIS solo al perfil estudiante", () => {
    const studentRequired = getRequiredDocumentKeys("estudiante");
    const visitorRequired = getRequiredDocumentKeys("turismo_negocios");

    expect(studentRequired).toEqual(expect.arrayContaining(["passport", "photo", "form-i20", "sevis-i901-receipt"]));
    expect(visitorRequired).toEqual(["passport", "photo"]);
    expect(visitorRequired).not.toContain("form-i20");
    expect(getProfileConfig("estudiante").sevisFeeUsdCents).toBe(35000);
  });

  test("genera pasaporte y fotografía independientes para cada integrante familiar", () => {
    const documents = getDocumentsForProfile("grupo_familiar", [
      { id: 12, full_name: "María Pérez" },
      { id: 15, full_name: "Luis Pérez" },
    ]);

    expect(documents.map((document) => document.id)).toEqual(expect.arrayContaining([
      "family-12-passport",
      "family-12-photo",
      "family-15-passport",
      "family-15-photo",
    ]));
    expect(documents.find((document) => document.id === "family-12-passport")).toMatchObject({
      applicant: "María Pérez",
      required: true,
    });
  });

  test("expone documentación oficial por etapas para todos los perfiles", () => {
    for (const profile of PROFILE_KEYS) {
      const checklist = getProfileConfig(profile).officialChecklist;
      expect(checklist.some((item) => item.stage === "ds160" && item.requirement === "required")).toBe(true);
      expect(checklist.some((item) => item.stage === "appointment")).toBe(true);
    }
  });
});
