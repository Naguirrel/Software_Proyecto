import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Routes, Route, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { buildApiUrl } from "./config/api";
import AuthLayout from "./components/auth/AuthLayout";
import RequireAdmin from "./components/admin/RequireAdmin";
import RequireStaff from "./components/RequireStaff";
import RequireAdvisor from "./components/advisor/RequireAdvisor";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./components/auth/auth.css";

const Upload = lazy(() => import("./Upload"));
const ProfileSelection = lazy(() => import("./pages/ProfileSelection/ProfileSelection"));
const Perfil = lazy(() => import("./pages/Perfil/Perfil"));
const Documents = lazy(() => import("./pages/Documents"));
const DS160Form = lazy(() => import("./pages/ds160"));
const Informacion = lazy(() => import("./pages/Informacion"));
const Cronologia = lazy(() => import("./pages/Cronologia"));
const Entrevista = lazy(() => import("./pages/Entrevista"));
const InterviewFeedback = lazy(() => import("./pages/InterviewFeedback"));
const InterviewSimulator = lazy(() => import("./pages/InterviewSimulator"));
const QuestionBank = lazy(() => import("./pages/QuestionBank"));
const Chat = lazy(() => import("./pages/Chat"));
const Notificaciones = lazy(() => import("./pages/Notificaciones"));
const ConsularPayment = lazy(() => import("./pages/ConsularPayment"));
const ConsularAppointments = lazy(() => import("./pages/ConsularAppointments"));
const ConsularManagement = lazy(() => import("./pages/ConsularManagement"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail"));
const AdminDocuments = lazy(() => import("./pages/admin/AdminDocuments"));
const AdminInterviews = lazy(() => import("./pages/admin/AdminInterviews"));
const AdminProcesses = lazy(() => import("./pages/admin/AdminProcesses"));
const AdminProcessDetail = lazy(() => import("./pages/admin/AdminProcessDetail"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminAdvisors = lazy(() => import("./pages/admin/AdminAdvisors"));
const AdminAssignments = lazy(() => import("./pages/admin/AdminAssignments"));
const AdminDS160 = lazy(() => import("./pages/admin/AdminDS160"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));
const AdminQuestions = lazy(() => import("./pages/admin/AdminQuestions"));
const AdminActivityLogs = lazy(() => import("./pages/admin/AdminActivityLogs"));
const AdminEmailReminders = lazy(() => import("./pages/admin/AdminEmailReminders"));
const AdvisorDashboard = lazy(() => import("./pages/advisor/AdvisorDashboard"));
const AdvisorProcesses = lazy(() => import("./pages/advisor/AdvisorProcesses"));
const AdvisorDocuments = lazy(() => import("./pages/advisor/AdvisorDocuments"));
const AdvisorDS160 = lazy(() => import("./pages/advisor/AdvisorDS160"));
const AdvisorInterviews = lazy(() => import("./pages/advisor/AdvisorInterviews"));
const AdvisorChat = lazy(() => import("./pages/advisor/AdvisorChat"));
const AdvisorTasks = lazy(() => import("./pages/advisor/AdvisorTasks"));
const AdvisorQuestions = lazy(() => import("./pages/advisor/AdvisorQuestions"));
const AdvisorProfile = lazy(() => import("./pages/advisor/AdvisorProfile"));

// ── Apply saved theme on app start ──
const savedTheme = localStorage.getItem("vg-theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

const getUserId = (userData) => userData.id_usuario || userData.id;

const getLoginDestination = (userData) => {
  if (userData?.rol === "admin") return "/admin";
  if (userData?.rol === "asesor") return "/advisor";
  return userData?.perfil ? "/dashboard" : "/seleccion-perfil";
};

const SessionManager = {
  saveSession: (userData, token) => {
    localStorage.setItem("visaguide_session", JSON.stringify({
      id: getUserId(userData),
      nombre: userData.nombre,
      correo: userData.correo,
      perfil: userData.perfil || null,
      rol: userData.rol || "cliente",
      emailVerificado: userData.emailVerificado !== false,
      token: token || userData.token || null,
      loginTime: new Date().toISOString(),
    }));
  },
  getSession: () => {
    const session = localStorage.getItem("visaguide_session");
    if (!session) return null;
    try { return JSON.parse(session); } catch { return null; }
  },
  clearSession: () => {
    localStorage.removeItem("visaguide_session");
    localStorage.removeItem("correoUsuario");
    localStorage.removeItem("perfilUsuario");
  },
  isLoggedIn: () => SessionManager.getSession() !== null,
};

const validateSession = async (session) => {
  if (!session?.token) return false;
  try {
    const res = await fetch(buildApiUrl("/validar-sesion"), {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) { SessionManager.clearSession(); return false; }
    const data = await res.json();
    return data.valid;
  } catch {
    SessionManager.clearSession();
    return false;
  }
};

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingState />}>
        <Routes>
        <Route path="/"                               element={<Navigate to="/login" replace />} />
        <Route path="/login"                          element={<Login />} />
        <Route path="/registro"                       element={<Registro />} />
        <Route path="/recuperar-contrasena"           element={<ForgotPassword />} />
        <Route path="/restablecer-contrasena"         element={<ResetPassword />} />
        <Route path="/verificar-email"                element={<VerifyEmail />} />
        <Route path="/upload"                         element={<Upload />} />
        <Route path="/perfil"                         element={<Perfil />} />
        <Route path="/seleccion-perfil"               element={<ProfileSelection />} />
        <Route path="/dashboard"                      element={<Dashboard />} />
        <Route path="/informacion"                    element={<Informacion />} />
        <Route path="/cronologia"                     element={<Cronologia />} />
        <Route path="/entrevista"                     element={<Entrevista />} />
        <Route path="/entrevista/simulador"           element={<InterviewSimulator />} />
        <Route path="/entrevista/retroalimentacion"   element={<InterviewFeedback />} />
        <Route path="/admin"                          element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/users"                    element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="/admin/users/:id"                element={<RequireAdmin><AdminUserDetail /></RequireAdmin>} />
        <Route path="/admin/advisors"                 element={<RequireAdmin><AdminAdvisors /></RequireAdmin>} />
        <Route path="/admin/assignments"              element={<RequireAdmin><AdminAssignments /></RequireAdmin>} />
        <Route path="/admin/documents"                element={<RequireAdmin><AdminDocuments /></RequireAdmin>} />
        <Route path="/admin/interviews"               element={<RequireAdmin><AdminInterviews /></RequireAdmin>} />
        <Route path="/admin/consular"                 element={<RequireAdmin><ConsularManagement /></RequireAdmin>} />
        <Route path="/admin/processes"                element={<RequireAdmin><AdminProcesses /></RequireAdmin>} />
        <Route path="/admin/processes/:id"            element={<RequireAdmin><AdminProcessDetail /></RequireAdmin>} />
        <Route path="/admin/reports"                  element={<RequireAdmin><AdminReports /></RequireAdmin>} />
        <Route path="/admin/settings"                 element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
        <Route path="/admin/ds160"                    element={<RequireAdmin><AdminDS160 /></RequireAdmin>} />
        <Route path="/admin/profile"                  element={<RequireAdmin><AdminProfile /></RequireAdmin>} />
        <Route path="/admin/questions"                element={<RequireAdmin><AdminQuestions /></RequireAdmin>} />
        <Route path="/admin/activity-logs"            element={<RequireAdmin><AdminActivityLogs /></RequireAdmin>} />
        <Route path="/admin/email-reminders"          element={<RequireAdmin><AdminEmailReminders /></RequireAdmin>} />
        <Route path="/advisor"                       element={<RequireAdvisor><AdvisorDashboard /></RequireAdvisor>} />
        <Route path="/advisor/solicitudes"            element={<RequireAdvisor><AdvisorProcesses /></RequireAdvisor>} />
        <Route path="/advisor/documentos"             element={<RequireAdvisor><AdvisorDocuments /></RequireAdvisor>} />
        <Route path="/advisor/ds160"                  element={<RequireAdvisor><AdvisorDS160 /></RequireAdvisor>} />
        <Route path="/advisor/entrevistas"            element={<RequireAdvisor><AdvisorInterviews /></RequireAdvisor>} />
        <Route path="/advisor/chat"                   element={<RequireAdvisor><AdvisorChat /></RequireAdvisor>} />
        <Route path="/advisor/tareas"                 element={<RequireAdvisor><AdvisorTasks /></RequireAdvisor>} />
        <Route path="/advisor/preguntas"              element={<RequireAdvisor><AdvisorQuestions /></RequireAdvisor>} />
        <Route path="/advisor/perfil"                 element={<RequireAdvisor><AdvisorProfile /></RequireAdvisor>} />
        <Route path="/questions"                      element={<QuestionBank />} />
        <Route path="/documents"                      element={<Documents />} />
        <Route path="/ds160"                          element={<DS160Form />} />
        <Route path="/chat"                           element={<Chat />} />
        <Route path="/notificaciones"                 element={<Notificaciones />} />
        <Route path="/pagos"                          element={<ConsularPayment />} />
        <Route path="/citas"                          element={<ConsularAppointments />} />
        <Route path="/gestion-consular"               element={<RequireStaff><ConsularManagement /></RequireStaff>} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

function RouteLoadingState() {
  return (
    <main id="main-content" tabIndex="-1" className="route-loading">
      <span className="route-loading__spinner" aria-hidden="true" />
      <span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        Cargando página…
      </span>
    </main>
  );
}

/* ══════════════════════════
   Login
   ══════════════════════════ */
function Login() {
  const navigate = useNavigate();
  const [correo, setCorreo]       = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const check = async () => {
      const session = SessionManager.getSession();
      if (session && (await validateSession(session))) {
        navigate(getLoginDestination(session), { replace: true });
      }
    };
    check();
  }, [navigate]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t); }
  }, [error]);

  const validate = () => {
    if (!correo.trim()) { setError("El correo es obligatorio"); return false; }
    if (!correo.includes("@") || !correo.includes(".")) { setError("Ingresa un correo válido"); return false; }
    if (!contrasena.trim()) { setError("La contraseña es obligatoria"); return false; }
    return true;
  };

  const handleLogin = async (event) => {
    event?.preventDefault();
    if (!validate()) return;
    setIsLoading(true); setError("");
    try {
      const res = await fetch(buildApiUrl("/login"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, contrasena }),
      });
      const data = await res.json();
      if (res.ok) {
        const usuario = data.usuario || data.user;
        SessionManager.saveSession(usuario, data.token);
        localStorage.setItem("correoUsuario", correo);
        navigate(getLoginDestination(usuario), { replace: true });
      } else {
        setError(res.status === 401 ? "El correo o la contraseña son incorrectos. Verifica tus datos e intenta de nuevo." : data.error || "Ocurrió un error al iniciar sesión. Intenta más tarde.");
      }
    } catch { setError("Error de conexión."); }
    finally { setIsLoading(false); }
  };

  return (
    <AuthLayout>
      <header className="auth-form-heading">
        <h2>Iniciar sesión</h2>
        <p>Continúa con tu proceso de visa.</p>
      </header>

      {error && (
        <div className="auth-message auth-message--error" role="alert" aria-live="assertive">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleLogin} noValidate>
        <div className="auth-field">
          <label htmlFor="login-correo">Correo electrónico</label>
          <input id="login-correo" type="email" autoComplete="username" placeholder="tu@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} disabled={isLoading} />
        </div>
        <div className="auth-field">
          <label htmlFor="login-contrasena">Contraseña</label>
          <div className="auth-password">
            <input id="login-contrasena" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={contrasena} onChange={(e) => setContrasena(e.target.value)} disabled={isLoading} />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} disabled={isLoading}>
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        </div>
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading ? <><Loader2 className="auth-spinner" aria-hidden="true" /> Ingresando...</> : <>Ingresar <ArrowRight aria-hidden="true" /></>}
        </button>
      </form>

      <footer className="auth-form-footer">
        <p><Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link></p>
        <p>¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
      </footer>
    </AuthLayout>
  );
}

