const { expect } = require("@playwright/test");

// Respuestas válidas para cada campo del formulario DS-160, por sección.
// Los campos condicionales (dependeDe) solo aparecen según la respuesta de otro.
const DS160_ANSWERS = [
  { apellidos: "Prueba Ramirez", nombres: "Camila Sofia", otrosNombres: "No", fechaNacimiento: "1992-04-15", lugarNacimiento: "Ciudad de Guatemala", paisNacimiento: "Guatemala" },
  { direccion: "6a avenida 12-34 zona 10", ciudad: "Ciudad de Guatemala", codigoPostal: "01010", telefono: "+502 5555 1234", email: "camila.prueba@visaguide.test" },
  { numeroPasaporte: "A1234567", paisEmision: "Guatemala", fechaEmision: "2022-03-01", fechaExpiracion: "2032-03-01" },
  { proposito: "Turismo", fechaViaje: "2027-03-10", duracionEstancia: "2 semanas", direccionEEUU: "123 Ocean Drive, Miami, FL" },
  { viajaAcompanado: "No" },
  { visitadoEEUU: "No", visaAnterior: "No", visaRechazada: "No" },
  { ocupacion: "Ingeniera de software", empleador: "Tecnologia Guatemala S.A.", direccionTrabajo: "Avenida Reforma 8-60 zona 9", telefonoTrabajo: "+502 2222 3333", ingresoMensual: "15000" },
  { nivelEducativo: "Universidad (completa)", institucion: "Universidad de San Carlos", carrera: "Ingenieria en Sistemas" },
  { estadoCivil: "Soltero/a", nombrePadre: "Carlos Prueba", nombreMadre: "Marta Ramirez", familiaresEEUU: "No" },
  { enfermedadContagiosa: "No", arrestado: "No", terrorismo: "No", deportado: "No" },
];

async function fillField(page, name, value) {
  const control = page.locator(`#campo-${name}`);
  if (await control.count()) {
    const tag = await control.evaluate((node) => node.tagName.toLowerCase());
    if (tag === "select") await control.selectOption(value);
    else await control.fill(value);
    return;
  }
  // Los campos "radio" son un grupo de botones etiquetado por `campo-<nombre>-label`.
  await page
    .locator(`[aria-labelledby="campo-${name}-label"]`)
    .getByRole("button", { name: value, exact: true })
    .click();
}

// Recorre las 10 secciones con "Siguiente" y termina con "Finalizar".
async function completeDs160(page) {
  for (let index = 0; index < DS160_ANSWERS.length; index += 1) {
    const sectionNumber = index + 1;
    await expect(page.getByText(new RegExp(`Sección ${sectionNumber}:`))).toBeVisible();
    for (const [name, value] of Object.entries(DS160_ANSWERS[index])) {
      await fillField(page, name, value);
    }
    const isLast = sectionNumber === DS160_ANSWERS.length;
    if (isLast) {
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: /Finalizar/ }).click();
    } else {
      await page.getByRole("button", { name: "Siguiente →" }).click();
    }
  }
}

module.exports = { DS160_ANSWERS, completeDs160 };
