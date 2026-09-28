import { Navigate } from "react-router-dom";
import useRequireAuth from "../../hooks/useRequireAuth";
import { AdvisorSessionProvider } from "./AdvisorSessionContext";

export default function RequireAdvisor({ children }) {
  const { isValidating, session } = useRequireAuth();
  if (isValidating) {
    return <main id="main-content" tabIndex="-1" className="route-loading"><span className="route-loading__spinner" aria-hidden="true" /><span className="visually-hidden" role="status">Validando acceso…</span></main>;
  }
  if (session?.rol !== "asesor") return <Navigate to={session?.rol === "admin" ? "/admin" : "/dashboard"} replace />;
  return <AdvisorSessionProvider value={session}>{children}</AdvisorSessionProvider>;
}
