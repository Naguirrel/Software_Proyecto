import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import Sidebar from "./Sidebar";
import useRequireAuth from "../hooks/useRequireAuth";
import useClientWorkflow from "../hooks/useClientWorkflow";

const PAGE_BY_STEP = {
  ds160: "ds160",
  payment: "pagos",
  appointment: "citas",
  interview: "entrevista",
  chat: "chat",
};

export default function RequireWorkflowStep({ step, children }) {
  const { isValidating, session } = useRequireAuth();
  const isClient = session?.rol === "cliente";
  const { workflow, isLoading, error, retry } = useClientWorkflow({
    enabled: !isValidating && isClient,
  });

  if (isValidating || (isClient && isLoading)) {
    return <main className="route-loading"><span className="route-loading__spinner" /><span>Validando etapa…</span></main>;
  }
  if (!isClient) return children;
  if (error || !workflow) {
    return (
      <div className="vg-layout">
        <Sidebar currentPage={PAGE_BY_STEP[step]} />
        <main className="vg-main workflow-blocked" role="alert">
          <h1>No pudimos validar tu etapa</h1>
          <p>{error || "Intenta nuevamente."}</p>
          <button type="button" onClick={retry}>Reintentar</button>
        </main>
      </div>
    );
  }

  const gate = workflow.gates?.[step];
  if (gate?.allowed) return children;

  return (
    <div className="vg-layout">
      <Sidebar currentPage={PAGE_BY_STEP[step]} />
      <main id="main-content" tabIndex="-1" className="vg-main workflow-blocked">
        <div className="workflow-blocked__card">
          <LockKeyhole aria-hidden="true" />
          <span>ETAPA BLOQUEADA</span>
          <h1>Completa primero el paso anterior</h1>
          <p>{gate?.reason || "Esta función todavía no está disponible para tu trámite."}</p>
          <Link to={gate?.requiredPath || "/dashboard"}>Ir al paso requerido</Link>
          <Link className="workflow-blocked__secondary" to="/dashboard">Volver al inicio</Link>
        </div>
      </main>
    </div>
  );
}
