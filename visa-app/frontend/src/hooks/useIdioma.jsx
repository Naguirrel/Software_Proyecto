import { useCallback, useEffect, useState } from "react";
import {
  getIdiomaGuardado,
  IDIOMA_CHANGE_EVENT,
  IDIOMA_STORAGE_KEY,
  translate,
} from "../i18n/translations";

export default function useIdioma() {
  const [idioma, setIdioma] = useState(getIdiomaGuardado);

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  useEffect(() => {
    // Cambios hechos desde Perfil o al validar la sesión
    const handleChange = (e) => setIdioma(e.detail);
    // Cambios hechos en otra pestaña
    const handleStorage = (e) => {
      if (e.key && e.key !== IDIOMA_STORAGE_KEY) return;
      setIdioma(getIdiomaGuardado());
    };

    window.addEventListener(IDIOMA_CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(IDIOMA_CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const t = useCallback((key, vars) => translate(idioma, key, vars), [idioma]);

  return { idioma, t };
}
