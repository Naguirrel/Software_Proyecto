import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Accessibility,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CalendarDays,
  CreditCard,
  FileText,
  Folder,
  LayoutGrid,
  MessageSquare,
  Moon,
  Sun,
  Users,
} from "lucide-react";
import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "../utils/sessionAuth";
import useTheme from "../hooks/useTheme";
import TopActions from "./TopActions";
import VisaGuideLogo from "./VisaGuideLogo";
import EmailVerificationNotice from "./EmailVerificationNotice";
import { preloadRoute } from "../routes/lazyRoutes";

const menuItems = [
  { id: "inicio", label: "Inicio", icon: <LayoutGrid size={20} strokeWidth={2} aria-hidden="true" />, path: "/dashboard" },
  { id: "ds160", label: "DS-160", icon: <FileText size={20} strokeWidth={2} aria-hidden="true" />, path: "/ds160" },
  { id: "cronologia", label: "Cronología", icon: <Clock3 size={20} strokeWidth={2} aria-hidden="true" />, path: "/cronologia" },
  { id: "documentos", label: "Documentos", icon: <Folder size={20} strokeWidth={2} aria-hidden="true" />, path: "/documents" },
  { id: "pagos", label: "Pago consular", icon: <CreditCard size={20} strokeWidth={2} aria-hidden="true" />, path: "/pagos" },
  { id: "citas", label: "Cita consular", icon: <CalendarDays size={20} strokeWidth={2} aria-hidden="true" />, path: "/citas" },
  { id: "entrevista", label: "Entrevista", icon: <Users size={20} strokeWidth={2} aria-hidden="true" />, path: "/entrevista" },
  { id: "chat", label: "Chat con asesor", icon: <MessageSquare size={20} strokeWidth={2} aria-hidden="true" />, path: "/chat" },
];

const staffMenuItem = { id: "gestion-consular", label: "Gestión consular", icon: <CreditCard size={20} strokeWidth={2} aria-hidden="true" />, path: "/gestion-consular" };

