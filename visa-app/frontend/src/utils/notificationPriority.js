// Prioridad visual de las notificaciones (RF-16). El backend guarda `prioridad` como
// "baja" | "normal" | "alta"; una notificación sin prioridad (o con un valor desconocido)
// se trata como "normal" para no romper listas antiguas ni eventos en tiempo real viejos.

export const NOTIFICATION_PRIORITIES = ["baja", "normal", "alta"];

export function getNotificationPriority(notification) {
  return NOTIFICATION_PRIORITIES.includes(notification?.prioridad) ? notification.prioridad : "normal";
}

// Las notificaciones normales no llevan distintivo: solo se marcan las que se salen de lo común.
export function hasPriorityBadge(priority) {
  return priority === "alta" || priority === "baja";
}