/* ══════════════════════════
   Recuperar contraseña
   ══════════════════════════ */
function ForgotPassword() {
  const [correo, setCorreo]       = useState("");
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    if (!correo.trim()) { setError("El correo es obligatorio"); return false; }
    if (!correo.includes("@") || !correo.includes(".")) { setError("Ingresa un correo válido"); return false; }
    return true;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setSuccess("");
    if (!validate()) return;
    setIsLoading(true); setError("");
    try {
      const res = await fetch(buildApiUrl("/forgot-password"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo }),
      });
      const data = await res.json();
      setSuccess(data.message || "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.");
    } catch { setError("Error de conexión."); }
    finally { setIsLoading(false); }
  };

  return (
    <AuthLayout>
      <header className="auth-form-heading">
        <h2>Recuperar contraseña</h2>
        <p>Te enviaremos un enlace para restablecer tu contraseña.</p>
      </header>

      {error && <div className="auth-message auth-message--error" role="alert" aria-live="assertive"><AlertCircle aria-hidden="true" /><span>{error}</span></div>}
      {success && <div className="auth-message auth-message--success" role="status" aria-live="polite"><CheckCircle2 aria-hidden="true" /><span>{success}</span></div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="forgot-correo">Correo electrónico</label>
          <input id="forgot-correo" type="email" autoComplete="username" placeholder="tu@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} disabled={isLoading} />
        </div>
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading ? <><Loader2 className="auth-spinner" aria-hidden="true" /> Enviando...</> : <>Enviar enlace <ArrowRight aria-hidden="true" /></>}
        </button>
      </form>

      <footer className="auth-form-footer">
        <p><Link to="/login">Volver a iniciar sesión</Link></p>
      </footer>
    </AuthLayout>
  );
}

