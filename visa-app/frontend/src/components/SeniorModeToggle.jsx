import { useState } from "react";
import { Accessibility } from "lucide-react";
import useModoSenior from "../hooks/useModoSenior";
import { setModoSenior } from "../utils/modoSenior";

export default function SeniorModeToggle({
  className = "",
  label = "Modo senior",
  ariaLabel,
  iconSize = 22,
  showState = false,
  style,
}) {
  const enabled = useModoSenior();
  const [announcement, setAnnouncement] = useState("");

  const toggle = () => {
    const nextEnabled = !enabled;
    setModoSenior(nextEnabled);
    setAnnouncement(`${label} ${nextEnabled ? "activado" : "desactivado"}`);
  };

  return (
    <>
      <button
        type="button"
        className={`vg-senior-toggle${className ? ` ${className}` : ""}`}
        style={style}
        onClick={toggle}
        aria-label={ariaLabel || `${enabled ? "Desactivar" : "Activar"} modo senior`}
        aria-pressed={enabled}
        data-tooltip={label}
      >
        <Accessibility size={iconSize} strokeWidth={2} aria-hidden="true" />
        <span>{label}{showState ? ` · ${enabled ? "activado" : "desactivado"}` : ""}</span>
      </button>
      {announcement && (
        <span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      )}
    </>
  );
}
