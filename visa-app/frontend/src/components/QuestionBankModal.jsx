import { useState } from "react";
import { buildQuestionPayload, EXAMPLE_FIELDS, MAX_EXAMPLE_LENGTH } from "../utils/questionExamples";

const DEFAULT_FORM = {
  question: "",
  category: "General",
  difficulty: "Media",
  is_required: false,
  ejemplo_fuerte: "",
  explicacion_fuerte: "",
  ejemplo_debil: "",
  explicacion_debil: "",
};

function getInitialForm(question) {
  if (!question) return DEFAULT_FORM;

  return {
    question: question.question || "",
    category: question.category || "General",
    difficulty: question.difficulty || "Media",
    is_required: Boolean(question.is_required),
    ejemplo_fuerte: question.ejemplo_fuerte || "",
    explicacion_fuerte: question.explicacion_fuerte || "",
    ejemplo_debil: question.ejemplo_debil || "",
    explicacion_debil: question.explicacion_debil || "",
  };
}

export default function QuestionBankModal({
  categories,
  difficulties,
  isSaving,
  mode,
  question,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => getInitialForm(question));

  const handleChange = (event) => {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(buildQuestionPayload(form, mode));
  };

  const title = mode === "edit" ? "Editar pregunta" : "Nueva pregunta";
  const actionLabel = mode === "edit" ? "Guardar cambios" : "Crear pregunta";

  return (
    <div className="question-modal-backdrop" role="presentation">
      <section
        aria-modal="true"
        className="question-modal"
        role="dialog"
        aria-labelledby="question-modal-title"
      >
        <div className="question-modal__header">
          <div>
            <span>Banco de Preguntas</span>
            <h2 id="question-modal-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar modal">
            ×
          </button>
        </div>

        <form className="question-modal__form" onSubmit={handleSubmit}>
          <label>
            Pregunta
            <textarea
              name="question"
              value={form.question}
              onChange={handleChange}
              placeholder="Escribe la pregunta consular..."
              rows={5}
              required
            />
          </label>

          <div className="question-modal__grid">
            <label>
              Categoría
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Dificultad
              <select
                name="difficulty"
                value={form.difficulty}
                onChange={handleChange}
              >
                {difficulties.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="question-modal__checkbox">
            <input
              name="is_required"
              type="checkbox"
              checked={form.is_required}
              onChange={handleChange}
            />
            <span>
              Marcar como pregunta requerida
              <small>Se priorizará en simuladores y sesiones guiadas.</small>
            </span>
          </label>

          <fieldset className="question-modal__examples">
            <legend>Ejemplos de respuesta (opcional)</legend>
            <p>Se muestran al cliente en el simulador de entrevista como referencia.</p>
            {EXAMPLE_FIELDS.map(({ name, label, placeholder }) => (
              <label key={name}>
                {label}
                <textarea
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  rows={3}
                  maxLength={MAX_EXAMPLE_LENGTH}
                />
                <small className="question-modal__counter">
                  {form[name].length}/{MAX_EXAMPLE_LENGTH}
                </small>
              </label>
            ))}
          </fieldset>

          <div className="question-modal__footer">
            <button
              className="question-modal__secondary"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : actionLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
