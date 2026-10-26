import { useEffect, useState } from "react";
import { getDocumentPreviewUrl, isDocumentFileRoute } from "../../utils/documentPreview";
import { buildSessionHeaders } from "../../utils/sessionAuth";

export default function AdvisorDocumentPreview({ document }) {
  const [preview, setPreview] = useState({ loading: true, url: "", type: "", error: "" });
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    if (!document.archivo_url || !isDocumentFileRoute(document.archivo_url)) {
      const timer = window.setTimeout(() => setPreview({ loading: false, url: "", type: "", error: "La vista previa no está disponible para este archivo. Usa Abrir archivo." }), 0);
      return () => window.clearTimeout(timer);
    }
    fetch(getDocumentPreviewUrl(document), { headers: buildSessionHeaders(), signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("No fue posible cargar el archivo."); return response.blob(); })
      .then((blob) => {
        if (controller.signal.aborted) return;
        const type = blob.type.split(";")[0].toLowerCase();
        if (!["application/pdf", "image/jpeg", "image/png"].includes(type)) throw new Error("Este formato no admite vista previa. Usa Abrir archivo.");
        objectUrl = URL.createObjectURL(blob);
        setPreview({ loading: false, url: objectUrl, type, error: "" });
      })
      .catch((error) => { if (error.name !== "AbortError") setPreview({ loading: false, url: "", type: "", error: error.message }); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [document]);

  if (preview.loading) return <p role="status">Cargando vista previa…</p>;
  if (preview.error) return <p role="status">{preview.error}</p>;
  return preview.type === "application/pdf"
    ? <iframe className="advisor-document-preview" title={`Vista previa de ${document.nombre}`} src={preview.url} />
    : <img className="advisor-document-preview advisor-document-preview--image" src={preview.url} alt={`Vista previa de ${document.nombre}`} />;
}
