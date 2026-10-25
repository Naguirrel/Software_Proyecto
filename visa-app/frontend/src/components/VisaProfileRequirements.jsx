import { useEffect, useState } from "react";
import { CheckCircle2, Info, Plus, Trash2, Users } from "lucide-react";
import { apiRequest, getErrorMessage } from "../utils/apiClient";
import { buildSessionHeaders } from "../utils/sessionAuth";

const RELATIONSHIPS = [
  ["conyuge", "Cónyuge"],
  ["hijo_hija", "Hijo o hija"],
  ["padre_madre", "Padre o madre"],
  ["hermano_hermana", "Hermano o hermana"],
  ["otro", "Otro"],
];

const emptyMember = { fullName: "", relationship: "hijo_hija", dateOfBirth: "" };

const STAGE_LABELS = {
  preparation: "Preparación",
  ds160: "Después del DS-160",
  payment: "Antes de la cita",
  appointment: "Cita o entrega",
  interview: "Entrevista",
};

function toBooleanField(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function RenewalEligibility({ requirements, onRefresh }) {
  const details = requirements.details || {};
  const [form, setForm] = useState({
    priorVisaClass: "B1/B2",
    priorVisaExpirationDate: details.priorVisaExpirationDate || "",
    priorVisaFullValidity: toBooleanField(details.priorVisaFullValidity),
    issuedAtAgeEighteenOrOlder: toBooleanField(details.issuedAtAgeEighteenOrOlder),
    refusalStatus: details.refusalStatus || "",
    hasPotentialIneligibility: toBooleanField(details.hasPotentialIneligibility),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiRequest("/visa-profile/details", {
        method: "PUT",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          priorVisaClass: form.priorVisaClass,
          priorVisaExpirationDate: form.priorVisaExpirationDate,
          priorVisaFullValidity: form.priorVisaFullValidity === "yes",
          issuedAtAgeEighteenOrOlder: form.issuedAtAgeEighteenOrOlder === "yes",
          refusalStatus: form.refusalStatus,
          hasPotentialIneligibility: form.hasPotentialIneligibility === "yes",
        }),
        fallbackMessage: "No se pudo guardar la evaluación de renovación.",
      });
      setMessage("Evaluación guardada.");
      await onRefresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const eligibility = requirements.renewalEligibility;
  return (
    <section className="visa-profile-panel visa-profile-panel--form" aria-labelledby="renewal-check-title">
      <header>
        <div><Info aria-hidden="true" /><h2 id="renewal-check-title">Evaluación inicial de renovación</h2></div>
        <p>Esta evaluación solo indica elegibilidad potencial. El portal oficial o el consulado toma la decisión final.</p>
      </header>
      {eligibility?.complete && (
        <div className={`visa-profile-result ${eligibility.potentiallyEligible ? "is-positive" : "is-neutral"}`} role="status">
          <strong>{eligibility.potentiallyEligible
            ? "Podrías calificar para entrega de documentos sin entrevista inicial."
            : "Debes continuar esperando una entrevista consular."}</strong>
          <span>Un oficial consular puede solicitar entrevista en cualquier momento.</span>
        </div>
      )}
      <form className="visa-profile-form" onSubmit={submit}>
        <label>Fecha de vencimiento de la visa anterior<input type="date" required value={form.priorVisaExpirationDate} onChange={(event) => setForm({ ...form, priorVisaExpirationDate: event.target.value })} /></label>
        <label>¿La visa anterior fue emitida con vigencia completa?<select required value={form.priorVisaFullValidity} onChange={(event) => setForm({ ...form, priorVisaFullValidity: event.target.value })}><option value="">Selecciona</option><option value="yes">Sí</option><option value="no">No</option></select></label>
        <label>¿Tenías 18 años o más cuando fue emitida?<select required value={form.issuedAtAgeEighteenOrOlder} onChange={(event) => setForm({ ...form, issuedAtAgeEighteenOrOlder: event.target.value })}><option value="">Selecciona</option><option value="yes">Sí</option><option value="no">No</option></select></label>
        <label>Historial de denegaciones<select required value={form.refusalStatus} onChange={(event) => setForm({ ...form, refusalStatus: event.target.value })}><option value="">Selecciona</option><option value="none">Nunca me denegaron una visa</option><option value="overcome_or_waived">La denegación fue superada o dispensada</option><option value="unresolved">Tengo una denegación no resuelta</option></select></label>
        <label>¿Conoces alguna posible causa de inadmisibilidad?<select required value={form.hasPotentialIneligibility} onChange={(event) => setForm({ ...form, hasPotentialIneligibility: event.target.value })}><option value="">Selecciona</option><option value="no">No</option><option value="yes">Sí</option></select></label>
        <button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar evaluación"}</button>
      </form>
      {message && <p className="visa-profile-message" role="status">{message}</p>}
      {error && <p className="visa-profile-message visa-profile-message--error" role="alert">{error}</p>}
    </section>
  );
}

function FamilyMember({ member, onRefresh }) {
  const [confirmation, setConfirmation] = useState(member.ds160ConfirmationNumber || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setConfirmation(member.ds160ConfirmationNumber || ""), [member.ds160ConfirmationNumber]);

  const saveConfirmation = async () => {
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/visa-profile/family-members/${member.id}`, {
        method: "PUT",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ds160ConfirmationNumber: confirmation }),
      });
      await onRefresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar a ${member.fullName} del expediente?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/visa-profile/family-members/${member.id}`, {
        method: "DELETE",
        headers: buildSessionHeaders(),
      });
      await onRefresh();
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="family-member-card">
      <div><strong>{member.fullName}</strong><span>{RELATIONSHIPS.find(([key]) => key === member.relationship)?.[1] || "Integrante"} · {member.dateOfBirth}</span></div>
      <label>Confirmación DS-160 individual<input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} placeholder="Ej. AA00ABC123" /></label>
      <button type="button" onClick={saveConfirmation} disabled={saving || !confirmation.trim()}>{member.ds160Complete ? "Actualizar DS-160" : "Guardar DS-160"}</button>
      <button className="family-member-delete" type="button" onClick={remove} disabled={saving} aria-label={`Eliminar a ${member.fullName}`}><Trash2 aria-hidden="true" /></button>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}

