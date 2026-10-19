import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export function AdminPageHeader({ title, description, action }) {
  return <header className={`admin-page-heading${title ? "" : " admin-page-heading--description-only"}`}><div>{title && <h1>{title}</h1>}<p data-senior-priority="secondary">{description}</p></div>{action}</header>;
}

export function AdminResourceState({ isLoading, error, isEmpty, empty, retry }) {
  if (isLoading) return <div className="admin-resource-state" role="status"><span className="route-loading__spinner" aria-hidden="true" />Cargando información…</div>;
  if (error) return <div className="admin-resource-state admin-resource-state--error" role="alert"><strong>No se pudo cargar la información</strong><span>{error}</span><button type="button" onClick={retry}>Reintentar</button></div>;
  if (isEmpty) return <div className="admin-resource-state"><strong>{empty}</strong><span data-senior-priority="secondary">Los registros aparecerán aquí cuando existan datos.</span></div>;
  return null;
}

export function AdminSearch({ value, onChange, placeholder }) {
  return <label className="admin-search"><Search size={21} aria-hidden="true" /><span className="visually-hidden">Buscar</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export function AdminTabs({ value, onChange, items, label = "Filtros" }) {
  const handleKeyDown = (event, index) => {
    let next = null;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].value);
    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className="admin-tabs" role="tablist" aria-label={label}>{items.map((item, index) => <button key={item.value} type="button" role="tab" tabIndex={value === item.value ? 0 : -1} aria-selected={value === item.value} onKeyDown={(event) => handleKeyDown(event, index)} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

export function AdminPagination({ page, pages, onChange, total, visible }) {
  return <footer className="admin-pagination"><span>Mostrando {visible} de {total} resultados</span><div><button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft aria-hidden="true" /></button><span>{page} / {pages}</span><button type="button" aria-label="Página siguiente" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight aria-hidden="true" /></button></div></footer>;
}
