function firstWord(value) {
  return String(value || "").trim().split(/\s+/)[0] || "";
}

function safePart(value, fallback) {
  return firstWord(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]/g, "") || fallback;
}

export function buildDs160PdfFilename(formData = {}, session = {}) {
  const fullName = String(session?.nombre || "").trim().split(/\s+/).filter(Boolean);
  const firstName = formData?.nombres || fullName[0];

  // La sesión guarda un solo nombre completo; el DS-160 separa nombres y apellidos.
  // Solo se infiere el apellido de la sesión cuando el formulario aún no lo tiene.
  const inferredSurname = fullName.length >= 4
    ? fullName[fullName.length - 2]
    : fullName.length >= 2 ? fullName[fullName.length - 1] : "";
  const surname = formData?.apellidos || inferredSurname;

  return `Form_DS160_${safePart(firstName, "Usuario")}_${safePart(surname, "Apellido")}.pdf`;
}
