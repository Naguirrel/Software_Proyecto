export function validarCampo(campo, valor, formData) {
  // Si el campo depende de otro y ese otro no cumple la condición, no validar
  if (campo.dependeDe && formData[campo.dependeDe.campo] !== campo.dependeDe.valor) {
    return null;
  }

  // Si no es requerido y está vacío, no hay error
  if (!campo.required && (!valor || String(valor).trim() === "")) {
    return null;
  }

  // Si es requerido y está vacío
  if (campo.required && (!valor || String(valor).trim() === "")) {
    return "Este campo es obligatorio";
  }

  // Validaciones específicas
  if (campo.validation) {
    const v = campo.validation;
    const valorStr = String(valor);

    // Longitud mínima
    if (v.minLength && valorStr.length < v.minLength) {
      return `Debe tener al menos ${v.minLength} caracteres`;
    }

    // Longitud máxima
    if (v.maxLength && valorStr.length > v.maxLength) {
      return `No puede exceder ${v.maxLength} caracteres`;
    }

    // Valores numéricos
    if (v.min !== undefined && Number(valor) < v.min) {
      return `El valor mínimo es ${v.min}`;
    }

    if (v.max !== undefined && Number(valor) > v.max) {
      return `El valor máximo es ${v.max}`;
    }

    // Patrones
    if (v.pattern === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(valorStr)) {
        return "Ingresa un correo electrónico válido";
      }
    }

    if (v.pattern === "telefono") {
      const telRegex = /^[\d\s+()-]{8,20}$/;
      if (!telRegex.test(valorStr)) {
        return "Ingresa un número de teléfono válido";
      }
    }

    if (v.pattern === "letras") {
      const letrasRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+$/;
      if (!letrasRegex.test(valorStr)) {
        return "Solo se permiten letras";
      }
    }

    if (v.pattern === "sevis" && !/^N\d{10}$/i.test(valorStr)) {
      return "Ingresa un número SEVIS válido (N seguido de 10 dígitos)";
    }

    // Fechas
    if (v.tipo === "fechaPasada") {
      const fecha = new Date(valor);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (fecha >= hoy) {
        return "La fecha debe ser anterior a hoy";
      }
    }

    if (v.tipo === "fechaFutura") {
      const fecha = new Date(valor);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (fecha <= hoy) {
        return "La fecha debe ser posterior a hoy";
      }
    }
  }

  return null;
}

export function validarSeccion(campos, formData, debeMostrar) {
  const errores = {};
  let hayErrores = false;

  campos.forEach(campo => {
    if (!debeMostrar(campo)) return;

    const error = validarCampo(campo, formData[campo.name], formData);
    if (error) {
      errores[campo.name] = error;
      hayErrores = true;
    }
  });

  return { errores, esValida: !hayErrores };
}
