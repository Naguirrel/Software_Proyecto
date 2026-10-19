import { AlertCircle, Info } from "lucide-react";
import { hasPriorityBadge } from "../utils/notificationPriority";

// Distintivo de prioridad: texto + icono, para que no dependa solo del color.
export default function NotificationPriorityBadge({ priority, label }) {
  if (!hasPriorityBadge(priority)) return null;
  const Icon = priority === "alta" ? AlertCircle : Info;
  return (
    <span className={`vg-priority-badge vg-priority-badge--${priority}`}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}
