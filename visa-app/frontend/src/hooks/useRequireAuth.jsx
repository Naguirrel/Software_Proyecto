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
        setIdiomaPreferido();
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

  // Si la sesión expira (401 en cualquier petición) o cambia en otra pestaña, se descarta la
  // sesión en memoria y se vuelve al login para no dejar a la vista datos de la cuenta anterior.
  useEffect(() => {
    const leaveSession = () => {
      setSession(null);
      setIsValidating(true);
      window.location.href = "/login";
    };
    const onStorage = (event) => {
      if (event.key !== null && event.key !== "visaguide_session") return;
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem("visaguide_session") || "null");
      } catch {
        stored = null;
      }
      if (!stored?.token || (session && stored.id !== session.id)) leaveSession();
    };
    window.addEventListener("visaguide:session-expired", leaveSession);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("visaguide:session-expired", leaveSession);
      window.removeEventListener("storage", onStorage);
    };
  }, [session]);

  return { isValidating, session };
}
