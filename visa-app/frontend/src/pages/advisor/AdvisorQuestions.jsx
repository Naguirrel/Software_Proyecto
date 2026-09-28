import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Power } from "lucide-react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorModal, AdvisorPageHeader, AdvisorSearch, AdvisorState } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";

const categories = ["General", "Viaje", "Finanzas", "Laboral", "Historial", "Migración", "Relaciones", "Personal"];
const difficulties = ["Fácil", "Media", "Alta"];
const emptyDraft = { question: "", category: "General", difficulty: "Media", is_required: false };

export default function AdvisorQuestions() {
  const [questions, setQuestions] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    advisorRequest("/questions", { signal: controller.signal }).then((data) => setQuestions(data.questions || []))
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => questions.filter((item) => (category === "Todas" || item.category === category) && item.question.toLowerCase().includes(query.toLowerCase())), [category, query, questions]);
  const openCreate = () => { setSelected({ id: null }); setDraft(emptyDraft); setError(""); };
  const openEdit = (question) => { setSelected(question); setDraft({ question: question.question, category: question.category, difficulty: question.difficulty, is_required: Boolean(question.is_required) }); setError(""); };
  const save = async () => {
    try {
      setSaving(true); setError("");
      const data = await advisorRequest(selected.id ? `/questions/${selected.id}` : "/questions", { method: selected.id ? "PUT" : "POST", body: JSON.stringify(draft) });
      setQuestions((current) => selected.id ? current.map((item) => item.id === data.question.id ? data.question : item) : [data.question, ...current]); setSelected(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const toggle = async (question) => {
    try {
      const data = await advisorRequest(`/questions/${question.id}/status`, { method: "PATCH", body: JSON.stringify({ activo: !question.activo }) });
      setQuestions((current) => current.map((item) => item.id === data.question.id ? data.question : item));
    } catch (requestError) { setError(requestError.message); }
  };

  return <AdvisorLayout>
    <AdvisorPageHeader title="Banco de preguntas" description="Gestiona las preguntas del simulador de entrevistas." action={<button className="advisor-button" type="button" onClick={openCreate}><Plus size={19} aria-hidden="true" /> Nueva pregunta</button>} />
    {error && !selected && <p className="advisor-inline-error" role="alert">{error}</p>}
    <section className="advisor-panel"><div className="advisor-panel-toolbar"><AdvisorSearch value={query} onChange={setQuery} placeholder="Buscar preguntas…" /><label className="advisor-filter"><span className="visually-hidden">Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Todas</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></div><AdvisorState loading={loading} error={loading ? error : ""} empty={!loading && !filtered.length} /><div className="advisor-question-grid">{filtered.map((question) => <article key={question.id} className={!question.activo ? "is-inactive" : ""}><header><span>{question.category}</span><div><em>{question.difficulty}</em>{question.is_required && <b>Obligatoria</b>}</div></header><h2>{question.question}</h2><footer><button type="button" onClick={() => openEdit(question)}><Edit3 size={17} aria-hidden="true" /> Editar</button><button type="button" onClick={() => toggle(question)}><Power size={17} aria-hidden="true" /> {question.activo ? "Desactivar" : "Activar"}</button></footer></article>)}</div></section>
    {selected && <AdvisorModal title={selected.id ? "Editar pregunta" : "Nueva pregunta"} onClose={() => setSelected(null)} footer={<><button className="advisor-button advisor-button--secondary" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="advisor-button" type="button" onClick={save} disabled={saving || !draft.question.trim()}>{saving ? "Guardando…" : "Guardar pregunta"}</button></>}>
      {error && <p className="advisor-inline-error" role="alert">{error}</p>}<div className="advisor-form-grid"><label className="advisor-form-grid__wide">Pregunta<textarea rows="4" value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} /></label><label>Categoría<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Dificultad<select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })}>{difficulties.map((item) => <option key={item}>{item}</option>)}</select></label><label className="advisor-checkbox"><input type="checkbox" checked={draft.is_required} onChange={(event) => setDraft({ ...draft, is_required: event.target.checked })} /> Pregunta obligatoria</label></div>
    </AdvisorModal>}
  </AdvisorLayout>;
}
