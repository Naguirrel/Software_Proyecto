import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "./sessionAuth";

export function isDocumentFileRoute(url) {
  try {
    const parsedUrl = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    );
    return /^\/documentos\/\d+\/archivo$/.test(parsedUrl.pathname);
  } catch {
    return false;
  }
}

export function getDocumentPreviewUrl(document) {
  if (!document?.archivo_url) return "";
  if (isDocumentFileRoute(document.archivo_url)) {
    const parsedUrl = new URL(
      document.archivo_url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    );
    return buildApiUrl(parsedUrl.pathname);
  }

  return document.archivo_url.startsWith("/")
    ? buildApiUrl(document.archivo_url)
    : document.archivo_url;
}

export function openDocumentPreview(document) {
  const previewUrl = getDocumentPreviewUrl(document);
  if (!previewUrl) return;

  if (!isDocumentFileRoute(document.archivo_url)) {
    window.open(previewUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const previewWindow = window.open("about:blank", "_blank");
  if (previewWindow) {
    previewWindow.opener = null;
    previewWindow.document.title = "Cargando documento";
    previewWindow.document.body.textContent = "Cargando documento...";
  }

  fetch(previewUrl, { headers: buildSessionHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo abrir el documento.");
      return response.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    })
    .catch((error) => {
      if (previewWindow) {
        previewWindow.document.title = "No se pudo abrir el documento";
        previewWindow.document.body.textContent = error.message || "No se pudo abrir el documento.";
      }
    });
}
