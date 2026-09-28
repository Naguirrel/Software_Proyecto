import { Search, X } from "lucide-react";

export function AdvisorPageHeader({ title, description, action }) {
  return <header className="advisor-page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function AdvisorTabs({ items, value, onChange, label }) {
  return <div className="advisor-tabs" role="tablist" aria-label={label}>{items.map((item) => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} className={value === item.value ? "is-active" : ""} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

export function AdvisorSearch({ value, onChange, placeholder }) {
  return <label className="advisor-search"><Search size={20} aria-hidden="true" /><span className="visually-hidden">Buscar</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export function AdvisorState({ loading, error, empty, onRetry }) {
  if (loading) return <p className="advisor-state" role="status">Cargando…</p>;
  if (error) return <div className="advisor-state advisor-state--error" role="alert"><p>{error}</p>{onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}</div>;
  if (empty) return <p className="advisor-state">No hay resultados.</p>;
  return null;
}

export function AdvisorModal({ title, subtitle, onClose, children, footer }) {
  return <div className="advisor-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="advisor-modal" role="dialog" aria-modal="true" aria-labelledby="advisor-modal-title"><header><div><h2 id="advisor-modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" onClick={onClose} aria-label="Cerrar"><X aria-hidden="true" /></button></header><div className="advisor-modal__body">{children}</div>{footer && <footer>{footer}</footer>}</section></div>;
}
