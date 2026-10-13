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
  LockKeyhole,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
  UserCircle,
  Users,
} from "lucide-react";
import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "../utils/sessionAuth";
import { setModoSenior as applyModoSenior } from "../utils/modoSenior";
import useModoSenior from "../hooks/useModoSenior";
import useTheme from "../hooks/useTheme";
import useIdioma from "../hooks/useIdioma";
import TopActions from "./TopActions";
import VisaGuideLogo from "./VisaGuideLogo";
import EmailVerificationNotice from "./EmailVerificationNotice";
import { preloadRoute } from "../routes/lazyRoutes";
import useClientWorkflow from "../hooks/useClientWorkflow";

const menuItems = [
  { id: "inicio", labelKey: "sidebar.inicio", Icon: LayoutGrid, path: "/dashboard" },
  { id: "ds160", labelKey: "sidebar.ds160", gate: "ds160", Icon: FileText, path: "/ds160" },
  { id: "cronologia", labelKey: "sidebar.cronologia", Icon: Clock3, path: "/cronologia" },
  { id: "documentos", labelKey: "sidebar.documentos", Icon: Folder, path: "/documents" },
  { id: "pagos", labelKey: "sidebar.pagos", gate: "payment", Icon: CreditCard, path: "/pagos" },
  { id: "citas", labelKey: "sidebar.citas", gate: "appointment", Icon: CalendarDays, path: "/citas" },
  { id: "entrevista", labelKey: "sidebar.entrevista", gate: "interview", Icon: Users, path: "/entrevista" },
  { id: "chat", labelKey: "sidebar.chat", gate: "chat", Icon: MessageSquare, path: "/chat" },
];

const staffMenuItem = { id: "gestion-consular", labelKey: "sidebar.gestionConsular", Icon: CreditCard, path: "/gestion-consular" };