/* ══════════════════════════
   Restablecer contraseña
   ══════════════════════════ */
function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [nuevaContrasena, setNuevaContrasena]         = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [error, setError]                             = useState("");
  const [success, setSuccess]                         = useState("");
  const [isLoading, setIsLoading]                     = useState(false);
  const [showPassword, setShowPassword]               = useState(false);
  const [showConfirmation, setShowConfirmation]       = useState(false);

  const validate = () => {
    if (!token) { setError("El enlace de recuperación no es válido"); return false; }
    if (!nuevaContrasena.trim() || nuevaContrasena.length < 4) { setError("La contraseña debe tener al menos 4 caracteres"); return false; }
    if (nuevaContrasena !== confirmarContrasena) { setError("Las contraseñas no coinciden"); return false; }
    return true;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (!validate()) return;
    setIsLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch(buildApiUrl("/reset-password"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nuevaContrasena }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Contraseña actualizada correctamente. Ya puedes iniciar sesión.");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      } else {
        setError(data.error || "No fue posible restablecer la contraseña.");
      }
    } catch { setError("Error de conexión."); }
    finally { setIsLoading(false); }
  };

  return (
    <AuthLayout>
      <header className="auth-form-heading">
        <h2>Restablecer contraseña</h2>
        <p>Ingresa tu nueva contraseña.</p>
      </header>

      {error && <div className="auth-message auth-message--error" role="alert" aria-live="assertive"><AlertCircle aria-hidden="true" /><span>{error}</span></div>}
      {success && <div className="auth-message auth-message--success" role="status" aria-live="polite"><CheckCircle2 aria-hidden="true" /><span>{success}</span></div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <PasswordField id="reset-contrasena" label="Nueva contraseña" value={nuevaContrasena} onChange={setNuevaContrasena} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} disabled={isLoading} />
        <PasswordField id="reset-confirmacion" label="Confirmar contraseña" value={confirmarContrasena} onChange={setConfirmarContrasena} visible={showConfirmation} onToggle={() => setShowConfirmation((visible) => !visible)} disabled={isLoading} />
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading ? <><Loader2 className="auth-spinner" aria-hidden="true" /> Guardando...</> : <>Guardar contraseña <ArrowRight aria-hidden="true" /></>}
        </button>
      </form>

      <footer className="auth-form-footer">
        <p><Link to="/login">Volver a iniciar sesión</Link></p>
      </footer>
    </AuthLayout>
  );
}

