import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorModal, AdvisorPageHeader, AdvisorState, AdvisorTabs } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";

const tabs = [{ value: "today", label: "Hoy" }, { value: "upcoming", label: "Próximas" }, { value: "overdue", label: "Atrasadas" }, { value: "completed", label: "Completadas" }];
const emptyDraft = { title: "", dueAt: "", priority: "normal", userId: "" };

function dayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start, end };
}

export default function AdvisorTasks() {
  const [tasks, setTasks] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [tab, setTab] = useState("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    Promise.all([advisorRequest("/tasks", { signal: controller.signal }), advisorRequest("/processes", { signal: controller.signal })])
      .then(([taskData, processData]) => { setTasks(taskData.tasks || []); setProcesses(processData.processes || []); })
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const filtered = useMemo(() => {
    const { start, end } = dayRange();
    return tasks.filter((task) => {
      const due = task.dueAt ? new Date(task.dueAt) : null;
      if (tab === "completed") return task.status === "completed";
      if (task.status === "completed") return false;
      if (tab === "today") return due && due >= start && due < end;
      if (tab === "upcoming") return !due || due >= end;
      return due && due < start;
    });
  }, [tab, tasks]);

  const create = async () => {
    try {
      setSaving(true); setError("");
      const data = await advisorRequest("/tasks", { method: "POST", body: JSON.stringify({ ...draft, userId: draft.userId || null, dueAt: draft.dueAt || null }) });
      setTasks((current) => [...current, data.task]); setCreating(false); setDraft(emptyDraft);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const updateStatus = async (task) => {
    try {
      const status = task.status === "completed" ? "pending" : "completed";
      const data = await advisorRequest(`/tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ status }) });
      setTasks((current) => current.map((item) => item.id === task.id ? data.task : item));
    } catch (requestError) { setError(requestError.message); }
  };
  const remove = async (taskId) => {
    try { await advisorRequest(`/tasks/${taskId}`, { method: "DELETE" }); setTasks((current) => current.filter((item) => item.id !== taskId)); }
    catch (requestError) { setError(requestError.message); }
  };

  return <AdvisorLayout>
    <AdvisorPageHeader title="Mis tareas" description="Organiza tu trabajo diario y seguimiento de solicitantes." action={<button className="advisor-button" type="button" onClick={() => { setError(""); setCreating(true); }}><Plus size={19} aria-hidden="true" /> Nueva tarea</button>} />
    {error && !creating && <p className="advisor-inline-error" role="alert">{error}</p>}
    <section className="advisor-panel"><AdvisorTabs items={tabs} value={tab} onChange={setTab} label="Filtrar tareas" /><AdvisorState loading={loading} error={loading ? error : ""} empty={!loading && !filtered.length} onRetry={() => setRevision((value) => value + 1)} /><div className="advisor-task-list">{filtered.map((task) => <article key={task.id} className={task.status === "completed" ? "is-completed" : ""}><button type="button" className="advisor-task-check" aria-label={task.status === "completed" ? "Reabrir tarea" : "Completar tarea"} onClick={() => updateStatus(task)}>{task.status === "completed" && "✓"}</button><div><strong>{task.title}</strong><p>{task.applicantName || "Tarea general"}</p><small>{task.dueAt ? formatDate(task.dueAt, true) : "Sin fecha límite"}{task.priority === "high" && <em>Alta prioridad</em>}</small></div><button type="button" className="advisor-icon-button" aria-label="Eliminar tarea" onClick={() => remove(task.id)}><Trash2 size={18} aria-hidden="true" /></button></article>)}</div></section>
    {creating && <AdvisorModal title="Nueva tarea" onClose={() => setCreating(false)} footer={<><button className="advisor-button advisor-button--secondary" type="button" onClick={() => setCreating(false)}>Cancelar</button><button className="advisor-button" type="button" onClick={create} disabled={saving || !draft.title.trim()}>{saving ? "Creando…" : "Crear tarea"}</button></>}>
      {error && <p className="advisor-inline-error" role="alert">{error}</p>}<div className="advisor-form-grid"><label className="advisor-form-grid__wide">Título<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength="240" /></label><label>Fecha límite<input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} /></label><label>Prioridad<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option value="normal">Normal</option><option value="high">Alta</option></select></label><label className="advisor-form-grid__wide">Solicitante<select value={draft.userId} onChange={(event) => setDraft({ ...draft, userId: event.target.value })}><option value="">Tarea general</option>{processes.map((process) => <option key={process.solicitante.id} value={process.solicitante.id}>{process.solicitante.nombre}</option>)}</select></label></div>
    </AdvisorModal>}
  </AdvisorLayout>;
}
