import { buildAdvisorWhatsappUrl } from "./advisorContact";
import { translate } from "../i18n/translations";

const TOTAL_DS160_SECTIONS = 10;
const REQUIRED_DOCUMENT_COUNT = 3;

const STEP_PATHS = {
  1: { path: "/perfil" },
  2: { path: "/ds160" },
  3: { path: "/documents" },
  4: { path: buildAdvisorWhatsappUrl(), external: true },
  5: { path: buildAdvisorWhatsappUrl(), external: true },
  6: { path: "/entrevista" },
  7: { path: "/notificaciones" },
};

export function getProcessSteps(idioma = "es") {
  const t = (key) => translate(idioma, key);
  return Object.entries(STEP_PATHS).map(([number, action]) => ({
    number: Number(number),
    shortLabel: t(`step.${number}.short`),
    label: t(`step.${number}.label`),
    description: t(`step.${number}.description`),
    action: { ...action, label: t(`step.${number}.action`) },
  }));
}

export const PROCESS_STEPS = getProcessSteps("es");

export const TOTAL_PROCESS_STEPS = PROCESS_STEPS.length;

export function calculateDs160Percentage(ds160) {
  if (ds160?.completado) return 100;
  const currentSection = Number(ds160?.seccion_actual);
  if (!Number.isFinite(currentSection)) return 0;
  const completedSections = Math.min(
    TOTAL_DS160_SECTIONS,
    Math.max(0, Math.floor(currentSection) - 1)
  );
  return Math.round((completedSections / TOTAL_DS160_SECTIONS) * 100);
}

export function summarizeDocuments(documents) {
  const list = Array.isArray(documents) ? documents : [];

  const summary = list.reduce(
    (summary, document) => {
      const rawStatus = document?.estado || document?.status || "pending";
      const status = rawStatus === "rejected" ? "correction" : rawStatus;
      return {
        ...summary,
        total: summary.total + 1,
        [status]: (summary[status] || 0) + 1,
      };
    },
    { total: 0, approved: 0, review: 0, correction: 0, pending: 0 }
  );

  const missingRequiredDocuments = Math.max(0, REQUIRED_DOCUMENT_COUNT - summary.total);
  return {
    ...summary,
    pending: summary.pending + missingRequiredDocuments,
    required: REQUIRED_DOCUMENT_COUNT,
  };
}

function clampStage(stageNumber) {
  const parsedStage = Number(stageNumber);
  if (!Number.isFinite(parsedStage)) return 1;
  return Math.min(TOTAL_PROCESS_STEPS, Math.max(1, Math.ceil(parsedStage)));
}

function stageFromTramite(tramite) {
  const currentStageText = String(tramite?.etapaActual || "").toLowerCase();

  if (currentStageText.includes("decisi")) return 7;
  if (currentStageText.includes("entrevista")) return 6;
  if (currentStageText.includes("cita")) return 5;
  if (currentStageText.includes("pago")) return 4;
  if (currentStageText.includes("document")) return 3;
  if (currentStageText.includes("ds-160") || currentStageText.includes("ds160")) return 2;
  if (currentStageText.includes("perfil")) return 1;

  const progreso = Number(tramite?.progreso);
  if (!Number.isFinite(progreso)) return 1;

  return clampStage(Math.ceil(Math.min(100, Math.max(0, progreso)) / (100 / TOTAL_PROCESS_STEPS)));
}

export function getCurrentProcessStage({
  session = null,
  tramite = {},
  ds160Percentage = 0,
  documentSummary = {},
} = {}) {
  if (!session?.perfil) return 1;
  if (Number(ds160Percentage) < 100) return 2;

  const pendingDocuments = Number(documentSummary.pending) || 0;
  const correctionDocuments = Number(documentSummary.correction) || 0;
  if (pendingDocuments > 0 || correctionDocuments > 0) return 3;

  return Math.max(4, stageFromTramite(tramite));
}

export function getProcessStageLabel(stageNumber, idioma = "es") {
  return translate(idioma, `step.${clampStage(stageNumber)}.label`);
}

export function getProcessTimeline(stageNumber, data = {}, idioma = "es") {
  const currentStage = clampStage(stageNumber);
  const { tramite, ds160, documents } = data;

  // Obtener fecha del último documento aprobado
  const getLastApprovedDocDate = () => {
    if (!Array.isArray(documents)) return null;
    const approved = documents
      .filter(d => d.estado === "approved" && d.actualizado_en)
      .sort((a, b) => new Date(b.actualizado_en) - new Date(a.actualizado_en));
    return approved[0]?.actualizado_en || null;
  };

  // Mapear fecha según la etapa
  const getCompletedAt = (stepNumber) => {
    if (stepNumber >= currentStage) return null;
    
    switch (stepNumber) {
      case 1: return tramite?.created_at || null;
      case 2: return ds160?.completado ? (ds160?.updated_at || null) : null;
      case 3: return getLastApprovedDocDate();
      default: return tramite?.updated_at || null;
    }
  };

  return getProcessSteps(idioma).map((step) => ({
    ...step,
    estado: step.number < currentStage ? "completada" : step.number === currentStage ? "actual" : "pendiente",
    done: step.number < currentStage,
    active: step.number === currentStage,
    completedAt: getCompletedAt(step.number),
  }));
}

