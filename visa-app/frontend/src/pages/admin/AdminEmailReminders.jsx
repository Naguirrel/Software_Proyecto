import { AlertCircle, CheckCircle2, Loader2, MailCheck, Send } from "lucide-react";
import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { AdminPageHeader } from "../../components/admin/AdminShared";
import { buildApiUrl } from "../../config/api";

function getToken() {
  return JSON.parse(localStorage.getItem("visaguide_session") || "null")?.token || "";
}

function numberOrZero(value) {
  return Number(value) || 0;
}

function formatReminderType(value) {
  const labels = {
    pending_document: "Documento pendiente",
    upcoming_interview: "Entrevista",
  };
  return labels[value] || value || "Recordatorio";
}

function formatStatus(value, reason) {
  const labels = {
    sent: "Enviado",
    dry_run: "Simulado",
    skipped: reason === "duplicate" ? "Duplicado" : "Omitido",
    failed: "Error",
  };
  return labels[value] || value || "Sin estado";
}

function formatDetail(detail) {
  const labels = {
    duplicate: "Ya se procesó hoy",
    simulation: "Simulación: no se envió",
    "no-smtp-config": "Simulación: falta configurar el proveedor de correo",
    disabled: "Recordatorios desactivados",
  };
  return detail.error || labels[detail.reason] || detail.reason || "Procesado";
}

function statusClass(value) {
  if (value === "sent" || value === "dry_run") return "admin-status--approved";
  if (value === "failed") return "admin-status--correction";
  return "admin-status--review";
}

export default function AdminEmailReminders() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [mode, setMode] = useState("");

  useEffect(() => {
    let active = true;
    const token = getToken();

    fetch(buildApiUrl("/admin/email-reminders/status"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => {
        if (active) setMode(data.modo || "");
      })
      // Sin estado se deja ejecutar: el backend igual rechaza si están desactivados.
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const isDisabled = mode === "disabled";

  const runReminders = async () => {
    const token = getToken();
    setIsRunning(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("/admin/email-reminders/run"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No fue posible ejecutar los recordatorios.");
      setSummary({
        encontrados: numberOrZero(data.encontrados),
        enviados: numberOrZero(data.enviados),
        dryRun: numberOrZero(data.dryRun),
        omitidosDuplicado: numberOrZero(data.omitidosDuplicado),
        errores: numberOrZero(data.errores),
        detalles: Array.isArray(data.detalles) ? data.detalles : [],
      });
    } catch (requestError) {
      setError(requestError.message || "No fue posible ejecutar los recordatorios.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Recordatorios por email"
        description="Avisa por correo a los clientes con documentos por completar o corregir y a quienes están en etapa de entrevista."
        action={(
          <button className="admin-primary-button" type="button" onClick={runReminders} disabled={isRunning || isDisabled}>
            {isRunning ? <Loader2 className="admin-button-spinner" aria-hidden="true" /> : <Send aria-hidden="true" size={18} />}
            {isRunning ? "Ejecutando..." : "Ejecutar recordatorios"}
          </button>
        )}
      />

      <section className="admin-panel-card admin-reminder-intro">
        <span aria-hidden="true"><MailCheck size={26} /></span>
        <div>
          <h2>Envío manual</h2>
          <p>
            Cada cliente recibe como máximo un recordatorio por documento o trámite al día,
            y solo si tiene activadas las notificaciones por correo.
            {mode === "dry_run" && " Modo de simulación: verás el resultado, pero no se enviará ningún correo."}
          </p>
        </div>
      </section>

      {isDisabled && (
        <div className="admin-feedback admin-feedback--error" role="status">
          <AlertCircle aria-hidden="true" size={18} />
          <span>Los recordatorios por email están desactivados en este servidor. Para usarlos, cambia EMAIL_REMINDERS_MODE a send.</span>
        </div>
      )}

      {error && (
        <div className="admin-feedback admin-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <span>{error}</span>
        </div>
      )}

      {summary && (
        <>
          <section className="admin-summary-grid admin-email-reminders-summary" aria-label="Resumen de última ejecución">
            <article>
              <small>Encontrados</small>
              <strong>{summary.encontrados}</strong>
            </article>
            <article>
              <small>Enviados</small>
              <strong>{summary.enviados}</strong>
            </article>
            <article>
              <small>Simulados</small>
              <strong>{summary.dryRun}</strong>
            </article>
            <article>
              <small>Duplicados</small>
              <strong>{summary.omitidosDuplicado}</strong>
            </article>
            <article>
              <small>Errores</small>
              <strong>{summary.errores}</strong>
            </article>
          </section>

          <section className="admin-panel-card">
            <div className="admin-panel-card__header">
              <div>
                <h2>Detalles de ejecución</h2>
                <p>{summary.detalles.length} resultados en esta ejecución.</p>
              </div>
              <CheckCircle2 aria-hidden="true" className="admin-reminder-success-icon" />
            </div>

            {summary.detalles.length > 0 ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Destinatario</th>
                      <th>Entidad</th>
                      <th>Estado</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.detalles.map((detail, index) => (
                      <tr key={`${detail.reminderType || "reminder"}-${detail.entityType || "entity"}-${detail.entityId || index}`}>
                        <td>{formatReminderType(detail.reminderType)}</td>
                        <td>{detail.recipientEmail || "Sin correo"}</td>
                        <td>
                          <strong>{detail.entityType || "N/A"}</strong>
                          <small>{detail.entityId || "Sin ID"}</small>
                        </td>
                        <td>
                          <span className={`admin-status ${statusClass(detail.status)}`}>
                            {formatStatus(detail.status, detail.reason)}
                          </span>
                        </td>
                        <td>{formatDetail(detail)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty-state admin-empty-state--compact">
                <strong>Sin recordatorios por enviar</strong>
                <p>Ningún cliente tiene documentos por corregir ni trámites en etapa de entrevista.</p>
              </div>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}
