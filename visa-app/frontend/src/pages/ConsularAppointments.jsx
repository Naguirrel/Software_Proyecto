import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Loader2, MapPin, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { buildApiUrl } from "../config/api";
import useRequireAuth from "../hooks/useRequireAuth";
import "../styles/consular.css";

const formatAppointment = (value) => new Intl.DateTimeFormat("es-GT", {
  dateStyle: "full", timeStyle: "short", timeZone: "America/Guatemala",
}).format(new Date(value));

function headers(session) { return { Authorization: `Bearer ${session.token}` }; }

export default function ConsularAppointments() {
  const { isValidating, session } = useRequireAuth();
  const [payment, setPayment] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeAppointment = useMemo(() => appointments.find((item) => item.status === "scheduled") || null, [appointments]);

  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    Promise.all([
      fetch(buildApiUrl("/payments/me"), { headers: headers(session), signal: controller.signal }),
      fetch(buildApiUrl("/appointments/me"), { headers: headers(session), signal: controller.signal }),
    ]).then(async (responses) => {
      const data = await Promise.all(responses.map((response) => response.json()));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed >= 0) throw new Error(data[failed].error || "No se pudo cargar el seguimiento consular.");
      setPayment(data[0]);
      setAppointments(data[1].appointments || []);
    }).catch((loadError) => { if (loadError.name !== "AbortError") setError(loadError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session]);

  return <div className="vg-layout">
    <Sidebar currentPage="citas" />
    <main id="main-content" tabIndex="-1" className="vg-main consular-main">
      <header className="consular-heading">
        <div className="consular-heading__icon"><CalendarDays aria-hidden="true" /></div>
        <div><p className="consular-eyebrow">Paso 4 de tu proceso</p><h1>Cita consular</h1><p>Consulta el pago oficial y la cita gestionada por tu asesor.</p></div>
      </header>
      {error && <div className="consular-alert consular-alert--error" role="alert">{error}</div>}
      {isValidating || loading ? <div className="consular-loading" role="status"><Loader2 className="consular-spin" aria-hidden="true" /> Consultando seguimiento…</div> : !payment?.customerPaid ? (
        <section className="consular-card consular-gate"><ReceiptText className="consular-feature-icon" aria-hidden="true" /><h2>{payment?.transferPending ? "Transferencia pendiente de validación" : "Completa primero el pago del trámite"}</h2><p className="consular-muted">{payment?.transferPending ? "Tu asesor está revisando el comprobante bancario." : "La gestión consular inicia después de confirmar la transferencia."}</p><Link className="consular-button" to="/pagos">Ver pago</Link></section>
      ) : <div className="consular-grid">
        <section className="consular-card consular-card--primary consular-card--wide">
          <div className="consular-card__top"><span>Gestión ante el consulado</span><span className={`consular-status consular-status--${payment.consularPaid ? "paid" : "pending"}`}>{payment.consularPaid ? "Pago oficial registrado" : "En gestión"}</span></div>
          <div className="consular-progress-list">
            <div className="is-complete"><CheckCircle2 aria-hidden="true" /><span><strong>Transferencia confirmada</strong><small>La empresa recibió el pago del paquete.</small></span></div>
            <div className={payment.consularPaid ? "is-complete" : ""}>{payment.consularPaid ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}<span><strong>Pago ante el consulado</strong><small>{payment.consularPaid ? `Recibo oficial ${payment.latest?.official_receipt_number}` : "Tu asesor está realizando esta gestión."}</small></span></div>
            <div className={activeAppointment ? "is-complete" : ""}>{activeAppointment ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}<span><strong>Cita consular</strong><small>{activeAppointment ? "Fecha oficial registrada." : "Pendiente de disponibilidad y confirmación oficial."}</small></span></div>
          </div>
          {payment.latest?.official_receipt_url && <a className="consular-button consular-button--secondary" href={payment.latest.official_receipt_url} target="_blank" rel="noreferrer">Ver comprobante oficial</a>}
        </section>
        {activeAppointment && <section className="consular-card consular-card--wide">
          <div className="consular-card__top"><span>Próxima cita</span><span className="consular-status consular-status--paid">Confirmada</span></div>
          <div className="consular-appointment">
            <div><CalendarDays aria-hidden="true" /><span>Fecha y hora</span><strong>{formatAppointment(activeAppointment.appointment_at)}</strong></div>
            <div><MapPin aria-hidden="true" /><span>Ubicación</span><strong>{activeAppointment.consulate}</strong></div>
            <div><CheckCircle2 aria-hidden="true" /><span>Confirmación oficial</span><strong>{activeAppointment.confirmation_code}</strong></div>
          </div>
          <p className="consular-muted"><strong>Acercamientos utilizados: {activeAppointment.reschedule_count || 0} de 2.</strong> Quedan {activeAppointment.remaining_reschedules ?? Math.max(0, 2 - Number(activeAppointment.reschedule_count || 0))}. Cada acercamiento depende de que la embajada libere una fecha anterior.</p>
          {activeAppointment.notes && <p className="consular-muted">{activeAppointment.notes}</p>}
        </section>}
        <section className="consular-card consular-card--wide" data-senior-priority="secondary"><h2>Historial de citas</h2>{appointments.length ? <div className="consular-history">{appointments.map((appointment) => <div key={appointment.id}><span>{formatAppointment(appointment.appointment_at)}</span><strong>{appointment.status === "scheduled" ? "Programada" : "Cancelada"}</strong><span>{appointment.confirmation_code}</span></div>)}</div> : <p className="consular-empty">Tu asesor todavía no ha registrado una cita oficial.</p>}</section>
      </div>}
      <p className="consular-disclaimer">Las fechas y confirmaciones mostradas son registradas por el asesor después de completar la gestión en el sistema oficial del consulado. Los acercamientos no garantizan una fecha específica porque dependen de los espacios que libere la embajada.</p>
    </main>
  </div>;
}