export function getDashboardNextAction({
  stageNumber = 1,
  ds160Percentage = 0,
  documentSummary = {},
  tramite = {},
  idioma = "es",
} = {}) {
  const t = (key, vars) => translate(idioma, key, vars);
  const correctionCount = Number(documentSummary.correction) || 0;
  // siguiente_paso viene del backend en español; en otro idioma se usa el texto traducido.
  const serverNextStep = idioma === "es" ? tramite?.siguientePaso : null;

  if (correctionCount > 0) {
    return {
      priority: t("action.priorityHigh"),
      timeEstimate: t("action.timeEstimate", { min: 10 }),
      title: t("action.correction.title"),
      description: t("action.correction.description", { count: correctionCount }),
      path: "/documents",
      buttonLabel: t("action.correction.button"),
    };
  }

  const actionsByStage = {
    1: {
      priority: t("action.priorityHigh"),
      timeEstimate: t("action.timeEstimate", { min: 8 }),
      title: t("action.1.title"),
      description: t("action.1.description"),
      path: "/perfil",
      buttonLabel: t("action.1.button"),
    },
    2: {
      priority: ds160Percentage > 0 ? t("action.inProgress") : t("action.priorityHigh"),
      timeEstimate: t("action.timeEstimate", { min: 45 }),
      title: t("action.2.title"),
      description: t("action.2.description"),
      path: "/ds160",
      buttonLabel: ds160Percentage > 0 ? t("action.2.buttonContinue") : t("action.2.buttonStart"),
    },
    3: {
      priority: t("action.priorityHigh"),
      timeEstimate: t("action.timeEstimate", { min: 15 }),
      title: t("action.3.title"),
      description: t("action.3.description"),
      path: "/documents",
      buttonLabel: t("action.3.button"),
    },
    4: {
      priority: t("action.priorityHigh"),
      timeEstimate: t("action.timeEstimate", { min: 20 }),
      title: serverNextStep || t("action.4.title"),
      description: t("action.4.description"),
      path: buildAdvisorWhatsappUrl(),
      buttonLabel: t("action.talkToAdvisor"),
    },
    5: {
      priority: t("action.important"),
      timeEstimate: t("action.timeEstimate", { min: 15 }),
      title: serverNextStep || t("action.5.title"),
      description: t("action.5.description"),
      path: buildAdvisorWhatsappUrl(),
      buttonLabel: t("action.talkToAdvisor"),
    },
    6: {
      priority: t("action.important"),
      timeEstimate: t("action.timeEstimate", { min: 25 }),
      title: serverNextStep || t("action.6.title"),
      description: t("action.6.description"),
      path: "/entrevista",
      buttonLabel: t("action.6.button"),
    },
    7: {
      priority: t("action.followUp"),
      timeEstimate: t("action.timeEstimate", { min: 5 }),
      title: serverNextStep || t("action.7.title"),
      description: t("action.7.description"),
      path: "/notificaciones",
      buttonLabel: t("action.7.button"),
    },
  };

  return actionsByStage[stageNumber] || actionsByStage[1];
}

export function getDashboardQuickCards({
  documentSummary = {},
  stageNumber = 1,
  idioma = "es",
} = {}) {
  const t = (key, vars) => translate(idioma, key, vars);
  const correctionCount = Number(documentSummary.correction) || 0;
  const pendingCount = Number(documentSummary.pending) || 0;
  const reviewCount = Number(documentSummary.review) || 0;
  const totalCount = Number(documentSummary.total) || 0;

  const documentCard = correctionCount > 0
    ? {
        badge: t("action.important"),
        title: t("cards.docsReview.title"),
        description: t("cards.docsReview.description", { count: correctionCount }),
        cta: t("action.correction.button"),
        path: "/documents",
        tone: "yellow",
      }
    : pendingCount > 0
    ? {
        badge: t("cards.badgePending"),
        title: t("cards.docsUpload.title"),
        description: t("cards.docsUpload.description", { count: pendingCount }),
        cta: t("cards.docsUpload.cta"),
        path: "/documents",
        tone: "yellow",
      }
    : {
        badge: reviewCount > 0 ? t("cards.badgeReview") : t("cards.badgeReady"),
        title: t("cards.docs.title"),
        description: totalCount > 0
          ? t("cards.docs.description", { count: totalCount })
          : t("cards.docs.empty"),
        cta: t("cards.docs.cta"),
        path: "/documents",
        tone: "white",
      };

  return [
    documentCard,
    {
      title: t("cards.timeline.title"),
      description: t("cards.timeline.description"),
      cta: stageNumber >= 4 ? t("cards.timeline.ctaProgress") : t("cards.timeline.ctaExplore"),
      path: "/cronologia",
      tone: "white",
    },
    {
      title: stageNumber >= 6 ? t("cards.interview.titlePrep") : t("cards.interview.titleSim"),
      description: stageNumber >= 6
        ? t("cards.interview.descriptionPrep")
        : t("cards.interview.descriptionSim"),
      cta: stageNumber >= 6 ? t("cards.interview.ctaPrep") : t("cards.interview.ctaSim"),
      path: "/entrevista",
      tone: "dark",
    },
  ];
}
