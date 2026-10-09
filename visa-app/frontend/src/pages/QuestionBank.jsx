import { useCallback, useEffect, useMemo, useState } from "react";
import QuestionBankCard from "../components/QuestionBankCard";
import QuestionBankConfirmDialog from "../components/QuestionBankConfirmDialog";
import InterviewReviewPanel from "../components/InterviewReviewPanel";
import QuestionBankModal from "../components/QuestionBankModal";
import QuestionBankToast from "../components/QuestionBankToast";
import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "../utils/sessionAuth";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import { getAdminHeaders } from "../utils/adminHeaders";
import "../styles/questionBank.css";

const CATEGORIES = [
  "General",
  "Viaje",
  "Finanzas",
  "Laboral",
  "Historial",
  "Migración",
  "Relaciones",
  "Personal",
];

const DIFFICULTIES = ["Fácil", "Media", "Alta"];
const ITEMS_PER_PAGE = 6;

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m16.5 16.5 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14m-7-7h14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getErrorMessage(data, fallback) {
  return data?.error || data?.message || fallback;
}

export default function QuestionBank() {
  const { isValidating } = useRequireAuth();
  const modoSenior = useModoSenior();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [difficultyFilter, setDifficultyFilter] = useState("Todas");
  const [requiredFilter, setRequiredFilter] = useState("Todas");
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: "create",
    question: null,
  });
  const [questionToDelete, setQuestionToDelete] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const fetchQuestions = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(buildApiUrl("/questions"), { signal, headers: buildSessionHeaders() });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "No se pudieron cargar las preguntas.")
        );
      }

      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (fetchError) {
      if (fetchError.name === "AbortError") return;
      setError(fetchError.message || "No se pudieron cargar las preguntas.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isValidating) return;
    const controller = new AbortController();
    fetchQuestions(controller.signal);
    return () => controller.abort();
  }, [fetchQuestions, isValidating]);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, difficultyFilter, requiredFilter]);

  const stats = useMemo(() => {
    return {
      total: questions.length,
      required: questions.filter((question) => question.is_required).length,
      categories: new Set(questions.map((question) => question.category)).size,
      high: questions.filter((question) => question.difficulty === "Alta").length,
    };
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return questions.filter((question) => {
      const matchesSearch =
        !normalizedQuery ||
        question.question?.toLowerCase().includes(normalizedQuery) ||
        question.category?.toLowerCase().includes(normalizedQuery) ||
        question.difficulty?.toLowerCase().includes(normalizedQuery);

      const matchesCategory =
        categoryFilter === "Todas" || question.category === categoryFilter;
      const matchesDifficulty =
        difficultyFilter === "Todas" ||
        question.difficulty === difficultyFilter;
      const matchesRequired =
        requiredFilter === "Todas" ||
        (requiredFilter === "Requeridas" && question.is_required) ||
        (requiredFilter === "Opcionales" && !question.is_required);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesDifficulty &&
        matchesRequired
      );
    });
  }, [categoryFilter, difficultyFilter, query, questions, requiredFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedQuestions = filteredQuestions.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const openCreateModal = () => {
    setModalState({ isOpen: true, mode: "create", question: null });
  };

  const openEditModal = (question) => {
    setModalState({ isOpen: true, mode: "edit", question });
  };

  const closeModal = () => {
    if (saving) return;
    setModalState({ isOpen: false, mode: "create", question: null });
  };

  const handleSubmit = async (form) => {
    const isEdit = modalState.mode === "edit";
    const endpoint = isEdit
      ? `/questions/${modalState.question.id}`
      : "/questions";

    try {
      setSaving(true);

      const response = await fetch(buildApiUrl(endpoint), {
        method: isEdit ? "PUT" : "POST",
        headers: getAdminHeaders(true),
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "No se pudo guardar la pregunta.")
        );
      }

      setQuestions((current) =>
        isEdit
          ? current.map((item) =>
              item.id === data.question.id ? data.question : item
            )
          : [data.question, ...current]
      );

      showToast({
        type: "success",
        title: isEdit ? "Pregunta actualizada" : "Pregunta creada",
        message: isEdit
          ? "Los cambios se guardaron correctamente."
          : "La nueva pregunta ya esta disponible en el banco.",
      });
      closeModal();
    } catch (saveError) {
      showToast({
        type: "error",
        title: "No se pudo guardar",
        message: saveError.message || "Revisa los datos e intentalo de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!questionToDelete) return;

    try {
      setDeleting(true);

      const response = await fetch(
        buildApiUrl(`/questions/${questionToDelete.id}`),
        { method: "DELETE", headers: getAdminHeaders() }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "No se pudo eliminar la pregunta.")
        );
      }

      setQuestions((current) =>
        current.filter((question) => question.id !== questionToDelete.id)
      );
      showToast({
        type: "success",
        title: "Pregunta eliminada",
        message: "La pregunta fue removida del banco.",
      });
      setQuestionToDelete(null);
    } catch (deleteError) {
      showToast({
        type: "error",
        title: "No se pudo eliminar",
        message: deleteError.message || "Intentalo de nuevo en unos segundos.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="question-bank-shell">
      <main
        id="main-content"
        tabIndex="-1"
        className={`question-bank-main${
          modoSenior ? " question-bank-main--senior" : ""
        }`}
      >
        {isValidating ? (
          <p className="question-bank-message">Verificando sesion...</p>
        ) : (
          <>
            <section className="question-bank-header">
              <div>
                <span className="question-bank-eyebrow">
                  Administracion consular
                </span>
                <h1>Banco de Preguntas</h1>
                <p>
                  Gestiona preguntas reutilizables para entrevistas migratorias
                  con filtros, dificultad y prioridad operativa.
                </p>
              </div>
              <button type="button" onClick={openCreateModal}>
                <PlusIcon />
                Nueva pregunta
              </button>
            </section>

            <section className="question-bank-stats" aria-label="Resumen">
              <article>
                <span>Total</span>
                <strong>{stats.total}</strong>
                <small>preguntas registradas</small>
              </article>
              <article>
                <span>Requeridas</span>
                <strong>{stats.required}</strong>
                <small>prioridad alta para sesiones</small>
              </article>
              <article>
                <span>Categorias</span>
                <strong>{stats.categories}</strong>
                <small>areas de evaluacion</small>
              </article>
              <article>
                <span>Dificultad alta</span>
                <strong>{stats.high}</strong>
                <small>preguntas sensibles</small>
              </article>
            </section>

            <InterviewReviewPanel onToast={showToast} />

            <section className="question-bank-toolbar" aria-label="Filtros">
              <label className="question-bank-search">
                <SearchIcon />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por pregunta, categoria o dificultad..."
                />
              </label>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filtrar por categoria"
              >
                <option value="Todas">Todas las categorias</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value)}
                aria-label="Filtrar por dificultad"
              >
                <option value="Todas">Todas las dificultades</option>
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>

              <select
                value={requiredFilter}
                onChange={(event) => setRequiredFilter(event.target.value)}
                aria-label="Filtrar por estado"
              >
                <option value="Todas">Todas</option>
                <option value="Requeridas">Requeridas</option>
                <option value="Opcionales">Opcionales</option>
              </select>
            </section>

            {error && (
              <section className="question-bank-empty question-bank-empty--error">
                <strong>No pudimos cargar el banco</strong>
                <p>{error}</p>
                <button type="button" onClick={() => fetchQuestions()}>
                  Reintentar
                </button>
              </section>
            )}

            {!error && loading && (
              <section className="question-bank-grid" aria-label="Cargando">
                {Array.from({ length: 6 }).map((_, index) => (
                  <article className="question-card-skeleton" key={index}>
                    <span />
                    <strong />
                    <p />
                    <p />
                  </article>
                ))}
              </section>
            )}

            {!error && !loading && paginatedQuestions.length === 0 && (
              <section className="question-bank-empty">
                <span aria-hidden="true">?</span>
                <strong>No hay preguntas con estos filtros</strong>
                <p>
                  Ajusta la busqueda o crea una nueva pregunta para este banco.
                </p>
                <button type="button" onClick={openCreateModal}>
                  Crear pregunta
                </button>
              </section>
            )}

            {!error && !loading && paginatedQuestions.length > 0 && (
              <>
                <section
                  className="question-bank-grid"
                  aria-label="Preguntas guardadas"
                >
                  {paginatedQuestions.map((question) => (
                    <QuestionBankCard
                      key={question.id}
                      question={question}
                      onEdit={openEditModal}
                      onDelete={setQuestionToDelete}
                    />
                  ))}
                </section>

                <section className="question-bank-pagination">
                  <span>
                    Mostrando {paginatedQuestions.length} de{" "}
                    {filteredQuestions.length} preguntas
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setPage((current) => current - 1)}
                      disabled={safePage === 1}
                    >
                      Anterior
                    </button>
                    <strong>
                      {safePage} / {totalPages}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setPage((current) => current + 1)}
                      disabled={safePage === totalPages}
                    >
                      Siguiente
                    </button>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>

      {modalState.isOpen && (
        <QuestionBankModal
          categories={CATEGORIES}
          difficulties={DIFFICULTIES}
          isSaving={saving}
          mode={modalState.mode}
          question={modalState.question}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
      <QuestionBankConfirmDialog
        isDeleting={deleting}
        question={questionToDelete}
        onCancel={() => setQuestionToDelete(null)}
        onConfirm={handleDelete}
      />
      <QuestionBankToast toasts={toasts} />
    </div>
  );
}
