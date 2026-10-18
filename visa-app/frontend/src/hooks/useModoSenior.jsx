import { useState, useEffect } from "react";
import {
  isModoSeniorEnabled,
  MODO_SENIOR_EVENT_NAME,
} from "../utils/modoSenior";

export default function useModoSenior() {
  const [modoSenior, setModoSenior] = useState(isModoSeniorEnabled);

  useEffect(() => {
    // Escuchar cambios del toggle en el Sidebar
    const handleChange = (e) => {
      setModoSenior(e.detail);
    };

    window.addEventListener(MODO_SENIOR_EVENT_NAME, handleChange);

    // También escuchar cambios en localStorage (por si se cambia en otra pestaña)
    const handleStorage = () => {
      setModoSenior(isModoSeniorEnabled());
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(MODO_SENIOR_EVENT_NAME, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return modoSenior;
}
