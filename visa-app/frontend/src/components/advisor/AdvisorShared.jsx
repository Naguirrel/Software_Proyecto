import { Search, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

export function AdvisorPageHeader({ title, description, action }) {
  return <header className="advisor-page-header"><div><h1>{title}</h1><p data-senior-priority="secondary">{description}</p></div>{action}</header>;
}

export function AdvisorTabs({ items, value, onChange, label }) {
  return <div className="advisor-tabs" role="tablist" aria-label={label}>{items.map((item) => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} className={value === item.value ? "is-active" : ""} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

export function AdvisorSearch({ value, onChange, placeholder }) {
  return <label className="advisor-search"><Search size={20} aria-hidden="true" /><span className="visually-hidden">Buscar</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export function AdvisorState({ loading, error, empty, onRetry }) {
  if (loading) return <div className="advisor-state advisor-skeleton-state" role="status" aria-label="Cargando contenido"><span /><span /><span /></div>;
  if (error) return <div className="advisor-state advisor-state--error" role="alert"><p>{error}</p>{onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}</div>;
  if (empty) return <p className="advisor-state">No hay resultados.</p>;
  return null;
}

export function AdvisorAlert({ message, tone = "error", onDismiss, duration = 0 }) {
  useEffect(() => {
    if (!message || !duration || !onDismiss) return undefined;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, onDismiss]);

  if (!message) return null;
  return <div className={`advisor-alert advisor-alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
    <span>{message}</span>
    {onDismiss && <button type="button" aria-label="Cerrar aviso" onClick={onDismiss}><X size={18} aria-hidden="true" /></button>}
  </div>;
}

export function AdvisorPagination({ page, pages, total, visible, onChange }) {
  return <footer className="advisor-pagination"><span>Mostrando {visible} de {total} resultados</span><div>
    <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
    <span>Página {page} de {pages}</span>
    <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</button>
  </div></footer>;
}

export function AdvisorModal({ title, subtitle, onClose, children, footer }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]");
    focusable?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const elements = [...dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]")];
      if (!elements.length) return;
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, []);

  return <div className="advisor-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="advisor-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle ? descriptionId : undefined}><header><div><h2 id={titleId}>{title}</h2>{subtitle && <p id={descriptionId}>{subtitle}</p>}</div><button type="button" onClick={onClose} aria-label="Cerrar"><X aria-hidden="true" /></button></header><div className="advisor-modal__body">{children}</div>{footer && <footer>{footer}</footer>}</section></div>;
}
