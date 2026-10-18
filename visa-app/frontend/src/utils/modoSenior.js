export const MODO_SENIOR_STORAGE_KEY = "modoSenior";
export const MODO_SENIOR_EVENT_NAME = "modoSeniorChange";
export const MODO_SENIOR_ROOT_CLASS = "modo-senior";

export function isModoSeniorEnabled() {
  try {
    return localStorage.getItem(MODO_SENIOR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function reflectModoSenior(enabled) {
  document.documentElement.classList.toggle(MODO_SENIOR_ROOT_CLASS, enabled);
  document.documentElement.dataset.uiMode = enabled ? "senior" : "standard";
}

export function setModoSenior(enabled) {
  try {
    localStorage.setItem(MODO_SENIOR_STORAGE_KEY, String(enabled));
  } catch {
    // El modo sigue disponible durante la sesión aunque el almacenamiento falle.
  }
  reflectModoSenior(enabled);
  window.dispatchEvent(new CustomEvent(MODO_SENIOR_EVENT_NAME, { detail: enabled }));
}

export function initModoSenior() {
  reflectModoSenior(isModoSeniorEnabled());
  window.addEventListener("storage", (event) => {
    if (event.key === MODO_SENIOR_STORAGE_KEY || event.key === null) {
      const enabled = isModoSeniorEnabled();
      reflectModoSenior(enabled);
      window.dispatchEvent(new CustomEvent(MODO_SENIOR_EVENT_NAME, { detail: enabled }));
    }
  });
}
