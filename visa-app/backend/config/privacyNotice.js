// Versión vigente del aviso de privacidad (SP10-12). Debe coincidir con la de
// `frontend/src/config/privacyNotice.js`: al cambiar el texto del aviso se sube la versión en ambos
// lados y los registros nuevos guardan la versión que la persona aceptó.
const PRIVACY_NOTICE_VERSION = "1.0";

const PRIVACY_REQUIRED_MESSAGE = "Debes aceptar el aviso de privacidad para crear tu cuenta";
const PRIVACY_OUTDATED_MESSAGE = "El aviso de privacidad cambió. Recarga la página y acéptalo de nuevo";

/** Devuelve `null` si el registro acepta la versión vigente o el mensaje de error si no. */
function validatePrivacyConsent({ acepta_privacidad: accepted, version_privacidad: version } = {}) {
  if (accepted !== true) return PRIVACY_REQUIRED_MESSAGE;
  if (version !== PRIVACY_NOTICE_VERSION) return PRIVACY_OUTDATED_MESSAGE;
  return null;
}

module.exports = {
  PRIVACY_NOTICE_VERSION,
  PRIVACY_REQUIRED_MESSAGE,
  PRIVACY_OUTDATED_MESSAGE,
  validatePrivacyConsent,
};
