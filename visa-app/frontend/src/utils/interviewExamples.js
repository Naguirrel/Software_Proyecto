// Ejemplos de respuesta fuerte/débil del banco de preguntas (SP10-20). Todos son opcionales:
// una pregunta puede no tener ninguno, solo el ejemplo, solo la explicación o los dos.

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Extrae de una pregunta del banco los ejemplos que el simulador puede mostrar. */
export function buildQuestionExamples(item) {
  return {
    strong: { quote: cleanText(item?.ejemplo_fuerte), reason: cleanText(item?.explicacion_fuerte) },
    weak: { quote: cleanText(item?.ejemplo_debil), reason: cleanText(item?.explicacion_debil) },
  };
}

/**
 * Contenido de la tarjeta de análisis ("strong" | "weak") de la pregunta actual.
 * - Pregunta de introducción: su ejemplo fijo.
 * - Pregunta del banco con ejemplo o explicación propios: los del banco.
 * - Sin nada propio: la orientación general de siempre.
 */
export function getAnalysisSide(question, side, { intro, general }) {
  const isStrong = side === "strong";
  const label = isStrong ? "Respuesta fuerte" : "Respuesta débil";
  const generalNotes = isStrong ? general.strongNotes : general.weakNotes;

  if (question.id === "intro") {
    return {
      title: isStrong ? "Respuesta Fuerte" : "Respuesta Débil",
      subtitle: "Ejemplo sobre el propósito del viaje",
      quote: isStrong ? intro.strong : intro.weak,
      notes: isStrong ? intro.strongNotes : intro.weakNotes,
    };
  }

  const own = question.examples?.[side];
  if (own && (own.quote || own.reason)) {
    return {
      title: label,
      subtitle: "Ejemplo para esta pregunta",
      quote: own.quote || null,
      notes: own.reason ? [own.reason] : generalNotes,
    };
  }

  return {
    title: isStrong ? "Responde con claridad" : "Evita respuestas vagas",
    subtitle: "Orientación general",
    quote: null,
    notes: generalNotes,
  };
}