export default function Sidebar({ currentPage }) {
  const modoSenior = useModoSenior();
  const iconSize = modoSenior ? 28 : 20;
  const rowSenior = modoSenior ? s.rowSenior : null;
  const [seniorAnnouncement, setSeniorAnnouncement] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [autoExpandDisabled, setAutoExpandDisabled] = useState(false);
  const sidebarRef = useRef(null);
  const { isDark, toggleTheme } = useTheme();
  const { t } = useIdioma();

  const readUsuario = () => {
    const session = localStorage.getItem("visaguide_session");
    if (session) {
      try { return JSON.parse(session); } catch { return null; }
    }
    return null;
  };

  const [usuario, setUsuario] = useState(readUsuario);
  const [noLeidas, setNoLeidas] = useState(0);
  const isClient = usuario?.rol === "cliente";
  const { workflow } = useClientWorkflow({ enabled: isClient });

  useEffect(() => {
    document.body.classList.add("vg-has-top-actions");
    return () => document.body.classList.remove("vg-has-top-actions");
  }, []);

  // Si el correo se verifica en otra pestaña, refleja el cambio aquí sin recargar.
  useEffect(() => {
    const syncUsuario = (event) => {
      if (event.key && event.key !== "visaguide_session") return;
      setUsuario(readUsuario());
    };
    window.addEventListener("storage", syncUsuario);
    return () => window.removeEventListener("storage", syncUsuario);
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
    applyModoSenior(next);
    setSeniorAnnouncement(t(next ? "sidebar.seniorOn" : "sidebar.seniorOff"));
  };

  const getPerfilLabel = (perfil) => {
    const perfiles = ["turismo_negocios", "estudiante", "renovacion", "grupo_familiar", "adulto_mayor"];
    return t(`perfilLabel.${perfiles.includes(perfil) ? perfil : "default"}`);
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
        aria-label={mobileOpen ? t("sidebar.closeMenu") : t("sidebar.openMenu")}
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
        aria-label={t("sidebar.navLabel")}
        onMouseLeave={() => setAutoExpandDisabled(false)}
        onFocusCapture={() => setAutoExpandDisabled(false)}
      >
        {/* Logo */}
        <VisaGuideLogo
          variant="full"
          className="vg-sidebar-logo"
          textClassName="vg-sidebar-label"
          subtitle={t("sidebar.subtitle")}
        />

        <button
          type="button"
          className="vg-sidebar-expand-button"
          aria-expanded={desktopExpanded}
          aria-controls="vg-sidebar-content"
          aria-label={desktopExpanded ? t("sidebar.collapse") : t("sidebar.expand")}
          onClick={() => setDesktopExpanded((expanded) => !expanded)}
        >
          {desktopExpanded
            ? <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            : <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />}
        </button>

        {/* Nav */}
        <div id="vg-sidebar-content" className="vg-sidebar-content">
        <nav style={s.nav}>
          <p className="vg-sidebar-label" style={{ ...s.menuLabel, ...(modoSenior ? s.menuLabelSenior : null) }}>{t("sidebar.menu")}</p>
          {isClient && workflow && !workflow.assigned && (
            <p className="vg-sidebar-label vg-sidebar-workflow-note">Asesor pendiente · documentos habilitados</p>
          )}
          <ul style={{ ...s.menuList, gap: modoSenior ? "6px" : "3px" }}>
            {(usuario?.rol === "asesor" ? [menuItems[0], staffMenuItem, ...menuItems.slice(1)] : menuItems).map((item) => {
              const isActive = currentPage === item.id;
              const label = t(item.labelKey);
              const itemGate = item.gate ? workflow?.gates?.[item.gate] : null;
              const isLocked = Boolean(isClient && item.gate && (!workflow || !itemGate?.allowed));
              if (isLocked) {
                return (
                  <li key={item.id}>
                    <span
                      className="vg-sidebar-locked-link"
                      style={{ ...s.menuItem, ...rowSenior }}
                      aria-disabled="true"
                      data-tooltip={itemGate?.reason || "Validando etapa…"}
                      title={itemGate?.reason || "Validando etapa…"}
                    >
                      <span style={{ ...s.menuIcon, width: iconSize, height: iconSize }}><item.Icon size={iconSize} strokeWidth={2} aria-hidden="true" /></span>
                      <span className="vg-sidebar-label" style={{ ...s.menuText, fontSize: modoSenior ? "18px" : "14px" }}>{label}</span>
                      <LockKeyhole className="vg-sidebar-label" size={modoSenior ? 20 : 15} aria-hidden="true" />
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    style={{ ...s.menuItem, ...rowSenior, ...(isActive ? s.menuItemActive : {}) }}
                    data-tooltip={label}
                    title={!desktopExpanded ? label : undefined}
                    onClick={collapseSidebar}
                    onMouseEnter={() => preloadRoute(item.path)}
                    onFocus={() => preloadRoute(item.path)}
                  >
                    <span style={{ ...s.menuIcon, width: iconSize, height: iconSize }}><item.Icon size={iconSize} strokeWidth={2} aria-hidden="true" /></span>
                    <span className="vg-sidebar-label" style={{ ...s.menuText, fontSize: modoSenior ? "18px" : "14px" }}>
                      {label}
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
            style={{ ...s.sidebarAction, ...rowSenior }}
            onClick={toggleTheme}
            aria-label={isDark ? t("sidebar.enableLightMode") : t("sidebar.enableDarkMode")}
            aria-pressed={isDark}
            data-tooltip={isDark ? t("sidebar.lightMode") : t("sidebar.darkMode")}
          >
            {isDark
              ? <Sun size={iconSize} strokeWidth={2} aria-hidden="true" />
              : <Moon size={iconSize} strokeWidth={2} aria-hidden="true" />}
            <span className="vg-sidebar-label">{isDark ? t("sidebar.lightMode") : t("sidebar.darkMode")}</span>
          </button>

          <button
            type="button"
            className="vg-sidebar-action vg-sidebar-senior-row"
            style={{ ...s.sidebarAction, ...rowSenior }}
            onClick={toggleModoSenior}
            aria-label={t("sidebar.toggleSenior")}
            aria-pressed={modoSenior}
            data-tooltip={t("sidebar.seniorMode")}
          >
            <Accessibility size={iconSize} strokeWidth={2} aria-hidden="true" />
            <span className="vg-sidebar-label">{t("sidebar.seniorMode")}</span>
          </button>
          <span className="visually-hidden" role="status" aria-live="polite">
            {seniorAnnouncement}
          </span>

          {/* User */}
          <Link
            to="/perfil"
            style={{ ...s.userSection, ...rowSenior }}
            className="vg-sidebar-user-link"
            data-tooltip={t("sidebar.myProfile")}
            aria-label={t("sidebar.openProfile", { nombre: usuario?.nombre || t("sidebar.user"), perfil: getPerfilLabel(usuario?.perfil) })}
            onClick={collapseSidebar}
            onMouseEnter={() => preloadRoute("/perfil")}
            onFocus={() => preloadRoute("/perfil")}
          >
            <UserCircle size={iconSize} strokeWidth={2} aria-hidden="true" />
            <div className="vg-sidebar-label" style={s.userInfo}>
              <p style={{ ...s.userName, fontSize: modoSenior ? "18px" : "14px" }}>
                {usuario?.nombre || t("sidebar.user")}
              </p>
              <p style={{ ...s.userRole, fontSize: modoSenior ? "16px" : "12px" }}>
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
            style={{ ...s.logoutBtn, ...rowSenior }}
            aria-label={t("sidebar.logout")}
            data-tooltip={t("sidebar.logout")}
            onClick={() => {
              localStorage.removeItem("visaguide_session");
              localStorage.removeItem("correoUsuario");
              localStorage.removeItem("perfilUsuario");
              window.location.href = "/";
            }}
          >
            <LogOut size={iconSize} strokeWidth={2} aria-hidden="true" />
            <span className="vg-sidebar-label">{t("sidebar.logout")}</span>
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
  menuLabelSenior: { fontSize:"14px", marginBottom:"12px" },
  rowSenior: { minHeight:"56px", gap:"16px", padding:"0 20px", fontSize:"18px" },
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
