import NotificationCenter from "./NotificationCenter";
import { Link } from "react-router-dom";
import { preloadRoute } from "../routes/lazyRoutes";
import useIdioma from "../hooks/useIdioma";
import { InformationIcon } from "./icons/VisaGuideIcons";

export default function TopActions({ userId, unreadCount = 0 }) {
  const { t } = useIdioma();
  const handleInformationClick = (event) => {
    if (window.location.pathname !== "/dashboard") return;
    event.preventDefault();
    window.history.pushState(null, "", "/dashboard#informacion");
    document.getElementById("informacion")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="vg-top-actions" role="group" aria-label={t("topActions.label")}>
      <Link
        className="vg-top-action-button vg-top-action-button--information"
        to="/dashboard#informacion"
        aria-label={t("topActions.info")}
        onClick={handleInformationClick}
        onMouseEnter={() => preloadRoute("/dashboard")}
        onFocus={() => preloadRoute("/dashboard")}
      >
        <InformationIcon size={22} strokeWidth={2} />
      </Link>
      <NotificationCenter userId={userId} unreadCount={unreadCount} />
    </div>
  );
}
