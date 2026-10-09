import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorModal, AdvisorPageHeader, AdvisorState, AdvisorTabs } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";

const tabs = [
  { value: "today", label: "Hoy" },
  { value: "upcoming", label: "Próximas" },
  { value: "overdue", label: "Atrasadas" },
  { value: "completed", label: "Completadas" },
];
const emptyDraft = { title: "", dueAt: "", priority: "normal", userId: "" };

function dayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toApiDueAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Selecciona una fecha límite válida.");
  return date.toISOString();
}

export default function AdvisorTasks() {
  const [tasks, setTasks] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [tab, setTab] = useState("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      advisorRequest("/tasks", { signal: controller.signal }),
      advisorRequest("/processes", { signal: controller.signal }),
    ])
      .then(([taskData, processData]) => {
        setTasks(taskData.tasks || []);
        setProcesses(processData.processes || []);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
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

  const openCreate = () => {
    setError("");
    setEditingTask(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  };

  const openEdit = (task) => {
    setError("");
    setEditingTask(task);
    setDraft({
      title: task.title,
      dueAt: toDateTimeLocal(task.dueAt),
      priority: task.priority,
      userId: task.userId ? String(task.userId) : "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingTask(null);
    setDraft(emptyDraft);
    setError("");
  };

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      const payload = {
        title: draft.title.trim(),
        userId: draft.userId || null,
        dueAt: toApiDueAt(draft.dueAt),
        priority: draft.priority,
      };
      const data = editingTask
        ? await advisorRequest(`/tasks/${editingTask.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await advisorRequest("/tasks", { method: "POST", body: JSON.stringify(payload) });
      setTasks((current) => editingTask
        ? current.map((item) => item.id === editingTask.id ? data.task : item)
        : [...current, data.task]);
      setModalOpen(false);
      setEditingTask(null);
      setDraft(emptyDraft);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (task) => {
    if (pendingTaskId) return;
    try {
      setPendingTaskId(task.id);
      setError("");
      const status = task.status === "completed" ? "pending" : "completed";
      const data = await advisorRequest(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setTasks((current) => current.map((item) => item.id === task.id ? data.task : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPendingTaskId(null);
    }
  };

  const remove = async (task) => {
    if (pendingTaskId || !window.confirm(`¿Eliminar la tarea “${task.title}”? Esta acción no se puede deshacer.`)) return;
    try {
      setPendingTaskId(task.id);
      setError("");
      await advisorRequest(`/tasks/${task.id}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPendingTaskId(null);
    }
  };

  return <AdvisorLayout>
    <AdvisorPageHeader
      title="Mis tareas"
      description="Organiza tu trabajo diario y seguimiento de solicitantes."
      action={<button className="advisor-button" type="button" onClick={openCreate}><Plus size={19} aria-hidden="true" /> Nueva tarea</button>}
    />
    {error && !modalOpen && <p className="advisor-inline-error" role="alert">{error}</p>}
    <section className="advisor-panel">
      <AdvisorTabs items={tabs} value={tab} onChange={setTab} label="Filtrar tareas" />
      <AdvisorState loading={loading} error={loading ? error : ""} empty={!loading && !filtered.length} onRetry={() => setRevision((value) => value + 1)} />
      <div className="advisor-task-list">
        {filtered.map((task) => <article key={task.id} className={task.status === "completed" ? "is-completed" : ""}>
          <button
            type="button"
            className="advisor-task-check"
            aria-label={task.status === "completed" ? "Reabrir tarea" : "Completar tarea"}
            onClick={() => updateStatus(task)}
            disabled={pendingTaskId === task.id}
          >{task.status === "completed" && "✓"}</button>
          <div><strong>{task.title}</strong><p>{task.applicantName || "Tarea general"}</p><small>{task.dueAt ? formatDate(task.dueAt, true) : "Sin fecha límite"}{task.priority === "high" && <em>Alta prioridad</em>}</small></div>
          <div className="advisor-task-actions">
            <button type="button" className="advisor-icon-button" aria-label="Editar tarea" onClick={() => openEdit(task)} disabled={Boolean(pendingTaskId)}><Pencil size={18} aria-hidden="true" /></button>
            <button type="button" className="advisor-icon-button" aria-label="Eliminar tarea" onClick={() => remove(task)} disabled={Boolean(pendingTaskId)}><Trash2 size={18} aria-hidden="true" /></button>
          </div>
        </article>)}
      </div>
    </section>
    {modalOpen && <AdvisorModal
      title={editingTask ? "Editar tarea" : "Nueva tarea"}
      onClose={closeModal}
      footer={<>
        <button className="advisor-button advisor-button--secondary" type="button" onClick={closeModal} disabled={saving}>Cancelar</button>
        <button className="advisor-button" type="button" onClick={save} disabled={saving || !draft.title.trim()}>{saving ? "Guardando…" : editingTask ? "Guardar cambios" : "Crear tarea"}</button>
      </>}
    >
      {error && <p className="advisor-inline-error" role="alert">{error}</p>}
      <div className="advisor-form-grid">
        <label className="advisor-form-grid__wide">Título<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={240} /></label>
        <label>Fecha límite<input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} /></label>
        <label>Prioridad<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option value="normal">Normal</option><option value="high">Alta</option></select></label>
        <label className="advisor-form-grid__wide">Solicitante<select value={draft.userId} onChange={(event) => setDraft({ ...draft, userId: event.target.value })}><option value="">Tarea general</option>{processes.map((process) => <option key={process.solicitante.id} value={process.solicitante.id}>{process.solicitante.nombre}</option>)}</select></label>
      </div>
    </AdvisorModal>}
  </AdvisorLayout>;
}
