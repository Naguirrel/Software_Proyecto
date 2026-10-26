const { PRIVACY_NOTICE_VERSION } = require("../config/privacyNotice");

// Campos que el formulario de registro envía al aceptar el aviso de privacidad vigente.
const PRIVACY_CONSENT = Object.freeze({ acepta_privacidad: true, version_privacidad: PRIVACY_NOTICE_VERSION });

module.exports = { PRIVACY_CONSENT };