/* ══════════════════════════
   Registro
   ══════════════════════════ */
function Registro() {
  const navigate = useNavigate();
  const [nombre, setNombre]                       = useState("");
  const [correo, setCorreo]                       = useState("");
  const [contrasena, setContrasena]               = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [error, setError]                         = useState("");
  const [success, setSuccess]                     = useState("");
  const [isLoading, setIsLoading]                 = useState(false);
  const [showPassword, setShowPassword]           = useState(false);
  const [showConfirmation, setShowConfirmation]   = useState(false);

  useEffect(() => {
    const check = async () => {
      const session = SessionManager.getSession();
      if (session && (await validateSession(session))) {
        navigate(getLoginDestination(session), { replace: true });
      }
    };
    check();
  }, [navigate]);

  useEffect(() => {
    if (error || success) { const t = setTimeout(() => { setError(""); setSuccess(""); }, 5000); return () => clearTimeout(t); }
  }, [error, success]);

  const validate = () => {
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return false; }
    if (!correo.trim() || !correo.includes("@") || !correo.includes(".")) { setError("Ingresa un correo válido"); return false; }
    if (!contrasena.trim() || contrasena.length < 4) { setError("La contraseña debe tener al menos 4 caracteres"); return false; }
    if (contrasena !== confirmarContrasena) { setError("Las contraseñas no coinciden"); return false; }
    return true;
  };

  const handleRegister = async (event) => {
    event?.preventDefault();
    if (!validate()) return;
    setIsLoading(true); setError("");
    try {
      const res = await fetch(buildApiUrl("/register"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, correo, contrasena }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("¡Registro exitoso! Te enviamos un correo para verificar tu cuenta. Continuando a la selección de perfil...");
        SessionManager.saveSession(data.data, data.token);
        localStorage.setItem("correoUsuario", data.data.correo);
        navigate("/seleccion-perfil", { replace: true });
      } else {
        setError(data.error?.includes("duplicate") ? "Este correo ya está registrado. ¿Quizás ya tienes una cuenta?" : data.error || "Ocurrió un error al crear tu cuenta. Intenta más tarde.");
      }
    } catch { setError("Error de conexión."); }
    finally { setIsLoading(false); }
  };

  return (
    <AuthLayout>
      <header className="auth-form-heading">
        <h2>Crear cuenta</h2>
        <p>Crea tu cuenta y comienza tu solicitud.</p>
      </header>

      {error && <div className="auth-message auth-message--error" role="alert" aria-live="assertive"><AlertCircle aria-hidden="true" /><span>{error}</span></div>}
      {success && <div className="auth-message auth-message--success" role="status" aria-live="polite"><CheckCircle2 aria-hidden="true" /><span>{success}</span></div>}

      <form className="auth-form auth-form--register" onSubmit={handleRegister} noValidate>
        <div className="auth-field"><label htmlFor="registro-nombre">Nombre completo</label><input id="registro-nombre" type="text" autoComplete="name" placeholder="Juan Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={isLoading} /></div>
        <div className="auth-field"><label htmlFor="registro-correo">Correo electrónico</label><input id="registro-correo" type="email" autoComplete="email" placeholder="tu@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} disabled={isLoading} /></div>
        <PasswordField id="registro-contrasena" label="Contraseña" value={contrasena} onChange={setContrasena} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} disabled={isLoading} />
        <PasswordField id="registro-confirmacion" label="Confirmar contraseña" value={confirmarContrasena} onChange={setConfirmarContrasena} visible={showConfirmation} onToggle={() => setShowConfirmation((visible) => !visible)} disabled={isLoading} />
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading ? <><Loader2 className="auth-spinner" aria-hidden="true" /> Creando cuenta...</> : <>Crear cuenta <ArrowRight aria-hidden="true" /></>}
        </button>
      </form>

      <footer className="auth-form-footer">
        <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </footer>
    </AuthLayout>
  );
}

