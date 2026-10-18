export const MODO_SENIOR_STORAGE_KEY = "modoSenior";
export const MODO_SENIOR_EVENT_NAME = "modoSeniorChange";
export const MODO_SENIOR_ROOT_CLASS = "modo-senior";
export const CLIENT_ROLE = "cliente";

export function getCurrentSessionRole() {
  try {
    const rawSession = localStorage.getItem("visaguide_session");
    if (!rawSession) return null;
    return JSON.parse(rawSession)?.rol || null;
  } catch {
    return null;
  }
}

export function canUseModoSenior() {
  return getCurrentSessionRole() === CLIENT_ROLE;
}

export function isModoSeniorPreferred() {
  try {
    return localStorage.getItem(MODO_SENIOR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function isModoSeniorEnabled() {
  return canUseModoSenior() && isModoSeniorPreferred();
}

export function reflectModoSenior(enabled) {
  const shouldEnable = Boolean(enabled && canUseModoSenior());
  document.documentElement.classList.toggle(MODO_SENIOR_ROOT_CLASS, shouldEnable);
  document.documentElement.dataset.uiMode = shouldEnable ? "senior" : "standard";
  return shouldEnable;
}

export function setModoSenior(enabled) {
  if (!canUseModoSenior()) {
    reflectModoSenior(false);
    return false;
  }
  try {
    localStorage.setItem(MODO_SENIOR_STORAGE_KEY, String(enabled));
  } catch {
    // El modo sigue disponible durante la sesión aunque el almacenamiento falle.
  }
  const active = reflectModoSenior(enabled);
  window.dispatchEvent(new CustomEvent(MODO_SENIOR_EVENT_NAME, { detail: active }));
  return active;
}

export function initModoSenior() {
  reflectModoSenior(isModoSeniorEnabled());
  window.addEventListener("storage", (event) => {
    if (
      event.key === MODO_SENIOR_STORAGE_KEY
      || event.key === "visaguide_session"
      || event.key === null
    ) {
      const enabled = isModoSeniorEnabled();
      reflectModoSenior(enabled);
      window.dispatchEvent(new CustomEvent(MODO_SENIOR_EVENT_NAME, { detail: enabled }));
    }
  });
}