export default function Sidebar({ currentPage }) {
  const [modoSenior, setModoSenior] = useState(
    () => localStorage.getItem("modoSenior") === "true"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [autoExpandDisabled, setAutoExpandDisabled] = useState(false);
  const sidebarRef = useRef(null);
  const { isDark, toggleTheme } = useTheme();

  const [usuario] = useState(() => {
    const session = localStorage.getItem("visaguide_session");
    if (session) {
      try { return JSON.parse(session); } catch { return null; }
    }
    return null;
  });
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    document.body.classList.add("vg-has-top-actions");
    return () => document.body.classList.remove("vg-has-top-actions");
  }, []);

  useEffect(() => {
    if (!usuario?.id) return;

    const fetchNoLeidas = async () => {
      try {
        const res = await fetch(buildApiUrl("/notificaciones/no-leidas"), {
          method: "POST",
          headers: buildSessionHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId: usuario.id }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setNoLeidas(data.total || 0);
      } catch {
        // silencioso: el badge simplemente no aparece si falla
      }
    };

    fetchNoLeidas();

    const handleActualizar = () => fetchNoLeidas();
    window.addEventListener("notificacionesLeidas", handleActualizar);
    return () => window.removeEventListener("notificacionesLeidas", handleActualizar);
  }, [usuario?.id]);

  // Close sidebar on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setDesktopExpanded(false);
      setAutoExpandDisabled(true);
      setMobileOpen(false);
      if (sidebarRef.current?.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const toggleModoSenior = () => {
    const next = !modoSenior;
    setModoSenior(next);
    localStorage.setItem("modoSenior", next.toString());
    window.dispatchEvent(new CustomEvent("modoSeniorChange", { detail: next }));
  };

  const getInitials = (nombre) => {
    if (!nombre) return "US";
    const parts = nombre.split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : nombre.substring(0, 2).toUpperCase();
  };

  const getPerfilLabel = (perfil) => {
    const map = {
      turismo_negocios: "Solicitante B1/B2",
      estudiante: "Estudiante F/M",
      renovacion: "Renovación",
      grupo_familiar: "Grupo Familiar",
      adulto_mayor: "Adulto Mayor",
    };
    return map[perfil] || "Solicitante";
  };

  const collapseSidebar = () => {
    setDesktopExpanded(false);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ─── Mobile hamburger button ─── */}
      <TopActions userId={usuario?.id} unreadCount={noLeidas} />

      <button
        className="vg-hamburger"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={mobileOpen}
        aria-controls="vg-primary-sidebar"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="vg-hamburger-bar"
            style={
              mobileOpen
                ? i === 0
                  ? { transform: "translateY(7px) rotate(45deg)" }
                  : i === 1
                  ? { opacity: 0 }
                  : { transform: "translateY(-7px) rotate(-45deg)" }
                : undefined
            }
          />
        ))}
      </button>

      {/* ─── Mobile backdrop ─── */}
      {mobileOpen && (
        <div
          className="vg-sidebar-backdrop"
          style={{ display: "block" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        id="vg-primary-sidebar"
        ref={sidebarRef}
        className={`vg-sidebar${desktopExpanded ? " vg-sidebar--expanded" : ""}${mobileOpen ? " vg-sidebar--mobile-open" : ""}${autoExpandDisabled ? " vg-sidebar--auto-disabled" : ""}`}
        style={s.sidebar}
        aria-label="Navegación principal"
        onMouseLeave={() => setAutoExpandDisabled(false)}
        onFocusCapture={() => setAutoExpandDisabled(false)}
      >
        {/* Logo */}
        <VisaGuideLogo
          variant="compact"
          className="vg-sidebar-logo"
          textClassName="vg-sidebar-label"
        />

        <button
          type="button"
          className="vg-sidebar-expand-button"
          aria-expanded={desktopExpanded}
          aria-controls="vg-sidebar-content"
          aria-label={desktopExpanded ? "Contraer barra lateral" : "Expandir barra lateral"}
          onClick={() => setDesktopExpanded((expanded) => !expanded)}
        >
          {desktopExpanded
            ? <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            : <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />}
        </button>

        {/* Nav */}
        <div id="vg-sidebar-content" className="vg-sidebar-content">
        <nav style={s.nav}>
          <p className="vg-sidebar-label" style={s.menuLabel}>MENÚ PRINCIPAL</p>
          <ul style={s.menuList}>
            {(usuario?.rol === "asesor" ? [menuItems[0], staffMenuItem, ...menuItems.slice(1)] : menuItems).map((item) => {
              const isActive = currentPage === item.id;
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    style={{ ...s.menuItem, ...(isActive ? s.menuItemActive : {}) }}
                    onClick={collapseSidebar}
                    onMouseEnter={() => preloadRoute(item.path)}
                    onFocus={() => preloadRoute(item.path)}
                  >
                    <span style={s.menuIcon}>{item.icon}</span>
                    <span className="vg-sidebar-label" style={{ ...s.menuText, fontSize: modoSenior ? "17px" : "14px" }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="vg-sidebar-label" style={s.badge}>{item.badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="vg-sidebar-bottom-section" style={s.bottomSection}>
          {/* Dark mode toggle */}
          <div className="vg-sidebar-theme-row" style={s.themeRow}>
            <div style={s.themeLeft}>
              <span style={s.themeIcon}>
                {isDark
                  ? <Moon size={16} strokeWidth={2} aria-hidden="true" />
                  : <Sun size={16} strokeWidth={2} aria-hidden="true" />}
              </span>
              <span className="vg-sidebar-label" style={{ ...s.themeText, fontSize: modoSenior ? "17px" : "14px" }}>
                {isDark ? "Modo oscuro" : "Modo claro"}
              </span>
            </div>
            <button
              style={{ ...s.toggle, ...(isDark ? s.toggleActive : {}) }}
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              aria-pressed={isDark}
            >
              <span style={{ ...s.toggleCircle, ...(isDark ? s.toggleCircleActive : {}) }} />
            </button>
          </div>

          {/* Modo Senior */}
          <div className="vg-sidebar-senior-row" style={s.modoSenior}>
            <div style={s.modoSeniorLeft}>
              <span style={s.modoSeniorIcon}>
                <Accessibility size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="vg-sidebar-label" style={{ ...s.modoSeniorText, fontSize: modoSenior ? "17px" : "14px" }}>
                Modo Senior
              </span>
            </div>
            <button
              style={{ ...s.toggle, ...(modoSenior ? s.toggleActive : {}) }}
              onClick={toggleModoSenior}
              aria-label="Alternar modo Senior"
              aria-pressed={modoSenior}
            >
              <span style={{ ...s.toggleCircle, ...(modoSenior ? s.toggleCircleActive : {}) }} />
            </button>
          </div>

          {/* User */}
          <Link
            to="/perfil"
            style={s.userSection}
            className="vg-sidebar-user-link"
            aria-label={`Abrir perfil de ${usuario?.nombre || "Usuario"}, ${getPerfilLabel(usuario?.perfil)}`}
            onClick={collapseSidebar}
            onMouseEnter={() => preloadRoute("/perfil")}
            onFocus={() => preloadRoute("/perfil")}
          >
            <div style={s.userAvatar}>{getInitials(usuario?.nombre)}</div>
            <div className="vg-sidebar-label" style={s.userInfo}>
              <p style={{ ...s.userName, fontSize: modoSenior ? "17px" : "14px" }}>
                {usuario?.nombre || "Usuario"}
              </p>
              <p style={{ ...s.userRole, fontSize: modoSenior ? "15px" : "12px" }}>
                {getPerfilLabel(usuario?.perfil)}
              </p>
            </div>
          </Link>

          {usuario && usuario.emailVerificado === false && (
            <EmailVerificationNotice correo={usuario.correo} />
          )}

          <button
            className="vg-sidebar-label"
            style={s.logoutBtn}
            onClick={() => {
              localStorage.removeItem("visaguide_session");
              localStorage.removeItem("correoUsuario");
              localStorage.removeItem("perfilUsuario");
              window.location.href = "/";
            }}
          >
            Cerrar sesión
          </button>
        </div>
        </div>
      </aside>
    </>
  );
}

const s = {
  sidebar: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--vg-font)",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    overflowY: "auto",
    // Mobile: hidden by default (CSS handles transform via media query)
  },
  nav: { flex:1, padding:"0 12px" },
  menuLabel: { fontSize:"11px", fontWeight:"600", color:"#64748b", letterSpacing:"0.5px", padding:"0 12px", marginBottom:"12px" },
  menuList: { listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:"4px" },
  menuItem: { display:"flex", alignItems:"center", gap:"12px", padding:"11px 14px", borderRadius:"10px", color:"#94a3b8", textDecoration:"none", fontSize:"14px", fontWeight:"500", transition:"all 0.15s ease" },
  menuItemActive: { backgroundColor:"#dc2649", color:"white" },
  menuIcon: { display:"flex", alignItems:"center", justifyContent:"center", width:"20px", height:"20px", flexShrink:0 },
  menuText: { flex:1 },
  badge: { backgroundColor:"#dc2649", color:"white", fontSize:"11px", fontWeight:"600", padding:"2px 8px", borderRadius:"10px", minWidth:"20px", textAlign:"center" },

  bottomSection: { padding:"14px", borderTop:"1px solid #1e293b", marginTop:"auto" },

  themeRow: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 8px", marginBottom:"4px" },
  themeLeft: { display:"flex", alignItems:"center", gap:"10px" },
  themeIcon: { color:"#94a3b8", display:"flex", alignItems:"center" },
  themeText: { color:"#94a3b8", fontWeight:"500" },

  modoSenior: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 8px", marginBottom:"12px" },
  modoSeniorLeft: { display:"flex", alignItems:"center", gap:"10px" },
  modoSeniorIcon: { color:"#94a3b8", display:"flex", alignItems:"center" },
  modoSeniorText: { color:"#94a3b8", fontWeight:"500" },

  toggle: { width:"44px", height:"24px", backgroundColor:"#334155", borderRadius:"12px", border:"none", cursor:"pointer", position:"relative", transition:"background-color 0.2s ease", padding:0 },
  toggleActive: { backgroundColor:"#dc2649" },
  toggleCircle: { position:"absolute", top:"3px", left:"3px", width:"18px", height:"18px", backgroundColor:"white", borderRadius:"50%", transition:"left 0.2s ease" },
  toggleCircleActive: { left:"23px" },

  userSection: { display:"flex", alignItems:"center", gap:"12px", padding:"8px" },
  userAvatar: { width:"40px", height:"40px", backgroundColor:"#334155", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"14px", fontWeight:"600" },
  userInfo: { flex:1 },
  userName: { color:"white", fontWeight:"600", margin:0 },
  userRole: { color:"#64748b", margin:"2px 0 0 0" },
  logoutBtn: { width:"100%", padding:"10px", marginTop:"10px", backgroundColor:"transparent", border:"1px solid #334155", borderRadius:"8px", color:"#94a3b8", fontSize:"13px", cursor:"pointer", fontFamily:"var(--vg-font)" },
};
