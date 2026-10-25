import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpenText, CheckCircle2, ClipboardCheck, FileText, LayoutDashboard,
  LogOut, Menu, MessageSquareText, Moon, Sun,
  Users, X, MessagesSquare,
} from "lucide-react";
import VisaGuideLogo from "../VisaGuideLogo";
import useTheme from "../../hooks/useTheme";
import { useAdvisorSession } from "./AdvisorSessionContext";
import { preloadRoute } from "../../routes/lazyRoutes";
import AdvisorGlobalSearch from "./AdvisorGlobalSearch";
import AdvisorNotificationCenter from "./AdvisorNotificationCenter";
import AdvisorNotificationToasts from "./AdvisorNotificationToasts";
import { AdvisorNotificationsProvider } from "./AdvisorNotificationsContext";
import { useAdvisorNotifications } from "./advisorNotificationsStore";
import ProfileAvatar from "../ProfileAvatar";
import "../../styles/admin.css";
import "../../styles/advisor.css";

const navItems = [
  { label: "Inicio", path: "/advisor", icon: <LayoutDashboard size={20} aria-hidden="true" />, end: true },
  { label: "Mis solicitudes", path: "/advisor/solicitudes", notificationType: "assignment", icon: <Users size={20} aria-hidden="true" /> },
  { label: "Documentos", path: "/advisor/documentos", notificationType: "documento", icon: <FileText size={20} aria-hidden="true" /> },
  { label: "Formularios DS-160", path: "/advisor/ds160", notificationType: "ds160", icon: <ClipboardCheck size={20} aria-hidden="true" /> },
  { label: "Entrevistas", path: "/advisor/entrevistas", notificationType: "entrevista", icon: <MessageSquareText size={20} aria-hidden="true" /> },
  { label: "Chat", path: "/advisor/chat", notificationType: "chat", icon: <MessagesSquare size={20} aria-hidden="true" /> },
  { label: "Tareas", path: "/advisor/tareas", notificationType: "task", icon: <CheckCircle2 size={20} aria-hidden="true" /> },
  { label: "Banco de preguntas", path: "/advisor/preguntas", icon: <BookOpenText size={20} aria-hidden="true" /> },
];

function AdvisorLayoutContent({ children }) {
  const session = useAdvisorSession();
  const { countsByType } = useAdvisorNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem("visaguide_session");
    localStorage.removeItem("correoUsuario");
    localStorage.removeItem("perfilUsuario");
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-shell advisor-shell admin-shell--sidebar-collapsed">
      <aside id="advisor-navigation" className={`admin-sidebar advisor-sidebar admin-sidebar--collapsed${sidebarOpen ? " admin-sidebar--open" : ""}`} aria-label="Navegación del panel de asesor">
        <div className="admin-sidebar__top">
          <VisaGuideLogo variant="full" className="admin-sidebar__brand" subtitle="Asesor" />
        </div>
        <nav className="admin-sidebar__nav" aria-label="Módulos del asesor">
          {navItems.map(({ label, path, icon, end, notificationType }) => (
            <NavLink key={path} to={path} end={end} className={({ isActive }) => `admin-sidebar__link${isActive ? " admin-sidebar__link--active" : ""}`} data-tooltip={label} onClick={() => setSidebarOpen(false)} onMouseEnter={() => preloadRoute(path)} onFocus={() => preloadRoute(path)}>
              {icon}<span>{label}</span>{notificationType && countsByType[notificationType] > 0 && <b className="advisor-nav-count" aria-label={`${countsByType[notificationType]} pendientes`}>{countsByType[notificationType] > 99 ? "99+" : countsByType[notificationType]}</b>}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <button type="button" className="admin-sidebar__theme" onClick={toggleTheme} aria-pressed={isDark} data-tooltip={isDark ? "Modo claro" : "Modo oscuro"}>
            {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}<span>{isDark ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <NavLink className={({ isActive }) => `admin-sidebar__profile${isActive ? " admin-sidebar__profile--active" : ""}`} to="/advisor/perfil" aria-current={location.pathname === "/advisor/perfil" ? "page" : undefined} data-tooltip="Mi perfil" onMouseEnter={() => preloadRoute("/advisor/perfil")} onFocus={() => preloadRoute("/advisor/perfil")}><ProfileAvatar userId={session.id || session.id_usuario} name={session.nombre} version={session.avatarVersion} size={24} /><span>Mi perfil</span></NavLink>
          <button type="button" className="admin-sidebar__logout" data-tooltip="Cerrar sesión" onClick={logout}><LogOut size={20} aria-hidden="true" /><span>Cerrar sesión</span></button>
        </div>
      </aside>
      {sidebarOpen && <button type="button" className="admin-sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}
      <div className="admin-workspace advisor-workspace">
        <header className="admin-header advisor-header">
          <button type="button" className="admin-header__menu" aria-label="Abrir menú" onClick={() => setSidebarOpen((open) => !open)}>{sidebarOpen ? <X /> : <Menu />}</button>
          <AdvisorGlobalSearch />
          <div className="admin-header__actions">
            <AdvisorNotificationCenter />
            <NavLink className="admin-header__user" to="/advisor/perfil"><div><strong>{session.nombre || "Asesor"}</strong><small>Asesor</small></div><ProfileAvatar userId={session.id || session.id_usuario} name={session.nombre} version={session.avatarVersion} size={38} /></NavLink>
          </div>
        </header>
        <main id="main-content" tabIndex="-1" className="admin-main advisor-main">{children || <Outlet />}</main>
      </div>
      <AdvisorNotificationToasts />
    </div>
  );
}

export default function AdvisorLayout({ children }) {
  return <AdvisorNotificationsProvider><AdvisorLayoutContent>{children}</AdvisorLayoutContent></AdvisorNotificationsProvider>;
}