/* ══════════════════════════
   Verificar email
   ══════════════════════════ */
function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState(token ? "verifying" : "error");
  const [message, setMessage] = useState(token ? "" : "El enlace de verificación no es válido.");

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        const res = await fetch(buildApiUrl("/verificar-email"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (res.ok) {
          const session = SessionManager.getSession();
          if (session) {
            localStorage.setItem("visaguide_session", JSON.stringify({ ...session, emailVerificado: true }));
          }
          setStatus("success");
          setMessage(data.message || "Correo verificado correctamente.");
        } else {
          setStatus("error");
          setMessage(data.error || "No fue posible verificar el correo.");
        }
      } catch {
        setStatus("error");
        setMessage("Error de conexión.");
      }
    };
    verify();
  }, [token]);

  return (
    <AuthLayout>
      <header className="auth-form-heading">
        <h2>Verificación de correo</h2>
        <p>Confirmamos tu dirección de correo electrónico.</p>
      </header>

      {status === "verifying" && (
        <div className="auth-message" role="status" aria-live="polite">
          <Loader2 className="auth-spinner" aria-hidden="true" /><span>Verificando...</span>
        </div>
      )}
      {status === "success" && (
        <div className="auth-message auth-message--success" role="status" aria-live="polite">
          <CheckCircle2 aria-hidden="true" /><span>{message}</span>
        </div>
      )}
      {status === "error" && (
        <div className="auth-message auth-message--error" role="alert" aria-live="assertive">
          <AlertCircle aria-hidden="true" /><span>{message}</span>
        </div>
      )}

      <footer className="auth-form-footer">
        <p><Link to="/login">Ir a iniciar sesión</Link></p>
      </footer>
    </AuthLayout>
  );
}

function PasswordField({ id, label, value, onChange, visible, onToggle, disabled }) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <input id={id} type={visible ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
        <button type="button" onClick={onToggle} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible} disabled={disabled}>
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export default App;