function FamilyGroupManager({ requirements, onRefresh }) {
  const [form, setForm] = useState(emptyMember);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const members = requirements.familyMembers || [];

  const addMember = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/visa-profile/family-members", {
        method: "POST",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(form),
      });
      setForm(emptyMember);
      await onRefresh();
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="visa-profile-panel visa-profile-panel--family" aria-labelledby="family-group-title">
      <header><div><Users aria-hidden="true" /><h2 id="family-group-title">Integrantes del grupo familiar</h2></div><p>El solicitante principal ya está incluido. Registra aquí a cada persona adicional.</p></header>
      <div className="family-summary"><strong>{requirements.personCount}</strong><span>solicitantes · cada uno necesita DS-160, documentos y tarifa individual</span></div>
      {members.map((member) => <FamilyMember key={member.id} member={member} onRefresh={onRefresh} />)}
      <form className="family-member-form" onSubmit={addMember}>
        <h3><Plus aria-hidden="true" />Agregar integrante</h3>
        <label>Nombre completo<input required minLength="3" maxLength="160" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
        <label>Parentesco<select value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })}>{RELATIONSHIPS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Fecha de nacimiento<input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></label>
        <button type="submit" disabled={saving}>{saving ? "Agregando…" : "Agregar integrante"}</button>
      </form>
      {error && <p className="visa-profile-message visa-profile-message--error" role="alert">{error}</p>}
    </section>
  );
}

export default function VisaProfileRequirements({ requirements, onRefresh }) {
  if (!requirements) return null;
  return (
    <>
      <section className="visa-profile-panel" aria-labelledby="visa-profile-title">
        <header>
          <div><CheckCircle2 aria-hidden="true" /><h2 id="visa-profile-title">Requisitos para {requirements.label}</h2></div>
          <p>{requirements.guidance}</p>
        </header>
        <dl className="visa-profile-facts">
          <div><dt>Clase</dt><dd>{requirements.visaClass}</dd></div>
          <div><dt>Solicitantes</dt><dd>{requirements.personCount}</dd></div>
          <div><dt>Tarifa gubernamental</dt><dd>USD {(requirements.governmentFeeUsdCentsPerPerson / 100).toFixed(0)} por persona</dd></div>
          {requirements.sevisFeeUsdCents && <div><dt>SEVIS I-901</dt><dd>USD {(requirements.sevisFeeUsdCents / 100).toFixed(0)} adicionales</dd></div>}
        </dl>
        {requirements.officialChecklist?.length > 0 && <div className="visa-official-checklist">
          <h3>Documentación oficial por etapa</h3>
          <p>Esta guía se adapta a tu categoría. Las instrucciones emitidas para tu cita siempre tienen prioridad.</p>
          <ol>
            {requirements.officialChecklist.map((item, index) => <li key={`${item.stage}-${item.label}-${index}`}>
              <span>{STAGE_LABELS[item.stage] || item.stage}</span>
              <div><strong>{item.label}</strong><small>{item.note}</small></div>
              <em>{item.requirement === "required" ? "Obligatorio" : item.requirement === "conditional" ? "Si aplica" : "Puede solicitarse"}</em>
            </li>)}
          </ol>
        </div>}
      </section>
      {requirements.profile === "renovacion" && <RenewalEligibility requirements={requirements} onRefresh={onRefresh} />}
      {requirements.profile === "grupo_familiar" && <FamilyGroupManager requirements={requirements} onRefresh={onRefresh} />}
      {requirements.profile === "adulto_mayor" && <section className="visa-profile-panel visa-profile-panel--notice"><Info aria-hidden="true" /><div><h2>Modo Senior activado</h2><p>La interfaz accesible está habilitada. La entrevista se mantiene en el proceso salvo que el portal oficial confirme una exención por otra condición aplicable.</p></div></section>}
    </>
  );
}
