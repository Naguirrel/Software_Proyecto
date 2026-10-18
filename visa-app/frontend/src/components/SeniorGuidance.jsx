import { CircleHelp } from "lucide-react";

const PAGE_GUIDANCE = {
  inicio: {
    title: "Empieza por tu siguiente acción",
    description: "Busca la tarjeta “Tu siguiente paso” y pulsa su botón. La lista inferior te muestra qué está listo y qué sigue después.",
  },
  documentos: {
    title: "Sube solo los documentos solicitados",
    description: "Busca un documento pendiente, pulsa “Subir” y espera la confirmación antes de continuar con otro archivo.",
  },
  ds160: {
    title: "Completa una sección a la vez",
    description: "Llena los campos visibles, guarda tu progreso y pulsa “Siguiente”. Los consejos de la derecha explican las preguntas difíciles.",
  },
  cronologia: {
    title: "Revisa únicamente tu etapa actual",
    description: "La tarjeta resaltada indica dónde estás. Si aparece un botón, úsalo para realizar la acción que corresponde ahora.",
  },
  pagos: {
    title: "Verifica los datos antes de pagar",
    description: "Lee el monto y las instrucciones, adjunta el comprobante correcto y confirma una sola vez.",
  },
  citas: {
    title: "Confirma la fecha con atención",
    description: "Revisa el día, la hora y el lugar antes de guardar. Tu asesor debe validar esta etapa.",
  },
  entrevista: {
    title: "Practica antes de tu entrevista",
    description: "Pulsa “Iniciar simulador”, responde con calma y consulta la retroalimentación cuando esté disponible.",
  },
  chat: {
    title: "Escribe directamente a tu asesor",
    description: "Redacta tu duda en el campo inferior y pulsa enviar. No compartas contraseñas ni datos bancarios.",
  },
  notificaciones: {
    title: "Revisa y limpia tus avisos",
    description: "Lee cada aviso y márcalo como leído. Si ya no lo necesitas, pulsa “Eliminar”.",
  },
  perfil: {
    title: "Mantén tus datos actualizados",
    description: "Pulsa “Editar”, cambia únicamente los datos necesarios y termina con “Guardar cambios”.",
  },
};

const DEFAULT_GUIDANCE = {
  title: "Avanza paso a paso",
  description: "Completa solamente la acción disponible en esta pantalla. Regresa a Inicio si no sabes qué hacer después.",
};

export default function SeniorGuidance({ currentPage, advisorAssigned = true }) {
  const guidance = advisorAssigned
    ? PAGE_GUIDANCE[currentPage] || DEFAULT_GUIDANCE
    : {
        title: "Mientras te asignamos un asesor",
        description: "Puedes completar tu perfil y subir documentos. Las demás opciones se habilitarán automáticamente cuando tengas un asesor.",
      };

  return (
    <section className="vg-senior-guide" aria-labelledby="vg-senior-guide-title">
      <span className="vg-senior-guide__icon" aria-hidden="true">
        <CircleHelp />
      </span>
      <div>
        <span className="vg-senior-guide__eyebrow">Guía rápida</span>
        <h2 id="vg-senior-guide-title">{guidance.title}</h2>
        <p>{guidance.description}</p>
      </div>
    </section>
  );
}
