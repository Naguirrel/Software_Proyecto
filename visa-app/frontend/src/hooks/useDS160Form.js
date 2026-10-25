import { useState, useEffect, useRef } from "react";
import { buildApiUrl } from "../config/api";
import { getDs160Sections } from "../data/ds160Sections";
import { validarCampo, validarSeccion } from "../utils/ds160Validation";
import { buildDs160PdfFilename } from "../utils/ds160PdfFilename";

function getCorreo() {
  const sessionRaw = localStorage.getItem("visaguide_session");
  return sessionRaw
    ? JSON.parse(sessionRaw).correo
    : localStorage.getItem("correoUsuario");
}

function getToken() {
  const sessionRaw = localStorage.getItem("visaguide_session");
  return sessionRaw ? JSON.parse(sessionRaw).token : null;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function useDS160Form(profile) {
  const secciones = getDs160Sections(profile);
  const [seccionActual, setSeccionActual] = useState(1);
  const [formData, setFormData] = useState({});
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState("");
  const [formularioFinalizado, setFormularioFinalizado] = useState(false);
  const [cargando, setCargando] = useState(true);

  const formDataRef = useRef(formData);
  const seccionActualRef = useRef(seccionActual);
  const dirtyRef = useRef(false);
  const autosaveControllerRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);
  const mensajeTimeoutRef = useRef(null);

  const mostrarMensajeTemporal = (mensaje) => {
    window.clearTimeout(mensajeTimeoutRef.current);
    setMensajeGuardado(mensaje);
    mensajeTimeoutRef.current = window.setTimeout(() => setMensajeGuardado(""), 3000);
  };

  formDataRef.current = formData;
  seccionActualRef.current = seccionActual;

  const seccion = secciones.find(s => s.id === seccionActual);
  const totalSecciones = secciones.length;
  const progreso = (seccionActual / totalSecciones) * 100;

  const debeMostrar = (campo) =>
    !campo.dependeDe || formData[campo.dependeDe.campo] === campo.dependeDe.valor;
  const seccionesCompletadas = new Set(
    secciones
      .filter(({ campos }) => validarSeccion(campos, formData, debeMostrar).esValida)
      .map(({ id }) => id)
  );

  // Cargar datos al iniciar
  useEffect(() => {
    const controller = new AbortController();
    const cargar = async () => {
      const correo = getCorreo();
      const token = getToken();
      if (!correo || !token) {
        setCargando(false);
        return;
      }
      try {
        const res = await fetch(buildApiUrl("/ds160/load"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ correo }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setFormData(data.datos || {});
        setSeccionActual(data.seccion_actual || 1);
      } catch (error) {
        if (error.name !== "AbortError") { /* ignorar errores de carga */ }
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    };
    cargar();
    return () => controller.abort();
  }, []);

  // Autosave con debounce
  useEffect(() => {
    if (cargando || !dirtyRef.current || Object.keys(formData).length === 0) return;

    autosaveTimeoutRef.current = window.setTimeout(async () => {
      if (!dirtyRef.current) return;
      const correo = getCorreo();
      const token = getToken();
      if (!correo || !token) return;
      autosaveControllerRef.current?.abort();
      const controller = new AbortController();
      autosaveControllerRef.current = controller;
      try {
        const response = await fetch(buildApiUrl("/ds160"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ correo, datos: formData, seccion_actual: seccionActual, completado: false }),
          signal: controller.signal,
        });
        if (response.ok) dirtyRef.current = false;
      } catch (error) {
        if (error.name !== "AbortError") { /* el próximo cambio reintentará */ }
      }
    }, 1500);

    return () => window.clearTimeout(autosaveTimeoutRef.current);
  }, [formData, seccionActual, cargando]);

  // Flush al salir de la página
  useEffect(() => {
    const flushPendingChanges = () => {
      if (!dirtyRef.current || Object.keys(formDataRef.current).length === 0) return;
      const correo = getCorreo();
      const token = getToken();
      if (!correo || !token) return;
      // navigator.sendBeacon no permite encabezados personalizados, así que el
      // token viaja también en el body para que el backend lo use como respaldo.
      const body = JSON.stringify({
        correo,
        token,
        datos: formDataRef.current,
        seccion_actual: seccionActualRef.current,
        completado: false,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(buildApiUrl("/ds160"), new Blob([body], { type: "application/json" }));
      } else {
        fetch(buildApiUrl("/ds160"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", flushPendingChanges);
    return () => {
      window.removeEventListener("pagehide", flushPendingChanges);
      autosaveControllerRef.current?.abort();
      window.clearTimeout(mensajeTimeoutRef.current);
      flushPendingChanges();
    };
  }, []);

  const handleChange = (name, value) => {
    dirtyRef.current = true;
    setFormData(p => ({ ...p, [name]: value }));

    const campo = seccion?.campos.find(c => c.name === name);
    if (campo) {
      const error = validarCampo(campo, value, formData);
      setErrores(prev => {
        const nuevos = { ...prev };
        if (error) {
          nuevos[name] = error;
        } else {
          delete nuevos[name];
        }
        return nuevos;
      });
    }
  };

  const validarSeccionActual = () => {
    const { errores: nuevosErrores, esValida } = validarSeccion(
      seccion?.campos || [],
      formData,
      debeMostrar
    );
    setErrores(nuevosErrores);
    return esValida;
  };

  const guardarProgreso = async (seccionParaGuardar = seccionActual) => {
    const correo = getCorreo();
    const token = getToken();
    if (!correo || !token) return;
    setGuardando(true);
    try {
      const res = await fetch(buildApiUrl("/ds160"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ correo, datos: formData, seccion_actual: seccionParaGuardar, completado: false }),
      });
      if (!res.ok) throw new Error();
      dirtyRef.current = false;
      mostrarMensajeTemporal("✓ Progreso guardado");
    } catch {
      mostrarMensajeTemporal("Error al guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const descargarPdf = async () => {
    const correo = getCorreo();
    const token = getToken();
    if (!correo || !token) {
      mostrarMensajeTemporal("No se encontró una sesión activa.");
      return;
    }

    setDescargandoPdf(true);
    try {
      const response = await fetch(buildApiUrl("/ds160/pdf"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ correo }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo descargar el PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const sessionRaw = localStorage.getItem("visaguide_session");
      const session = sessionRaw ? JSON.parse(sessionRaw) : {};
      link.download = buildDs160PdfFilename(formData, session);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      mostrarMensajeTemporal(error.message || "No se pudo descargar el PDF.");
    } finally {
      setDescargandoPdf(false);
    }
  };

  const finalizarFormulario = async () => {
    const esValida = validarSeccionActual();
    if (!esValida) {
      mostrarMensajeTemporal("Completa los campos obligatorios antes de finalizar");
      return;
    }

    const correo = getCorreo();
    const token = getToken();
    if (!correo || !token) {
      mostrarMensajeTemporal("No se encontró una sesión activa.");
      return;
    }
    setGuardando(true);
    try {
      window.clearTimeout(autosaveTimeoutRef.current);
      autosaveControllerRef.current?.abort();
      const response = await fetch(buildApiUrl("/ds160"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ correo, datos: formData, seccion_actual: seccionActual, completado: true }),
      });
      if (!response.ok) throw new Error();
      dirtyRef.current = false;
      setFormularioFinalizado(true);
      window.clearTimeout(mensajeTimeoutRef.current);
      setMensajeGuardado("");
    } catch {
      mostrarMensajeTemporal("Error al finalizar el formulario. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const siguienteSeccion = () => {
    if (seccionActual < totalSecciones) {
      const esValida = validarSeccionActual();
      if (!esValida) {
        mostrarMensajeTemporal("Completa los campos obligatorios antes de continuar");
        return;
      }
      const nuevaSeccion = seccionActual + 1;
      setErrores({});
      setSeccionActual(nuevaSeccion);
      guardarProgreso(nuevaSeccion);
      window.scrollTo(0, 0);
    }
  };

  const anteriorSeccion = () => {
    if (seccionActual > 1) {
      setErrores({});
      setSeccionActual(s => s - 1);
      window.scrollTo(0, 0);
    }
  };

  return {
    // Estado
    seccionActual,
    formData,
    errores,
    guardando,
    descargandoPdf,
    mensajeGuardado,
    formularioFinalizado,
    cargando,
    seccion,
    totalSecciones,
    progreso,
    seccionesCompletadas,
    // Funciones
    debeMostrar,
    handleChange,
    validarSeccionActual,
    guardarProgreso,
    descargarPdf,
    finalizarFormulario,
    siguienteSeccion,
    anteriorSeccion,
  };
}
