import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Copy, CreditCard, Loader2, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { buildApiUrl } from "../config/api";
import useRequireAuth from "../hooks/useRequireAuth";
import "../styles/consular.css";

function authHeaders(session) { return { Authorization: `Bearer ${session.token}` }; }

const PACKAGE_INCLUDES = [
  "Tarifa de solicitud de visa incluida por cada solicitante",
  "Llenado y confirmación del formulario DS-160",
  "Confirmación de la cita consular",
  "Asesoramiento durante el proceso",
  "Hasta 2 acercamientos de cita, sujetos a espacios liberados por la embajada",
];

export default function ConsularPayment() {
  const { isValidating, session } = useRequireAuth();
  const [summary, setSummary] = useState(null);
  const [reference, setReference] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSummary = async (currentSession, signal) => {
    const response = await fetch(buildApiUrl("/payments/me"), { headers: authHeaders(currentSession), signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo consultar el pago.");
    setSummary(data);
  };

  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    loadSummary(session, controller.signal).catch((loadError) => { if (loadError.name !== "AbortError") setError(loadError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session]);

  const formatAmount = (amount, currency = summary?.packageCurrency || "gtq") => new Intl.NumberFormat("es-GT", {
    style: "currency", currency: currency.toUpperCase(),
  }).format(amount / 100);

  const submitTransfer = async (event) => {
    event.preventDefault();
    if (!file) return setError("Adjunta el comprobante de depósito o transferencia.");
    try {
      setSubmitting(true); setError(""); setMessage("");
      const body = new FormData();
      body.set("reference", reference);
      body.set("file", file);
      const response = await fetch(buildApiUrl("/payments/bank-transfer"), {
        method: "POST", headers: authHeaders(session), body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo registrar la transferencia.");
      setReference(""); setFile(null); setMessage("Comprobante enviado. Tu asesor validará la transferencia.");
      await loadSummary(session);
    } catch (submitError) { setError(submitError.message); } finally { setSubmitting(false); }
  };

  const copyAccount = async () => {
    if (!summary?.bank?.accountNumber) return;
    await navigator.clipboard.writeText(summary.bank.accountNumber);
    setMessage("Número de cuenta copiado.");
  };

  return <div className="vg-layout"><Sidebar currentPage="pagos" />
    <main id="main-content" tabIndex="-1" className="vg-main consular-main">
      <header className="consular-heading"><div className="consular-heading__icon"><CreditCard aria-hidden="true" /></div><div><p className="consular-eyebrow">Paso 3 de tu proceso</p><h1>Pago del trámite</h1><p>Deposita o transfiere el total y registra tu comprobante.</p></div></header>
      {message && <div className="consular-alert consular-alert--success" role="status">{message}</div>}
      {error && <div className="consular-alert consular-alert--error" role="alert">{error}</div>}
      {isValidating || loading ? <div className="consular-loading" role="status"><Loader2 className="consular-spin" aria-hidden="true" /> Consultando pago…</div> : <div className="consular-grid">
        <section className="consular-card consular-card--primary">
          <div className="consular-card__top"><span>{summary?.profileLabel || "Trámite de visa"}</span><span className={`consular-status consular-status--${summary?.customerPaid ? "paid" : "pending"}`}>{summary?.customerPaid ? "Confirmado" : summary?.transferPending ? "Por validar" : "Pendiente"}</span></div>
          <strong className="consular-amount">{formatAmount(summary?.packageAmountMinor || 0)}</strong>
          <p className="consular-muted">
            {summary?.personCount > 1
              ? `${summary.personCount} solicitantes · ${formatAmount(summary.packagePerPersonMinor || 0)} por persona.`
              : "Precio fijo para un solicitante."}
            {` Incluye ${formatAmount(summary?.governmentFeePerPersonUsdCents || 18500, "usd")} de tarifa gubernamental por persona.`}
          </p>
          {summary?.sevisFeeUsdCents && <div className="consular-notice"><strong>Pago SEVIS independiente</strong><span>La tarifa I-901 SEVIS de {formatAmount(summary.sevisFeeUsdCents, "usd")} se paga por separado en el sitio oficial de SEVP y no está incluida en este total.</span></div>}
          <div className="consular-package-list" data-senior-priority="secondary"><h2>El paquete incluye</h2><ol>{PACKAGE_INCLUDES.map((item) => <li key={item}>{item}</li>)}</ol></div>
          <dl className="consular-breakdown"><div><dt>Total a depositar o transferir</dt><dd>{formatAmount(summary?.packageAmountMinor || 0)}</dd></div></dl>
          {summary?.customerPaid ? <div className="consular-complete"><CheckCircle2 aria-hidden="true" /><div><strong>Transferencia confirmada</strong><span>{summary.consularPaid ? "El pago consular oficial ya fue registrado." : summary.latest?.status === "consular_processing" ? "Tu asesor está gestionando el pago consular." : "Tu asesor continuará con el trámite."}</span></div><Link className="consular-button" to="/citas">Ver seguimiento</Link></div> : summary?.transferPending ? <div className="consular-notice"><strong>Validación pendiente</strong><span>Tu asesor revisará el comprobante y confirmará la recepción del dinero.</span></div> : <form className="consular-form" onSubmit={submitTransfer}>
            {summary?.latest?.status === "transfer_rejected" && <div className="consular-alert consular-alert--error"><strong>Comprobante rechazado</strong><span>{summary.latest.transfer_rejection_reason}</span></div>}
            <label>Referencia o número de boleta<input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. 0123456789" /></label>
            <label>Comprobante obligatorio (PDF, JPG o PNG)<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
            <button className="consular-button" disabled={submitting}>{submitting ? <><Loader2 className="consular-spin" aria-hidden="true" /> Enviando…</> : <><ReceiptText aria-hidden="true" /> Registrar transferencia</>}</button>
          </form>}
        </section>
        <aside className="consular-card"><Building2 className="consular-feature-icon" aria-hidden="true" /><h2>Datos bancarios</h2>{summary?.bank?.configured ? <dl className="consular-bank-details"><div><dt>Banco</dt><dd>{summary.bank.bankName}</dd></div><div><dt>Cuenta a nombre de</dt><dd>{summary.bank.accountName}</dd></div><div><dt>Número de cuenta</dt><dd>{summary.bank.accountNumber} <button type="button" onClick={copyAccount} aria-label="Copiar número de cuenta"><Copy aria-hidden="true" /></button></dd></div>{summary.bank.accountType && <div><dt>Tipo de cuenta</dt><dd>{summary.bank.accountType}</dd></div>}</dl> : <div className="consular-notice"><strong>Datos proporcionados por el asesor</strong><span>{summary?.bank?.instructions}</span></div>}<p className="consular-muted">Transfiere exactamente el total mostrado y conserva el comprobante hasta que sea validado.</p></aside>
        <section className="consular-card"><h2>Documentos obligatorios para {summary?.profileLabel || "tu visa"}</h2><ol className="consular-requirements">{summary?.requiredDocuments?.map((item) => <li key={item.id}>{item.title}</li>)}</ol>{summary?.familyDocumentNote && <p className="consular-muted">{summary.familyDocumentNote}</p>}<Link className="consular-button consular-button--secondary" to="/documents">Ir a documentos</Link></section>
        <section className="consular-card consular-card--wide" data-senior-priority="secondary"><h2>Historial</h2>{summary?.payments?.length ? <div className="consular-history">{summary.payments.map((payment) => <div key={payment.id}><span>{new Date(payment.created_at).toLocaleDateString("es-GT")}</span><strong>{payment.status === "transfer_pending" ? "Por validar" : payment.status === "transfer_rejected" ? "Rechazado" : payment.status === "consular_paid" ? "Pagado al consulado" : "Transferencia confirmada"}</strong><span>{payment.transfer_reference || "Registro anterior"}</span></div>)}</div> : <p className="consular-empty">Todavía no has registrado transferencias.</p>}</section>
      </div>}
      <p className="consular-disclaimer">El comprobante enviado queda sujeto a validación. El trámite consular inicia únicamente después de confirmar que los fondos fueron recibidos.</p>
    </main>
  </div>;
}
