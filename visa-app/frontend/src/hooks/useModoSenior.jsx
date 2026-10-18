import { useState, useEffect } from "react";
import {
  isModoSeniorEnabled,
  MODO_SENIOR_EVENT_NAME,
  reflectModoSenior,
} from "../utils/modoSenior";

export default function useModoSenior() {
  const [modoSenior, setModoSenior] = useState(isModoSeniorEnabled);

  useEffect(() => {
    const enabled = isModoSeniorEnabled();
    reflectModoSenior(enabled);

    const handleChange = (e) => {
      setModoSenior(e.detail);
    };

    window.addEventListener(MODO_SENIOR_EVENT_NAME, handleChange);

    // También escuchar cambios en localStorage (por si se cambia en otra pestaña)
    const handleStorage = (event) => {
      if (event.key && !["modoSenior", "visaguide_session"].includes(event.key)) return;
      const nextEnabled = isModoSeniorEnabled();
      reflectModoSenior(nextEnabled);
      setModoSenior(nextEnabled);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(MODO_SENIOR_EVENT_NAME, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return modoSenior;
}
