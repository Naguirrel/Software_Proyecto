import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, BookOpenText, CheckCircle2, ClipboardCheck, FileText, LayoutDashboard,
  ChevronLeft, ChevronRight, LogOut, Menu, MessageSquareText, Moon, Sun,
  UserCircle, Users, X,
} from "lucide-react";
import VisaGuideLogo from "../VisaGuideLogo";
import useTheme from "../../hooks/useTheme";
import { useAdvisorSession } from "./AdvisorSessionContext";
import { apiRequest } from "../../utils/apiClient";
import { buildSessionHeaders } from "../../utils/sessionAuth";
import { preloadRoute } from "../../routes/lazyRoutes";
import "../../styles/admin.css";
import "../../styles/advisor.css";

const navItems = [
  { label: "Inicio", path: "/advisor", icon: <LayoutDashboard size={20} aria-hidden="true" />, end: true },
  { label: "Mis solicitudes", path: "/advisor/solicitudes", icon: <Users size={20} aria-hidden="true" /> },
  { label: "Documentos", path: "/advisor/documentos", icon: <FileText size={20} aria-hidden="true" /> },
  { label: "Formularios DS-160", path: "/advisor/ds160", icon: <ClipboardCheck size={20} aria-hidden="true" /> },
  { label: "Entrevistas", path: "/advisor/entrevistas", icon: <MessageSquareText size={20} aria-hidden="true" /> },
  { label: "Chat", path: "/advisor/chat", icon: <MessageSquareText size={20} aria-hidden="true" /> },
  { label: "Tareas", path: "/advisor/tareas", icon: <CheckCircle2 size={20} aria-hidden="true" /> },
  { label: "Banco de preguntas", path: "/advisor/preguntas", icon: <BookOpenText size={20} aria-hidden="true" /> },
];

const ADVISOR_SIDEBAR_COLLAPSED_KEY = "vg-advisor-sidebar-collapsed";

function getInitialSidebarCollapsed() {
  try {
    const storedValue = localStorage.getItem(ADVISOR_SIDEBAR_COLLAPSED_KEY);
    return storedValue === null ? true : storedValue === "true";
  } catch {
    return true;
  }
}

export default function AdvisorLayout({ children }) {
  const session = useAdvisorSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState("");
  const notificationRef = useRef(null);
  const currentTitle = navItems.find((item) => item.end ? location.pathname === item.path : location.pathname.startsWith(item.path))?.label || "Panel de asesor";
  const initials = String(session.nombre || "Asesor").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const close = (event) => {
      if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [notificationsOpen]);

  const loadNotifications = async () => {
    try {
      setNotificationError("");
      const data = await apiRequest("/notificaciones/listar", {
        method: "POST",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ userId: session.id_usuario || session.id }),
      });
      setNotifications(data.notificaciones || []);
    } catch (error) {
      setNotificationError(error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("visaguide_session");
    localStorage.removeItem("correoUsuario");
    localStorage.removeItem("perfilUsuario");
    navigate("/login", { replace: true });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const nextValue = !collapsed;
      try {
        localStorage.setItem(ADVISOR_SIDEBAR_COLLAPSED_KEY, String(nextValue));
      } catch {
        // The sidebar still works when browser storage is unavailable.
      }
      return nextValue;
    });
  };

  return (
    <div className={`admin-shell advisor-shell${sidebarCollapsed ? " admin-shell--sidebar-collapsed" : ""}`}>
      <aside id="advisor-navigation" className={`admin-sidebar advisor-sidebar${sidebarOpen ? " admin-sidebar--open" : ""}${sidebarCollapsed ? " admin-sidebar--collapsed" : ""}`} aria-label="Navegación del panel de asesor">
        <div className="admin-sidebar__top">
          <VisaGuideLogo variant="full" className="admin-sidebar__brand" subtitle="Asesor" />
          <button
            type="button"
            className="admin-sidebar__collapse"
            aria-label={sidebarCollapsed ? "Expandir menú de asesor" : "Colapsar menú de asesor"}
            aria-controls="advisor-navigation"
            aria-expanded={!sidebarCollapsed}
            data-tooltip={sidebarCollapsed ? "Expandir" : "Colapsar"}
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? <ChevronRight size={20} aria-hidden="true" /> : <ChevronLeft size={20} aria-hidden="true" />}
          </button>
        </div>
        <nav className="admin-sidebar__nav" aria-label="Módulos del asesor">
          {navItems.map(({ label, path, icon, end }) => (
            <NavLink key={path} to={path} end={end} className={({ isActive }) => `admin-sidebar__link${isActive ? " admin-sidebar__link--active" : ""}`} data-tooltip={label} onClick={() => setSidebarOpen(false)} onMouseEnter={() => preloadRoute(path)} onFocus={() => preloadRoute(path)}>
              {icon}<span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <button type="button" className="admin-sidebar__theme" onClick={toggleTheme} aria-pressed={isDark} data-tooltip={isDark ? "Modo claro" : "Modo oscuro"}>
            {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}<span>{isDark ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <NavLink className="admin-sidebar__profile" to="/advisor/perfil" aria-current={location.pathname === "/advisor/perfil" ? "page" : undefined} data-tooltip="Mi perfil" onMouseEnter={() => preloadRoute("/advisor/perfil")} onFocus={() => preloadRoute("/advisor/perfil")}><UserCircle size={20} aria-hidden="true" /><span>Mi perfil</span></NavLink>
          <button type="button" className="admin-sidebar__logout" data-tooltip="Cerrar sesión" onClick={logout}><LogOut size={20} aria-hidden="true" /><span>Cerrar sesión</span></button>
        </div>
      </aside>
      {sidebarOpen && <button type="button" className="admin-sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}
      <div className="admin-workspace advisor-workspace">
        <header className="admin-header advisor-header">
          <button type="button" className="admin-header__menu" aria-label="Abrir menú" onClick={() => setSidebarOpen((open) => !open)}>{sidebarOpen ? <X /> : <Menu />}</button>
          <strong className="advisor-header__title">{currentTitle}</strong>
          <div className="admin-header__actions">
            <div className="admin-header__notifications" ref={notificationRef}>
              <button type="button" className="admin-header__notification" aria-label="Notificaciones" aria-expanded={notificationsOpen} onClick={() => { const open = !notificationsOpen; setNotificationsOpen(open); if (open) loadNotifications(); }}>
                <Bell size={22} aria-hidden="true" />{notifications.some((item) => !item.leido) && <span aria-hidden="true" />}
              </button>
              {notificationsOpen && <section className="admin-notification-menu" aria-label="Notificaciones"><header><strong>Notificaciones</strong><button type="button" onClick={() => setNotificationsOpen(false)}>×</button></header>{notificationError ? <p role="alert">{notificationError}</p> : notifications.length ? <ul>{notifications.slice(0, 8).map((item) => <li key={item.id}><strong>{item.titulo}</strong><span>{item.mensaje}</span></li>)}</ul> : <p>Sin notificaciones.</p>}</section>}
            </div>
            <NavLink className="admin-header__user" to="/advisor/perfil"><div><strong>{session.nombre || "Asesor"}</strong><small>Asesor</small></div><span>{initials}</span></NavLink>
          </div>
        </header>
        <main id="main-content" tabIndex="-1" className="admin-main advisor-main">{children}</main>
      </div>
    </div>
  );
}
