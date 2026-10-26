import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../utils/apiClient";
import { buildSessionHeaders } from "../utils/sessionAuth";
import ProfileAvatar from "./ProfileAvatar";
import "../styles/advisor-relationship.css";

const REASONS = [
  ["poor_communication", "Problemas de comunicación"],
  ["lack_of_follow_up", "Falta de seguimiento"],
  ["mistreatment", "Malos tratos"],
  ["conflict", "Conflicto o incompatibilidad"],
  ["other", "Otro motivo"],
];

const STATUS_LABELS = {
  pending: "Solicitud en revisión",
  approved: "Cambio aprobado",
  rejected: "Solicitud revisada",
  cancelled: "Solicitud cancelada",
};

export default function AdvisorRelationshipCard() {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiRequest("/advisor-change-requests/context", {
      headers: buildSessionHeaders(),
      signal: controller.signal,
    }).then(setContext).catch((requestError) => {
      if (requestError.name !== "AbortError") setError(requestError.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const result = await apiRequest("/advisor-change-requests", {
        method: "POST",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ category, message }),
      });
      setContext((current) => ({ ...current, request: result.request }));
      setFormOpen(false);
      setCategory("");
      setMessage("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="advisor-relationship-card" aria-busy="true"><p>Cargando información de tu asesor…</p></section>;
  const advisor = context?.advisor;
  const request = context?.request;
  const pending = request?.status === "pending";

  return (
    <section className="advisor-relationship-card" aria-labelledby="assigned-advisor-title">
      <header>
        <div>
          <span>ACOMPAÑAMIENTO</span>
          <h2 id="assigned-advisor-title">Tu asesor asignado</h2>
        </div>
        {advisor && <Link to="/chat">Abrir chat</Link>}
      </header>

      {advisor ? (
        <div className="advisor-relationship-card__person">
          <ProfileAvatar userId={advisor.id} name={advisor.name} version={advisor.avatarVersion} size={64} />
          <div>
            <strong>{advisor.name}</strong>
            <span>Asesor de tu trámite</span>
            <small><Mail aria-hidden="true" />{advisor.email}</small>
            {advisor.phone && <small><Phone aria-hidden="true" />{advisor.phone}</small>}
          </div>
        </div>
      ) : (
        <p className="advisor-relationship-card__empty">Administración todavía está buscando al asesor adecuado para tu trámite.</p>
      )}

      {request && (
        <div className={`advisor-change-status advisor-change-status--${request.status}`} role="status">
          {pending ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <div>
            <strong>{STATUS_LABELS[request.status] || request.status}</strong>
            {pending && <span>Un administrador revisará tu caso antes de realizar cualquier cambio.</span>}
            {!pending && request.resolution && <span>{request.resolution}</span>}
          </div>
        </div>
      )}

      {advisor && !pending && !formOpen && (
        <div className="advisor-change-entry">
          <strong>¿Algún problema con tu asesor?</strong>
          <p>Si algo no está funcionando, cuéntanos qué ocurrió. Un administrador revisará tu caso de forma confidencial.</p>
          <button className="advisor-change-trigger" type="button" onClick={() => setFormOpen(true)}>
            Contar mi caso
          </button>
        </div>
      )}

      {formOpen && (
        <form className="advisor-change-form" onSubmit={submit}>
          <h3>Cuéntanos qué ocurrió</h3>
          <p>Administración revisará tu explicación de forma confidencial antes de tomar una decisión.</p>
          <label>
            Motivo
            <select value={category} onChange={(event) => setCategory(event.target.value)} required>
              <option value="">Selecciona un motivo</option>
              {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Descripción
            <textarea aria-label="Descripción" value={message} onChange={(event) => setMessage(event.target.value)} minLength="20" maxLength="2000" rows="5" required placeholder="Describe los hechos concretos y cualquier información que ayude a evaluar tu solicitud." />
            <small>{message.length} / 2000</small>
          </label>
          <footer>
            <button type="button" onClick={() => { setFormOpen(false); setError(""); }} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving || category === "" || message.trim().length < 20}>{saving ? "Enviando…" : "Enviar caso para revisión"}</button>
          </footer>
        </form>
      )}
      {error && <p className="advisor-relationship-card__error" role="alert">{error}</p>}
    </section>
  );
}
