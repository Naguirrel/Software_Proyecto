// Política de contraseñas (SP10-05): mínimo 8 caracteres, con letras y números.
// Se aplica al registrar y al restablecer; el login no la exige para no bloquear cuentas existentes.

const MIN_PASSWORD_LENGTH = 8;

const PASSWORD_POLICY_MESSAGE = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres e incluir letras y números`;

/** Devuelve `null` si la contraseña cumple la política o el mensaje de error si no. */
function validatePassword(password) {
  if (typeof password !== "string") return PASSWORD_POLICY_MESSAGE;
  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;
  const hasLetter = /\p{L}/u.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasMinLength && hasLetter && hasNumber ? null : PASSWORD_POLICY_MESSAGE;
}

module.exports = { MIN_PASSWORD_LENGTH, PASSWORD_POLICY_MESSAGE, validatePassword };
