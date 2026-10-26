import { apiRequest } from "./apiClient";
import { buildSessionHeaders } from "./sessionAuth";

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);

function persistAvatarVersion(result) {
  try {
    const session = JSON.parse(localStorage.getItem("visaguide_session") || "null");
    if (!session || Number(session.id || session.id_usuario) !== Number(result.userId)) return;
    localStorage.setItem("visaguide_session", JSON.stringify({
      ...session,
      avatarVersion: result.avatarVersion,
    }));
  } catch {
    // Una sesión local dañada será descartada por la validación de autenticación.
  }
}

export function validateAvatarSelection(file) {
  if (!file) throw new Error("Selecciona una fotografía.");
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) throw new Error("Usa una imagen JPG o PNG.");
  if (file.size > MAX_AVATAR_SIZE_BYTES) throw new Error("La fotografía no puede superar 2 MB.");
}

export async function uploadProfileAvatar(file) {
  validateAvatarSelection(file);
  const body = new FormData();
  body.append("avatar", file);
  const result = await apiRequest("/identity/avatar", {
    method: "PUT",
    headers: buildSessionHeaders(),
    body,
    fallbackMessage: "No fue posible actualizar la fotografía.",
  });
  persistAvatarVersion(result);
  window.dispatchEvent(new CustomEvent("visaguide:avatar-updated", {
    detail: { userId: result.userId, avatarVersion: result.avatarVersion },
  }));
  return result;
}

export async function deleteProfileAvatar() {
  const result = await apiRequest("/identity/avatar", {
    method: "DELETE",
    headers: buildSessionHeaders(),
    fallbackMessage: "No fue posible eliminar la fotografía.",
  });
  persistAvatarVersion(result);
  window.dispatchEvent(new CustomEvent("visaguide:avatar-updated", {
    detail: { userId: result.userId, avatarVersion: result.avatarVersion },
  }));
  return result;
}
