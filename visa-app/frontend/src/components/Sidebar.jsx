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
  LogOut,
  MessageSquare,
  Moon,
  Sun,
  UserCircle,
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
          variant="full"
          className="vg-sidebar-logo"
          textClassName="vg-sidebar-label"
          subtitle="Solicitante"
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
                    data-tooltip={item.label}
                    title={!desktopExpanded ? item.label : undefined}
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
          <button
            type="button"
            className="vg-sidebar-action vg-sidebar-theme-row"
            style={s.sidebarAction}
            onClick={toggleTheme}
            aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
            aria-pressed={isDark}
            data-tooltip={isDark ? "Modo claro" : "Modo oscuro"}
          >
            {isDark
              ? <Sun size={20} strokeWidth={2} aria-hidden="true" />
              : <Moon size={20} strokeWidth={2} aria-hidden="true" />}
            <span className="vg-sidebar-label">{isDark ? "Modo claro" : "Modo oscuro"}</span>
          </button>

          <button
            type="button"
            className="vg-sidebar-action vg-sidebar-senior-row"
            style={s.sidebarAction}
            onClick={toggleModoSenior}
            aria-label="Alternar modo Senior"
            aria-pressed={modoSenior}
            data-tooltip="Modo Senior"
          >
            <Accessibility size={20} strokeWidth={2} aria-hidden="true" />
            <span className="vg-sidebar-label">Modo Senior</span>
          </button>

          {/* User */}
          <Link
            to="/perfil"
            style={s.userSection}
            className="vg-sidebar-user-link"
            data-tooltip="Mi perfil"
            aria-label={`Abrir perfil de ${usuario?.nombre || "Usuario"}, ${getPerfilLabel(usuario?.perfil)}`}
            onClick={collapseSidebar}
            onMouseEnter={() => preloadRoute("/perfil")}
            onFocus={() => preloadRoute("/perfil")}
          >
            <UserCircle size={20} strokeWidth={2} aria-hidden="true" />
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
            type="button"
            className="vg-sidebar-action vg-sidebar-logout"
            style={s.logoutBtn}
            aria-label="Cerrar sesión"
            data-tooltip="Cerrar sesión"
            onClick={() => {
              localStorage.removeItem("visaguide_session");
              localStorage.removeItem("correoUsuario");
              localStorage.removeItem("perfilUsuario");
              window.location.href = "/";
            }}
          >
            <LogOut size={20} strokeWidth={2} aria-hidden="true" />
            <span className="vg-sidebar-label">Cerrar sesión</span>
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
    backgroundColor: "var(--vg-card)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--vg-font)",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    // Mobile: hidden by default (CSS handles transform via media query)
  },
  nav: { flex:1, padding:"18px 12px 12px" },
  menuLabel: { fontSize:"10px", fontWeight:"800", color:"var(--vg-text-muted)", letterSpacing:"0.08em", padding:"0 12px", marginBottom:"8px" },
  menuList: { listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:"3px" },
  menuItem: { display:"flex", minHeight:"44px", alignItems:"center", gap:"11px", padding:"0 12px", borderRadius:"10px", color:"var(--vg-text-muted)", textDecoration:"none", fontSize:"14px", fontWeight:"700", transition:"all 0.15s ease" },
  menuItemActive: { backgroundColor:"var(--vg-navy)", color:"white", boxShadow:"0 8px 18px rgba(15,23,42,.18)" },
  menuIcon: { display:"flex", alignItems:"center", justifyContent:"center", width:"20px", height:"20px", flexShrink:0 },
  menuText: { flex:1 },
  badge: { backgroundColor:"#dc2649", color:"white", fontSize:"11px", fontWeight:"600", padding:"2px 8px", borderRadius:"10px", minWidth:"20px", textAlign:"center" },

  bottomSection: { display:"grid", gap:"2px", padding:"10px 12px 12px", borderTop:"1px solid var(--vg-border)", marginTop:"auto" },
  sidebarAction: { width:"100%", minHeight:"44px", display:"flex", alignItems:"center", gap:"11px", border:0, borderRadius:"10px", background:"transparent", color:"var(--vg-text-muted)", padding:"0 12px", font:"inherit", fontWeight:700, cursor:"pointer", textAlign:"left" },

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

  userSection: { display:"flex", minHeight:"44px", alignItems:"center", gap:"11px", padding:"0 12px", color:"var(--vg-text-muted)" },
  userAvatar: { width:"40px", height:"40px", backgroundColor:"#334155", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"14px", fontWeight:"600" },
  userInfo: { flex:1 },
  userName: { color:"var(--vg-text)", fontWeight:"700", margin:0 },
  userRole: { color:"var(--vg-text-muted)", margin:"2px 0 0 0" },
  logoutBtn: { width:"100%", minHeight:"44px", display:"flex", alignItems:"center", gap:"11px", padding:"0 12px", marginTop:"2px", backgroundColor:"transparent", border:0, borderRadius:"10px", color:"var(--vg-red)", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"var(--vg-font)", textAlign:"left" },
};
