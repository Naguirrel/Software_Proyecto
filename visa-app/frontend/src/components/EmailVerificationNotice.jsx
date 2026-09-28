import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { buildApiUrl } from "../config/api";

export default function EmailVerificationNotice({ correo, variant = "sidebar" }) {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState("idle");

  if (!correo || dismissed) return null;

  const handleResend = async () => {
    setStatus("sending");
    try {
      const response = await fetch(buildApiUrl("/reenviar-verificacion"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo }),
      });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className={`vg-email-verify-notice vg-email-verify-notice--${variant}`} role="status">
      <div className="vg-email-verify-notice__row">
        <AlertTriangle size={16} aria-hidden="true" />
        <span className="vg-email-verify-notice__text">Verifica tu correo electrónico</span>
        <button
          type="button"
          className="vg-email-verify-notice__close"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso de verificación"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="vg-email-verify-notice__resend"
        onClick={handleResend}
        disabled={status === "sending" || status === "sent"}
      >
        {status === "sent" ? "Enlace enviado" : status === "sending" ? "Enviando..." : status === "error" ? "Reintentar" : "Reenviar enlace"}
      </button>
      {status === "error" && (
        <span className="vg-email-verify-notice__error">No se pudo enviar el enlace. Intenta de nuevo.</span>
      )}
    </div>
  );
}
