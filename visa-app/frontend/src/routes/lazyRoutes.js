const routeLoaders = Object.freeze({
  upload: () => import("../Upload"),
  profileSelection: () => import("../pages/ProfileSelection/ProfileSelection"),
  profile: () => import("../pages/Perfil/Perfil"),
  documents: () => import("../pages/Documents"),
  ds160: () => import("../pages/ds160"),
  information: () => import("../pages/Informacion"),
  timeline: () => import("../pages/Cronologia"),
  interview: () => import("../pages/Entrevista"),
  interviewFeedback: () => import("../pages/InterviewFeedback"),
  interviewSimulator: () => import("../pages/InterviewSimulator"),
  questionBank: () => import("../pages/QuestionBank"),
  chat: () => import("../pages/Chat"),
  notifications: () => import("../pages/Notificaciones"),
  consularPayment: () => import("../pages/ConsularPayment"),
  consularAppointments: () => import("../pages/ConsularAppointments"),
  consularManagement: () => import("../pages/ConsularManagement"),
  dashboard: () => import("../pages/Dashboard"),
  adminDashboard: () => import("../pages/admin/AdminDashboard"),
  adminUsers: () => import("../pages/admin/AdminUsers"),
  adminUserDetail: () => import("../pages/admin/AdminUserDetail"),
  adminDocuments: () => import("../pages/admin/AdminDocuments"),
  adminInterviews: () => import("../pages/admin/AdminInterviews"),
  adminProcesses: () => import("../pages/admin/AdminProcesses"),
  adminProcessDetail: () => import("../pages/admin/AdminProcessDetail"),
  adminReports: () => import("../pages/admin/AdminReports"),
  adminSettings: () => import("../pages/admin/AdminSettings"),
  adminAdvisors: () => import("../pages/admin/AdminAdvisors"),
  adminAssignments: () => import("../pages/admin/AdminAssignments"),
  adminDs160: () => import("../pages/admin/AdminDS160"),
  adminProfile: () => import("../pages/admin/AdminProfile"),
  adminQuestions: () => import("../pages/admin/AdminQuestions"),
  adminActivityLogs: () => import("../pages/admin/AdminActivityLogs"),
  adminEmailReminders: () => import("../pages/admin/AdminEmailReminders"),
});

const routeKeysByPath = new Map([
  ["/upload", "upload"], ["/seleccion-perfil", "profileSelection"],
  ["/perfil", "profile"], ["/documents", "documents"], ["/ds160", "ds160"],
  ["/informacion", "information"], ["/cronologia", "timeline"],
  ["/entrevista", "interview"], ["/entrevista/retroalimentacion", "interviewFeedback"],
  ["/entrevista/simulador", "interviewSimulator"], ["/questions", "questionBank"],
  ["/chat", "chat"], ["/notificaciones", "notifications"],
  ["/pagos", "consularPayment"], ["/citas", "consularAppointments"],
  ["/gestion-consular", "consularManagement"], ["/dashboard", "dashboard"],
  ["/admin", "adminDashboard"], ["/admin/users", "adminUsers"],
  ["/admin/documents", "adminDocuments"], ["/admin/interviews", "adminInterviews"],
  ["/admin/consular", "consularManagement"], ["/admin/processes", "adminProcesses"],
  ["/admin/reports", "adminReports"], ["/admin/settings", "adminSettings"],
  ["/admin/advisors", "adminAdvisors"], ["/admin/assignments", "adminAssignments"],
  ["/admin/ds160", "adminDs160"], ["/admin/profile", "adminProfile"],
  ["/admin/questions", "adminQuestions"], ["/admin/activity-logs", "adminActivityLogs"],
  ["/admin/email-reminders", "adminEmailReminders"],
]);

const preloadCache = new Map();

function normalizePath(path) {
  const pathname = String(path || "").split(/[?#]/, 1)[0];
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function resolveRouteKey(path) {
  const pathname = normalizePath(path);
  const exactMatch = routeKeysByPath.get(pathname);
  if (exactMatch) return exactMatch;
  if (/^\/admin\/users\/[^/]+$/.test(pathname)) return "adminUserDetail";
  if (/^\/admin\/processes\/[^/]+$/.test(pathname)) return "adminProcessDetail";
  return null;
}

export function preloadRoute(path) {
  const routeKey = resolveRouteKey(path);
  if (!routeKey) return Promise.resolve(false);
  if (preloadCache.has(routeKey)) return preloadCache.get(routeKey);

  const preload = routeLoaders[routeKey]()
    .then(() => true)
    .catch(() => {
      preloadCache.delete(routeKey);
      return false;
    });
  preloadCache.set(routeKey, preload);
  return preload;
}
