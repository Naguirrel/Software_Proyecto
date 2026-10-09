const STORAGE_KEY = "modoSenior";
const EVENT_NAME = "modoSeniorChange";

export function isModoSeniorEnabled() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function reflectModoSenior(enabled) {
  document.documentElement.toggleAttribute("data-modo-senior", enabled);
}

export function setModoSenior(enabled) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
  reflectModoSenior(enabled);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: enabled }));
}

export function initModoSenior() {
  reflectModoSenior(isModoSeniorEnabled());
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) reflectModoSenior(isModoSeniorEnabled());
  });
}
