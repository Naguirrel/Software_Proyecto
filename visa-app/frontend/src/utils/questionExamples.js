// Ejemplos de respuesta que se muestran en el simulador de entrevista; todos opcionales.
export const MAX_EXAMPLE_LENGTH = 2000;
export const EXAMPLE_FIELDS = [
  {
    name: "ejemplo_fuerte",
    label: "Ejemplo de respuesta fuerte",
    placeholder: "Una respuesta clara, concreta y creíble...",
  },
  {
    name: "explicacion_fuerte",
    label: "Por qué es una respuesta fuerte",
    placeholder: "Qué hace que esta respuesta convenza al oficial consular...",
  },
  {
    name: "ejemplo_debil",
    label: "Ejemplo de respuesta débil",
    placeholder: "Una respuesta vaga, contradictoria o que genera dudas...",
  },
  {
    name: "explicacion_debil",
    label: "Por qué es una respuesta débil",
    placeholder: "Qué problema tiene esta respuesta y cómo mejorarla...",
  },
];

// Al editar se envían siempre los ejemplos (un campo vacío los borra); al crear solo los escritos.
export function buildQuestionPayload(form, mode) {
  const payload = {
    question: form.question,
    category: form.category,
    difficulty: form.difficulty,
    is_required: form.is_required,
  };
  for (const { name } of EXAMPLE_FIELDS) {
    const value = (form[name] || "").trim();
    if (mode === "edit" || value) payload[name] = value;
  }
  return payload;
}
