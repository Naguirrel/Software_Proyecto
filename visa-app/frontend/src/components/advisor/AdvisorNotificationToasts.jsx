import { FileText, MessageSquareText, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdvisorNotifications } from "./advisorNotificationsStore";

export default function AdvisorNotificationToasts() {
  const { toasts, dismissToast, markRead } = useAdvisorNotifications();
  const navigate = useNavigate();
  const openToast = async (toast) => {
    try {
      await markRead(toast.id);
      dismissToast(toast.id);
      if (toast.action_url) navigate(toast.action_url);
    } catch {
      // El aviso permanece visible para que el asesor pueda intentarlo de nuevo.
    }
  };
  return <div className="advisor-toast-region" aria-live="polite" aria-label="Avisos nuevos">
    {toasts.map((toast) => <article key={toast.id} className="advisor-toast">
      <span className="advisor-toast__icon">{toast.tipo === "chat" ? <MessageSquareText aria-hidden="true" /> : <FileText aria-hidden="true" />}</span>
      <button type="button" className="advisor-toast__content" onClick={() => openToast(toast)}><strong>{toast.titulo}</strong><span>{toast.mensaje}</span></button>
      <button type="button" className="advisor-toast__close" aria-label={`Cerrar: ${toast.titulo}`} onClick={() => dismissToast(toast.id)}><X aria-hidden="true" /></button>
    </article>)}
  </div>;
}
