import NotificationCenter from "./NotificationCenter";
import { Link } from "react-router-dom";
import { preloadRoute } from "../routes/lazyRoutes";

export default function TopActions({ userId, unreadCount = 0 }) {
  const handleInformationClick = (event) => {
    if (window.location.pathname !== "/dashboard") return;
    event.preventDefault();
    window.history.pushState(null, "", "/dashboard#informacion");
    document.getElementById("informacion")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="vg-top-actions" role="group" aria-label="Acciones rápidas">
      <Link
        className="vg-top-action-button"
        to="/dashboard#informacion"
        aria-label="Ir a información del proceso"
        onClick={handleInformationClick}
        onMouseEnter={() => preloadRoute("/dashboard")}
        onFocus={() => preloadRoute("/dashboard")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 11v6" />
          <path d="M12 7h.01" />
        </svg>
      </Link>
      <NotificationCenter userId={userId} unreadCount={unreadCount} />
    </div>
  );
}
