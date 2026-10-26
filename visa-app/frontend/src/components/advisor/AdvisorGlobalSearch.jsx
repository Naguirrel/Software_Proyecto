import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { advisorRequest } from "../../utils/advisorApi";

export default function AdvisorGlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [query, setQuery] = useState("");
  const [processes, setProcesses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const load = async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await advisorRequest("/processes");
      setProcesses(data.processes || []);
      setLoaded(true);
    } catch (requestError) {
      setError(requestError.message || "No fue posible buscar solicitantes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const close = (event) => { if (!containerRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return [];
    return processes.filter((process) => `${process.solicitante.nombre} ${process.solicitante.correo} ${process.solicitante.perfil}`.toLowerCase().includes(normalized)).slice(0, 6);
  }, [processes, query]);

  const select = (process) => {
    setOpen(false); setQuery(""); setActiveIndex(-1);
    navigate(`/advisor/solicitudes/${process.id}`);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || !results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  };

  return <div ref={containerRef} className="advisor-global-search">
    <label><Search aria-hidden="true" /><span className="visually-hidden">Buscar solicitante</span><input role="combobox" aria-autocomplete="list" aria-expanded={open && query.trim().length >= 2} aria-controls="advisor-global-search-results" aria-activedescendant={activeIndex >= 0 ? `advisor-search-result-${results[activeIndex]?.id}` : undefined} value={query} placeholder="Buscar solicitante…" onFocus={() => { setOpen(true); load(); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(-1); }} onKeyDown={handleKeyDown} />{query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setQuery(""); setActiveIndex(-1); }}><X aria-hidden="true" /></button>}</label>
    {open && query.trim().length >= 2 && <div id="advisor-global-search-results" className="advisor-global-search__results" role="listbox" aria-label="Solicitantes encontrados">{loading ? <p>Cargando solicitantes…</p> : error ? <p role="status">{error}</p> : results.length ? results.map((process, index) => <button id={`advisor-search-result-${process.id}`} key={process.id} type="button" role="option" aria-selected={activeIndex === index} onPointerMove={() => setActiveIndex(index)} onClick={() => select(process)}><strong>{process.solicitante.nombre}</strong><span>{process.solicitante.correo}</span><small>{process.solicitante.perfil} · {process.etapaActual}</small></button>) : <p>No se encontraron solicitantes.</p>}</div>}
  </div>;
}
