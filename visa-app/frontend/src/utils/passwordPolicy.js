// Política de contraseñas (SP10-05). Debe coincidir con backend/services/passwordPolicy.js:
// mínimo 8 caracteres, con letras y números. El backend es quien la hace cumplir; aquí se
// valida antes de enviar para dar un mensaje claro de qué falta.

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_HINT = `Mínimo ${MIN_PASSWORD_LENGTH} caracteres, con letras y números.`;

/** Devuelve `""` si la contraseña cumple la política o el mensaje de lo que le falta. */
export function getPasswordError(password) {
  const value = typeof password === "string" ? password : "";
  if (value.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  if (!/\p{L}/u.test(value)) return "La contraseña debe incluir al menos una letra";
  if (!/[0-9]/.test(value)) return "La contraseña debe incluir al menos un número";
  return "";
}
