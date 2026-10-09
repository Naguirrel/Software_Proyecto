import { useState, useEffect } from "react";
import { apiRequest } from "../utils/apiClient";
import { setIdiomaPreferido } from "../i18n/translations";

export default function useRequireAuth() {
  const [isValidating, setIsValidating] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const checkSession = async () => {
      const sessionRaw = localStorage.getItem("visaguide_session");

      if (!sessionRaw) {
        window.location.href = "/login";
        return;
      }

      try {
        const sessionData = JSON.parse(sessionRaw);
        if (!sessionData.token) {
          throw new Error("Sesión sin token");
        }

        const data = await apiRequest("/validar-sesion", {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${sessionData.token}` },
          fallbackMessage: "No fue posible validar la sesión.",
        });

        if (!data?.valid) {
          localStorage.removeItem("visaguide_session");
          localStorage.removeItem("correoUsuario");
          localStorage.removeItem("perfilUsuario");
          window.location.href = "/login";
          return;
        }

        const currentSession = data.user ? { ...sessionData, ...data.user } : sessionData;
        localStorage.setItem("visaguide_session", JSON.stringify(currentSession));
        if (data.user?.idioma) setIdiomaPreferido(data.user.idioma);
        setSession(currentSession);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Error validando sesión:", err);
        localStorage.removeItem("visaguide_session");
        localStorage.removeItem("correoUsuario");
        localStorage.removeItem("perfilUsuario");
        window.location.href = "/login";
        return;
      }

      setIsValidating(false);
    };

    checkSession();
    return () => controller.abort();
  }, []);

  return { isValidating, session };
}
