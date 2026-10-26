import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, MessageSquareWarning, X } from "lucide-react";
import { adminRequest } from "../../hooks/useAdminResource";
import ProfileAvatar from "../ProfileAvatar";

const CATEGORY_LABELS = {
  mistreatment: "Malos tratos",
  poor_communication: "Problemas de comunicación",
  lack_of_follow_up: "Falta de seguimiento",
  conflict: "Conflicto o incompatibilidad",
  other: "Otro motivo",
};

export default function AdvisorChangeQueue({ advisors = [], onResolved }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [newAdvisorId, setNewAdvisorId] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await adminRequest("/admin/advisor-change-requests?status=pending");
      setRequests(data.requests || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const candidates = useMemo(() => advisors.filter((advisor) => (
    advisor.disponible
    && Number(advisor.id) !== Number(selected?.currentAdvisor?.id)
    && Number(advisor.asignados) < Number(advisor.capacidad)
  )), [advisors, selected]);

  const open = (request) => {
    setSelected(request);
    setNewAdvisorId("");
    setResolution("");
    setError("");
  };

  const resolve = async (decision) => {
    if (!selected || saving) return;
    try {
      setSaving(true);
      setError("");
      await adminRequest(`/admin/advisor-change-requests/${selected.id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({
          decision,
          resolution,
          newAdvisorId: decision === "approved" ? Number(newAdvisorId) : undefined,
        }),
      });
      setRequests((current) => current.filter((item) => item.id !== selected.id));
      setSelected(null);
      onResolved?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-list-card admin-advisor-change-queue" aria-labelledby="advisor-change-queue-title">
      <header className="admin-card-title">
        <div>
          <span className="admin-priority-kicker">REQUIERE EVALUACIÓN</span>
          <h3 id="advisor-change-queue-title">Solicitudes de cambio de asesor <span>{requests.length}</span></h3>
          <p>Revisa la explicación del solicitante antes de reasignar el expediente.</p>
        </div>
      </header>
      {loading ? <p className="admin-inline-empty" role="status">Cargando solicitudes…</p>
        : error && !selected ? <div className="admin-inline-empty" role="alert"><p>{error}</p><button type="button" onClick={load}>Reintentar</button></div>
          : requests.length ? <div className="admin-change-request-list">{requests.map((request) => (
            <button type="button" key={request.id} onClick={() => open(request)}>
              <ProfileAvatar userId={request.userId} name={request.applicantName} version={request.applicantAvatarVersion} size={46} />
              <span><strong>{request.applicantName}</strong><small>{CATEGORY_LABELS[request.category]}</small><em>Asesor actual: {request.currentAdvisor.name}</em></span>
              <AlertTriangle aria-hidden="true" />
            </button>
          ))}</div>
            : <div className="admin-assignment-empty" role="status"><MessageSquareWarning aria-hidden="true" /><strong>Sin solicitudes pendientes</strong><p>Las solicitudes enviadas por los clientes aparecerán aquí.</p></div>}

      {selected && (
        <div className="admin-change-review" role="dialog" aria-modal="true" aria-labelledby="advisor-change-review-title">
          <button className="admin-change-review__close" type="button" aria-label="Cerrar revisión" onClick={() => setSelected(null)}><X aria-hidden="true" /></button>
          <div className="admin-change-review__people">
            <ProfileAvatar userId={selected.userId} name={selected.applicantName} version={selected.applicantAvatarVersion} size={62} />
            <div><span>Solicitante</span><h3 id="advisor-change-review-title">{selected.applicantName}</h3><small>{selected.applicantEmail}</small></div>
          </div>
          <dl><div><dt>Motivo</dt><dd>{CATEGORY_LABELS[selected.category]}</dd></div><div><dt>Asesor actual</dt><dd>{selected.currentAdvisor.name}</dd></div></dl>
          <blockquote>{selected.message}</blockquote>
          <label>Resolución administrativa<textarea rows="4" minLength="10" maxLength="2000" value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Explica la decisión y deja constancia de la evaluación." /></label>
          <label>Nuevo asesor, si se aprueba<select value={newAdvisorId} onChange={(event) => setNewAdvisorId(event.target.value)}><option value="">Selecciona un asesor disponible</option>{candidates.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.nombre} · {advisor.asignados}/{advisor.capacidad} casos</option>)}</select></label>
          {error && <p className="admin-feedback" role="alert">{error}</p>}
          <footer>
            <button type="button" className="is-reject" disabled={saving || resolution.trim().length < 10} onClick={() => resolve("rejected")}><X aria-hidden="true" />Rechazar</button>
            <button type="button" disabled={saving || resolution.trim().length < 10 || !newAdvisorId} onClick={() => resolve("approved")}><Check aria-hidden="true" />{saving ? "Guardando…" : "Aprobar y reasignar"}</button>
          </footer>
        </div>
      )}
    </section>
  );
}
