import { useEffect } from "react";
import { getIdiomaGuardado, translate } from "../i18n/translations";

export default function useIdioma() {
  const idioma = "es";

  useEffect(() => {
    getIdiomaGuardado();
    document.documentElement.lang = idioma;
  }, [idioma]);

  const t = (key, vars) => translate(idioma, key, vars);

  return { idioma, t };
}
